import { getDataverseClient, type DataverseClient } from "@/lib/dataverse";
import type { ODataQuery } from "@/lib/dataverse/odata";
import {
  readCache,
  writeCache,
  clearCache,
} from "@/lib/storage/entityCache";
import {
  PROJECT_COLUMNS,
  PROJECT_LINE_COLUMNS,
  SUB_PROJECT_COLUMNS,
  SUB_PROJECT_DETAIL_COLUMNS,
  SHIP_COLUMNS,
  EXPENSE_COLUMNS,
  // PURCHASE_COLUMNS + ACTUAL_EXPENSE_COLUMNS + BUDGET_COLUMNS
  // intentionally not imported — all three are fetched per-selected-
  // project on-demand from `useProjectPurchases`,
  // `useProjectExpenseLines`, and `useSegmentBudget(segment)`
  // respectively. The bulk refresh chain skips them to keep the
  // localStorage cache under quota.
  VESSEL_TABLE_COLUMNS,
} from "@/lib/dataverse/columnOrder";

/**
 * Standalone Dataverse refresh — fetches the 6 cached entity sets +
 * the 2 sales aggregates and writes each result to localStorage.
 *
 * Mirrors the `refreshSteps` logic inside `DataManagementPage` but
 * without depending on the per-entity `useEntityRows` hooks, so it
 * can be invoked from anywhere (e.g. the post-login auto-refresh
 * mounted in `AppShell`).
 *
 * Each successful `writeCache` dispatches the `tyro:cache-updated`
 * event, which `useRealProjects.useCacheFingerprint` listens for —
 * so views currently on screen (Dashboard, Vessel Projects) re-derive
 * automatically once the relevant slot lands.
 *
 * 🔒 READ-ONLY — only GET via `client.list` / `client.listAll`.
 */

/** Projid-specific exceptions: projects we ALWAYS include even when
 *  they fail the default scope (e.g. internal projects whose
 *  delivery mode isn't "Gemi" but still need P&L visibility).
 *  Extend this list to whitelist additional project IDs. Typed as
 *  `readonly string[]` (not `as const`) so the empty-check below
 *  remains valid when the list shrinks back to zero. */
export const PROJECT_ID_EXCEPTIONS: readonly string[] = ["ORGANIK01"];

/** Server-side filter for the Projects header fetch — sea-mode
 *  projects with a non-empty segment, OR any project whose
 *  `mserp_projid` is in `PROJECT_ID_EXCEPTIONS`. Single source of
 *  truth for the auto-refresh chain, the Veri Yönetimi inspector
 *  tab, and the entity-config inspector default. Exported so all
 *  three consumers stay in lock-step. */
export const PROJECTS_FILTER = (() => {
  const base =
    "(mserp_dlvmode eq 'Gemi' and mserp_tryprojectsegment ne null)";
  if (PROJECT_ID_EXCEPTIONS.length === 0) return base;
  const orChain = PROJECT_ID_EXCEPTIONS.map(
    (id) => `mserp_projid eq '${id}'`
  ).join(" or ");
  return `${base} or ${orChain}`;
})();

/** Human-readable summary of the active project scope — surfaced in
 *  the RefreshAllButton tooltip so users know exactly which slice of
 *  F&O they're pulling. */
export function describeProjectFilter(): string {
  const lines = [
    "• Teslimat şekli (mserp_dlvmode) = Gemi",
    "• Segment (mserp_tryprojectsegment) dolu (boş olmayan)",
  ];
  if (PROJECT_ID_EXCEPTIONS.length > 0) {
    lines.push(
      `• İstisna: ${PROJECT_ID_EXCEPTIONS.join(", ")} her halükarda dahil`
    );
  }
  return lines.join("\n");
}

const ENTITY_SETS = {
  projects: "mserp_etgtryprojecttableentities",
  /** Alt-proje tablosu — projeleri sefer/dönem bazlı leg'lere bölen
   *  alt satırlar. FK = `mserp_projid` (parent project header).
   *  Tipik kullanım: PRJ000001368 → satır 1, 2, 3 (her ayın yükü). */
  subProject: "mserp_trysubprojectentities",
  /** Alt-proje detay satırları — her alt-projenin itinerary'sini
   *  tutan en aşağıdaki seviye. FK = `mserp_subprojectid` (parent
   *  alt-proje). Tipik kullanım: HASATA-4 → satır 1, 2, 3 (her
   *  durağın taşıma kaydı). */
  subProjectDetail: "mserp_trysubprojectdetailsentities",
  ship: "mserp_tryaiprojectshiprelationentities",
  lines: "mserp_tryaiprojectlineentities",
  expense: "mserp_tryaiotherexpenseentities",
  /** Realised expense distribution — what actually got booked against
   *  each project (vs. `expense` which is the upfront estimate). FK is
   *  `mserp_etgtryprojid`, same as the estimate table. */
  actualExpense: "mserp_tryaifrtexpenselinedistlineentities",
  /** Realised project purchases — vendor invoice transactions linked
   *  via the parent purchase table's project field
   *  `mserp_purchtable_etgtryprojid`. Counterpart of the customer-side
   *  sales `mserp_tryaicustinvoicetransentities`. */
  purchase: "mserp_tryaivendinvoicetransentities",
  /** Sales order header — joined to invoice trans rows on
   *  `mserp_salesid`. Read once tenant-wide so we can identify which
   *  sales orders are `mserp_etgordertype === 'Finansman'` and
   *  exclude their invoice rows from realised-sales math. */
  salesTable: "mserp_tryaisalestableentities",
  /** Purchase order header — joined to vendor-invoice trans rows on
   *  `mserp_purchid`. Same role as `salesTable` for the buy side. */
  purchTable: "mserp_tryaipurchtableentities",
  /** Vessel master table — looked up by `mserp_vesseltable_recid`
   *  to enrich each ship-relation row with its real
   *  `mserp_vesselname` + `mserp_imonumber`. The ship entity itself
   *  carries only the numeric `mserp_vessel` RecID. */
  vesselTable: "mserp_tryvlxvesseltableentities",
} as const;

const SALES_ENTITY = "mserp_tryaicustinvoicetransentities";

/** Synthetic localStorage cache keys carrying the lists of sales /
 *  purchase order IDs flagged as `mserp_etgordertype === 'Finansman'`
 *  on their respective header tables. NOT real Dataverse entity sets
 *  — `writeCache` accepts any string key, and using a recognisable
 *  `tyro:dv:financing*` prefix keeps the inspector + DevTools view
 *  consistent. Consumers read these to filter realised invoice rows
 *  client-side or to chain a server-side `not In(...)` clause. */
export const FINANCING_SALES_IDS_CACHE = "financingSalesIds";
export const FINANCING_PURCH_IDS_CACHE = "financingPurchIds";

/** Synthetic cache key for the tenant-wide realised-expense rollup
 *  the P&L Cost report reads. NOT a real Dataverse entity set —
 *  populated by `fetchActualExpenseRollupForAllProjects` in the
 *  refresh chain. Format: `ActualExpenseRollupRow[]`. */
export const ACTUAL_EXPENSE_ROLLUP_CACHE = "actualExpenseRollup";

/** Synthetic cache key for the per-(projid, expenseType) aggregated
 *  estimated expense. Replaces the old `mserp_tryaiotherexpenseentities`
 *  raw-row master cache — that table grew large enough (with sub-project
 *  union scope) to threaten localStorage quota.
 *
 *  Format: `EstimatedExpenseAggregateRow[]` — one entry per
 *  (projectNo, expenseTypeCode) pair, carrying the F&O FormattedValue
 *  label for client-side bucketing + the summed unit-USD-per-ton.
 *  Composer multiplies by project tons (from vesselPlan) to derive
 *  bucket totals (Freight / Insurance / Duties / Other).
 *
 *  When raw expense rows are needed (EstimatedExpenseCard line list,
 *  Veri Yönetimi "Tahmini Gider" tab), they're fetched on-demand per
 *  selected project via `useProjectEstimatedExpense`. */
export const ESTIMATED_EXPENSE_AGGREGATE_CACHE =
  "estimatedExpenseAggregateByProject";

export interface EstimatedExpenseAggregateRow {
  projectNo: string;
  /** F&O `mserp_tryexpensetype` numeric code as text. Carried for
   *  inspector / debugging — bucketing reads `expenseTypeLabel`. */
  expenseTypeCode: string;
  /** FormattedValue (e.g. "Navlun", "Sigorta", "Customs", "OPEX").
   *  Empty string when Dataverse didn't return an FV (rare). */
  expenseTypeLabel: string;
  /** Σ `mserp_expamountusdd` over the rows of this group. Per-ton USD;
   *  composer multiplies by project tons to get bucket totalUsd. */
  totalUnitUsd: number;
  /** Source row count — diagnostic only. */
  rowCount: number;
}

export interface RefreshProgress {
  /** 1-based step index. */
  step: number;
  totalSteps: number;
  label: string;
}

export interface RefreshResult {
  ok: boolean;
  /** Step labels that completed successfully. */
  completedSteps: string[];
  /** Label of the step that failed (when `ok=false`). */
  failedStep?: string;
  /** Network or parse error message surfaced to the user. */
  errorMessage?: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Project header rows fetched in the first step — surfaced to the
   *  toast so the user sees "437 proje senkronlandı". `undefined`
   *  when the projects step never ran (very first failure). */
  projectCount?: number;
}

/* ─────────── Vessel master enrichment ─────────── */

/**
 * Fetch the vessel-master entity tenant-wide AND enrich the cached
 * ship-relation rows with the looked-up `mserp_vesselname` +
 * `mserp_imonumber`. The vessel-master table is small (one row per
 * chartered vessel, ~hundreds), so a single tenant-wide list is
 * cheaper than per-row lookups during compose.
 *
 * Join key: ship row's `mserp_vessel` (numeric RecID) ===
 *           vessel master's `mserp_vesseltable_recid` (numeric RecID).
 *
 * After enrichment, the ship cache rows carry the friendly fields
 * directly — composer reads them as plain row keys and the Veri
 * Yönetimi inspector renders them via `SHIP_DISPLAY_COLUMNS`. Both
 * the post-login auto-refresh and the manual "Verileri Güncelle"
 * chain call this helper so the two paths stay aligned.
 */
export async function fetchVesselMasterAndEnrichShipCache(
  client: DataverseClient
): Promise<{ vesselCount: number; enrichedShipCount: number }> {
  // Fetch vessel master (tenant-wide, locked to 3 columns).
  const masterResult = await client.listAll<Record<string, unknown>>(
    ENTITY_SETS.vesselTable,
    {
      $select: VESSEL_TABLE_COLUMNS.join(","),
      $count: true,
    }
  );
  // Cache the master so the inspector can show it later if we add
  // a tab for it; also makes the data inspectable via DevTools.
  writeCache(ENTITY_SETS.vesselTable, {
    fetchedAt: new Date().toISOString(),
    value: masterResult.value,
    totalCount: masterResult.totalCount,
  });

  // Build recid → {vesselname, imonumber} index. Numeric RecIDs.
  const byRecid = new Map<
    number,
    { vesselname: string; imonumber: string }
  >();
  for (const v of masterResult.value) {
    const recid = Number(v["mserp_vesseltable_recid"]);
    if (!Number.isFinite(recid)) continue;
    byRecid.set(recid, {
      vesselname: String(v["mserp_vesselname"] ?? "").trim(),
      imonumber: String(v["mserp_imonumber"] ?? "").trim(),
    });
  }

  // Enrich the ship cache in place. If the cache hasn't been
  // populated yet (Gemi Planı step skipped or failed), bail —
  // there's nothing to enrich.
  const shipCache = readCache<Record<string, unknown>>(ENTITY_SETS.ship);
  if (!shipCache) {
    return { vesselCount: byRecid.size, enrichedShipCount: 0 };
  }
  let enrichedCount = 0;
  const enrichedRows = shipCache.value.map((r) => {
    const vesselRecid = Number(r["mserp_vessel"]);
    if (!Number.isFinite(vesselRecid)) return r;
    const match = byRecid.get(vesselRecid);
    if (!match) return r;
    enrichedCount++;
    return {
      ...r,
      mserp_vesselname: match.vesselname,
      mserp_imonumber: match.imonumber,
    };
  });
  writeCache(ENTITY_SETS.ship, {
    fetchedAt: shipCache.fetchedAt,
    value: enrichedRows,
    totalCount: shipCache.totalCount,
  });
  return { vesselCount: byRecid.size, enrichedShipCount: enrichedCount };
}

/* ─────────── Filter helpers ─────────── */

/**
 * OData filter clause that excludes intercompany invoice rows from
 * sales + purchase fetches. We never want intercompany trans rows in
 * the inspector or the calculations — they're internal transfers,
 * not realised customer/vendor activity. Single source of truth so
 * the same wording is used in every call site (auto-refresh, manual
 * refresh, per-project hooks, dashboard rollups).
 *
 * `eq null` is the OData v4 standard for "field unset" but on this
 * Tiryaki tenant the F&O dual-write surface populates the column
 * with an empty string for non-intercompany rows instead of NULL —
 * so a pure `eq null` clause leaks intercompany==='' rows back into
 * the cache. We catch both shapes here. The whole expression is
 * pre-wrapped in parentheses so call sites can splice it in with
 * `${NON_INTERCOMPANY_FILTER}` without worrying about `and`/`or`
 * precedence.
 */
export const NON_INTERCOMPANY_FILTER =
  "(mserp_intercompanyinventtransid eq null or mserp_intercompanyinventtransid eq '')";

/** Maximum project IDs per `Microsoft.Dynamics.CRM.In(...)` clause.
 *
 *  At ~12 chars per project ID + URL-encoded quotes/commas (~22 chars
 *  per encoded ID), a single batch fits comfortably under Dataverse's
 *  ~16KB URL ceiling AND under the smaller proxy/CDN limits some
 *  enterprise networks impose between the browser and Dataverse.
 *
 *  Originally sized at 100; reduced to 50 after a follow-up 400 still
 *  hit the Gemi Planı step on `mserp_tryaiprojectshiprelationentities`
 *  with full chunks. F&O virtual entities can be touchier with large
 *  `In(...)` lists than regular Dataverse tables — 50 keeps each URL
 *  under ~1.5KB and gives the server a smaller working set per
 *  request. 440 projects → 9 sequential fetches, still fast. */
const PROJID_CHUNK_SIZE = 50;

function buildInFilter(field: string, projids: string[]): string {
  if (projids.length === 0) {
    // Empty list — return nothing rather than blowing up the server.
    return `${field} eq null`;
  }
  return `Microsoft.Dynamics.CRM.In(PropertyName='${field}',PropertyValues=[${projids
    .map((p) => `'${p}'`)
    .join(",")}])`;
}

/** Read the cached financing-order ID list (sales or purchase). Returns
 *  `[]` when the cache slot is missing — callers then skip the filter
 *  entirely so the chain still works on first run before refresh. */
export function readFinancingIds(cacheKey: string): string[] {
  const cached = readCache<string>(cacheKey);
  return cached?.value ?? [];
}

/** Read the cached Finansman sales-ID list as a Set for O(1) lookup
 *  during client-side row filtering. F&O virtual entities reject
 *  `not Microsoft.Dynamics.CRM.In(...)` filters with a 405, so every
 *  consumer that wants Finansman exclusion has to filter rows after
 *  the fetch — using this Set. */
export function getFinancingSalesIdSet(): Set<string> {
  return new Set(readFinancingIds(FINANCING_SALES_IDS_CACHE));
}

/** Counterpart of `getFinancingSalesIdSet` for the buy side. */
export function getFinancingPurchIdSet(): Set<string> {
  return new Set(readFinancingIds(FINANCING_PURCH_IDS_CACHE));
}

/** Numeric option-set code for `mserp_etgordertype === "Finansman"`
 *  on this Tiryaki tenant — verified against the live Dataverse
 *  instance by probing both `mserp_tryaisalestableentities` and
 *  `mserp_tryaipurchtableentities` headers. Both use the same
 *  option-set vocabulary; code 200000007 carries the FormattedValue
 *  "Finance sales" (which the F&O TR UI translates to "Finansman").
 *
 *  Hardcoded because:
 *  - Discovery (groupby) doesn't return the FormattedValue annotation
 *    on F&O virtual-entity aggregate responses, so we'd otherwise
 *    have to probe each distinct code separately.
 *  - The metadata is stable enough to commit to — if F&O admins add
 *    or renumber order types, this constant is the one place to
 *    update.
 *
 *  If a future schema change moves the code, watch for empty
 *  realised-sales / realised-purchase totals in the data inspector
 *  and re-verify with a `$top=1` probe via DevTools. */
const FINANCING_ORDER_TYPE_CODE = 200000007;

/**
 * Fetch every salesid / purchid on `entitySet`'s header whose
 * `mserp_etgordertype` matches the financing code. Single
 * server-side filter — fast even on 100K-row tables because the
 * server filters before paging.
 *
 * Returns `[]` only when the tenant truly carries no financing
 * orders (or when the hardcoded code has drifted out of sync —
 * see `FINANCING_ORDER_TYPE_CODE` above).
 */
export async function fetchFinancingOrderIds(
  client: DataverseClient,
  entitySet: string,
  idField: "mserp_salesid" | "mserp_purchid"
): Promise<string[]> {
  const result = await client.listAll<Record<string, unknown>>(entitySet, {
    $filter: `mserp_etgordertype eq ${FINANCING_ORDER_TYPE_CODE}`,
    $select: idField,
  });
  return result.value
    .map((r) => String(r[idField] ?? "").trim())
    .filter((s) => s.length > 0);
}

function readProjids(): string[] {
  const cached = readCache<Record<string, unknown>>(ENTITY_SETS.projects);
  return (cached?.value ?? [])
    .map((p) => p.mserp_projid as string | undefined)
    .filter((s): s is string => !!s);
}

/**
 * Read the union of parent project IDs AND sub-project IDs from cache.
 *
 * Why this exists: sub-project IDs carry the SAME semantic weight as
 * parent project IDs throughout the rest of the F&O data model. Child
 * entities (ship-plan, expense, sales, purchase, monthly-sales) use
 * the same FK columns (`mserp_tryshipprojid`, `mserp_etgtryprojid`,
 * `mserp_purchtable_etgtryprojid`) to point at EITHER a parent project
 * or a sub-project. The custom F&O work by consultants on this Tiryaki
 * tenant treats them as peers — when a project gets split into voyage
 * legs, the parent header stops being the join target and each sub-project
 * gets its own ship-plan / expense / sales / purchase / actual cost rows.
 *
 * Consequence: every "fetch child rows by project FK" step that wants
 * the rows currently rendered for sub-projects must use the union. The
 * "Proje Satırları" step still uses `readProjids()` because per-user
 * spec sub-project line items should remain EMPTY (parents own the
 * line catalogue; sub-projects represent split voyages on the same
 * catalogue, not separate orders).
 */
function readAllScopedProjids(): string[] {
  const projCache = readCache<Record<string, unknown>>(ENTITY_SETS.projects);
  const subCache = readCache<Record<string, unknown>>(ENTITY_SETS.subProject);
  const ids = new Set<string>();
  for (const row of projCache?.value ?? []) {
    const id = row.mserp_projid as string | undefined;
    if (id) ids.add(id);
  }
  for (const row of subCache?.value ?? []) {
    const id = row.mserp_subprojectid as string | undefined;
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Maximum number of HTTP requests in flight at once when fanning out
 * a chunked fetch. Browser HTTP/2 allows ~100 concurrent streams per
 * origin, but Dataverse virtual entities have their own rate-limiter
 * + throttle. Hard fan-out of all 20+ chunks at once was triggering
 * 429s; each 429 triggers a retry chain (1s, 2s, 3s backoff × 3),
 * which inflated total step time and looked like a hang. Cap at 6 to
 * stay under Dataverse's concurrency tolerance while still amortising
 * away from pure-sequential.
 */
const MAX_CONCURRENT_CHUNKS = 6;

/**
 * Run an array of async tasks with a bounded concurrency. Generic
 * worker-pool: every task is a thunk that produces a Promise; we keep
 * `concurrency` workers pulling the next thunk until the queue is
 * empty. Order of results matches input order so callers can splice
 * them straight into a concatenated result array.
 */
async function runWithConcurrency<T>(
  factories: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(factories.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= factories.length) return;
      results[i] = await factories[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, factories.length) }, () =>
      worker()
    )
  );
  return results;
}

/**
 * Run `client.listAll` once per chunk of project IDs and concatenate
 * the results. Drops a request URL of ~10KB+ down to ~2.5KB per call,
 * which keeps Dataverse + any proxy in the path happy. Returns the
 * combined value list and a summed `totalCount` for the success toast.
 *
 * Use this for any `mserp_*` child entity that's filtered by an IN
 * clause over the projects-cache project IDs (lines, ship, expense).
 */
export async function listAllByInChunked<T>(
  client: DataverseClient,
  entitySet: string,
  field: string,
  projids: string[],
  baseQuery: Omit<ODataQuery, "$filter">,
  chunkSize: number = PROJID_CHUNK_SIZE,
  /** Optional clause AND-ed onto the IN filter for every chunk —
   *  e.g. `mserp_intercompanyinventtransid eq null` for the sales /
   *  purchase fetches. Wrapped in parens so OR-chains at the caller
   *  side still bind correctly. */
  extraFilter?: string
): Promise<{ value: T[]; totalCount?: number }> {
  if (projids.length === 0) {
    // Empty list → no fetch (server would otherwise scan the entire entity).
    return { value: [], totalCount: 0 };
  }
  // Build chunk factory thunks, then run them with bounded
  // concurrency. Pure Promise.all over 20+ requests triggered
  // Dataverse rate-limiting (429 + retry chain) which inflated the
  // refresh into a perceived hang. `runWithConcurrency` caps at
  // `MAX_CONCURRENT_CHUNKS` so the server-side queue stays calm.
  const factories: Array<() => Promise<{ value: T[]; totalCount?: number }>> =
    [];
  for (let i = 0; i < projids.length; i += chunkSize) {
    const chunk = projids.slice(i, i + chunkSize);
    const inClause = buildInFilter(field, chunk);
    const $filter = extraFilter
      ? `${inClause} and (${extraFilter})`
      : inClause;
    factories.push(() =>
      client.listAll<T>(entitySet, {
        ...baseQuery,
        $filter,
      })
    );
  }
  const results = await runWithConcurrency(factories, MAX_CONCURRENT_CHUNKS);
  const all: T[] = [];
  let totalCount: number | undefined;
  for (const result of results) {
    all.push(...result.value);
    if (typeof result.totalCount === "number") {
      totalCount = (totalCount ?? 0) + result.totalCount;
    }
  }
  return { value: all, totalCount };
}

/**
 * Same chunking pattern but for `$apply` aggregates. Each chunk runs an
 * independent groupby so the (projid, currencycode) pairs can simply
 * be concatenated — they don't overlap across chunks since each project
 * lives in exactly one chunk. Chunks fire in PARALLEL (see
 * `listAllByInChunked` for rationale).
 */
export async function applyByInChunked<T>(
  client: DataverseClient,
  entitySet: string,
  field: string,
  projids: string[],
  buildApply: (inClause: string) => string,
  chunkSize: number = PROJID_CHUNK_SIZE
): Promise<{ value: T[] }> {
  if (projids.length === 0) return { value: [] };
  // Bounded concurrency — see `listAllByInChunked` for rationale.
  // Aggregate queries hit the same Dataverse rate-limiter as raw
  // fetches; firing 20+ at once on the F&O virtual entity tripped
  // the throttle and triggered retry chains that looked like a hang.
  const factories: Array<() => Promise<{ value: T[] }>> = [];
  for (let i = 0; i < projids.length; i += chunkSize) {
    const chunk = projids.slice(i, i + chunkSize);
    const inClause = buildInFilter(field, chunk);
    const apply = buildApply(inClause);
    factories.push(() => client.list<T>(entitySet, { $apply: apply }));
  }
  const results = await runWithConcurrency(factories, MAX_CONCURRENT_CHUNKS);
  const all: T[] = [];
  for (const result of results) {
    all.push(...result.value);
  }
  return { value: all };
}

/* ─────────── Main entry ─────────── */

/**
 * Run the full sequential refresh. Returns when every step has either
 * succeeded or one has thrown. Caller fires the toast.
 *
 * On the first failure the loop stops and `RefreshResult.failedStep`
 * carries the offending step's label — partial caches written before
 * the failure stay in localStorage (so a partial refresh is still
 * useful to the user).
 */
export async function refreshAllEntities(
  onProgress?: (p: RefreshProgress) => void
): Promise<RefreshResult> {
  const startedAt = Date.now();
  const client = getDataverseClient();
  const completed: string[] = [];
  let projectCount: number | undefined;

  type Step = { label: string; run: () => Promise<void> };

  const steps: Step[] = [
    {
      label: "Projeler",
      run: async () => {
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SETS.projects,
          {
            $filter: PROJECTS_FILTER,
            $select: PROJECT_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.projects, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
        // Capture for the success toast — prefer the server's `$count`
        // total when present, fall back to in-memory length otherwise.
        projectCount = result.totalCount ?? result.value.length;
      },
    },
    {
      label: "Proje Satırları",
      run: async () => {
        const projids = readProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.lines,
          "mserp_projid",
          projids,
          {
            $select: PROJECT_LINE_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.lines, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Alt Projeler",
      run: async () => {
        // Sub-project rows scoped to the already-cached project IDs.
        // FK = `mserp_projid` (parent project header). Plus an
        // extra server-side filter on `mserp_dlvmodeid eq 'Gemi'`
        // to mirror the parent project scope — non-sea sub-projects
        // shouldn't make it into the cache. Many parents have zero
        // sub-rows; the IN filter just narrows the response.
        const projids = readProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.subProject,
          "mserp_projid",
          projids,
          {
            $select: SUB_PROJECT_COLUMNS.join(","),
            $count: true,
          },
          undefined,
          "mserp_dlvmodeid eq 'Gemi'"
        );
        writeCache(ENTITY_SETS.subProject, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Alt Proje Satırları",
      run: async () => {
        // Detail rows scoped to the sub-project IDs we just wrote.
        // FK = `mserp_subprojectid`. Reads the freshly-written
        // sub-project cache to know which IDs are in scope.
        const cached = readCache<Record<string, unknown>>(
          ENTITY_SETS.subProject
        );
        const subProjIds = (cached?.value ?? [])
          .map((r) => r.mserp_subprojectid as string | undefined)
          .filter((s): s is string => !!s);
        if (subProjIds.length === 0) {
          // No sub-projects in scope → nothing to fetch. Write an
          // empty cache so the inspector reflects "0 rows" instead
          // of dangling stale data from a previous refresh.
          writeCache(ENTITY_SETS.subProjectDetail, {
            fetchedAt: new Date().toISOString(),
            value: [],
            totalCount: 0,
          });
          return;
        }
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.subProjectDetail,
          "mserp_subprojectid",
          subProjIds,
          {
            $select: SUB_PROJECT_DETAIL_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.subProjectDetail, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      label: "Gemi Planı",
      run: async () => {
        // $select includes the full SHIP_COLUMNS list, with the
        // `_bigint` shadow lookups kept paired with their friendly
        // counterparts. F&O virtual entities resolve these as pairs
        // — separating them caused a "property not found" 400. Don't
        // re-touch the lookup section without re-testing.
        //
        // Scope: parent project IDs UNION sub-project IDs — sub-projects
        // carry their own ship-plan rows in F&O, joined via the same
        // `mserp_tryshipprojid` FK that parents use. See
        // `readAllScopedProjids()` for the rationale.
        const projids = readAllScopedProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.ship,
          "mserp_tryshipprojid",
          projids,
          {
            $select: SHIP_COLUMNS.join(","),
            $count: true,
          }
        );
        writeCache(ENTITY_SETS.ship, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
      },
    },
    {
      // Vessel master lookup — runs RIGHT AFTER Gemi Planı so the
      // ship cache that the helper enriches is the freshly-written
      // one. Order matters; if Gemi Planı failed earlier in the
      // chain, this step has nothing to enrich and bails gracefully.
      label: "Gemi Bilgileri",
      run: async () => {
        await fetchVesselMasterAndEnrichShipCache(client);
      },
    },
    {
      label: "Tahmini Gider Toplamı",
      run: async () => {
        // Was previously a raw-row fetch into the
        // `mserp_tryaiotherexpenseentities` cache — that table grew past
        // the localStorage 5MB quota once sub-project IDs joined the
        // union. Now we fetch the same rows but aggregate client-side
        // into a tiny per-(projid, expenseType) summary BEFORE writing
        // to cache: 3 columns + FormattedValue × ~3000 rows → ~440
        // projects × 3-5 expense types = ~2000 aggregate entries,
        // shrinking the cache from ~900 KB to ~150 KB.
        //
        // Bucketing (Freight / Insurance / Duties / Other) happens in
        // the composer based on `expenseTypeLabel` — keeping it
        // client-side means F&O can rename/add expense types without
        // refresh-chain changes. Raw line-by-line render
        // (EstimatedExpenseCard, Veri Yönetimi inspector) is fed by
        // the on-demand `useProjectEstimatedExpense` hook.
        //
        // Scope: parent + sub-project IDs — sub-projects book their
        // own expense rows under the same FK.
        const projids = readAllScopedProjids();
        const result = await listAllByInChunked<Record<string, unknown>>(
          client,
          ENTITY_SETS.expense,
          "mserp_etgtryprojid",
          projids,
          {
            $select: EXPENSE_COLUMNS.join(","),
            $count: true,
          }
        );
        // Aggregate client-side: Map<`${projid}::${typeCode}`, agg>
        const agg = new Map<
          string,
          {
            projectNo: string;
            expenseTypeCode: string;
            expenseTypeLabel: string;
            totalUnitUsd: number;
            rowCount: number;
          }
        >();
        for (const row of result.value) {
          const projectNo = String(row.mserp_etgtryprojid ?? "").trim();
          if (!projectNo) continue;
          const expenseTypeCode = String(
            row.mserp_tryexpensetype ?? ""
          ).trim();
          const expenseTypeLabel = String(
            row["mserp_tryexpensetype@OData.Community.Display.V1.FormattedValue"] ??
              expenseTypeCode ??
              ""
          ).trim();
          const unitUsd = Number(row.mserp_expamountusdd);
          if (!Number.isFinite(unitUsd)) continue;
          const key = `${projectNo}::${expenseTypeCode}`;
          const existing = agg.get(key);
          if (existing) {
            existing.totalUnitUsd += unitUsd;
            existing.rowCount += 1;
          } else {
            agg.set(key, {
              projectNo,
              expenseTypeCode,
              expenseTypeLabel,
              totalUnitUsd: unitUsd,
              rowCount: 1,
            });
          }
        }
        const rows: EstimatedExpenseAggregateRow[] = [...agg.values()];
        writeCache(ESTIMATED_EXPENSE_AGGREGATE_CACHE, {
          fetchedAt: new Date().toISOString(),
          value: rows,
          totalCount: rows.length,
        });
      },
    },
    // NOTE: "Gerçekleşen Gider" intentionally OUT of the global
    // refresh chain. The entity is granular distribution lines and
    // its payload (~5-10 MB depending on tenant scope) blew the
    // browser localStorage quota when bundled alongside lines, ship,
    // expense, sales, etc. Inspector tab fetches per-project on
    // demand instead (same pattern as `sales` invoices). When the
    // dashboard later needs cross-project actual-expense rollups
    // we'll add a server-side `$apply=groupby` aggregate step here
    // — small per-project totals only.
    {
      // Build the exclusion list of sales orders flagged "Finansman"
      // on the sales header (`mserp_etgordertype`). Their invoice
      // trans rows are financing entries, not realised commercial
      // activity. Downstream sales steps + per-project hooks splice
      // a single `not In(salesid, ...)` clause keyed off this cache
      // so the rows are dropped server-side rather than after the
      // fact. Step label leads with "Hariç" to make it clear we're
      // pulling these IDs to EXCLUDE, not to surface.
      label: "Gerçekleşen Satış",
      run: async () => {
        // `mserp_etgordertype` is an Edm.Int32 option-set on the
        // sales header — a server-side `eq 'Finansman'` 400's with
        // "incompatible operand types". We don't know the numeric
        // Hardcoded financing code (200000007) + targeted filter
        // via `fetchFinancingOrderIds`. One small server-side
        // request, no full-header pull.
        const ids = await fetchFinancingOrderIds(
          client,
          ENTITY_SETS.salesTable,
          "mserp_salesid"
        );
        writeCache(FINANCING_SALES_IDS_CACHE, {
          fetchedAt: new Date().toISOString(),
          value: ids,
        });
      },
    },
    {
      // Counterpart of "Gerçekleşen Satış" for the buy side:
      // vendor purchase orders flagged as financing on
      // `mserp_tryaipurchtableentities`. Their invoice rows are
      // excluded from realised-purchase math via the same
      // `not In(...)` mechanism.
      label: "Gerçekleşen Satınalma",
      run: async () => {
        const ids = await fetchFinancingOrderIds(
          client,
          ENTITY_SETS.purchTable,
          "mserp_purchid"
        );
        writeCache(FINANCING_PURCH_IDS_CACHE, {
          fetchedAt: new Date().toISOString(),
          value: ids,
        });
      },
    },
    // NOTE: "Satınalma Faturaları" intentionally OUT of the bulk
    // refresh. The master `mserp_tryaivendinvoicetransentities` cache
    // grew past the localStorage 5MB quota once sub-project IDs joined
    // the FK union scope. Now fetched per-selected-project on-demand
    // via `useProjectPurchases(projectNo)` — same lazy pattern as
    // `useProjectInvoices` (sales). Veri Yönetimi → "Satınalma
    // Faturaları" tab + BudgetSalesCard ("Alım" side) both bind to
    // that hook.
    // NOTE: "Tahmini Bütçe (Segment)" intentionally OUT of the bulk
    // refresh. The entity is whole-tenant in scope (every segment ×
    // year × month combination) — fetching it for every refresh wastes
    // bandwidth + cache when only the SELECTED project's segment is
    // ever rendered (Veri Yönetimi "Tahmini Bütçe (Segment)" tab).
    // Now fetched on-demand by `useSegmentBudget(segment)` when the
    // user clicks a project.
    {
      label: "Satış Toplamları",
      run: async () => {
        // Sales aggregate scopes to the parent + sub-project IDs
        // already pulled (sub-projects carry their own customer invoice
        // rows under the same `mserp_etgtryprojid` FK). Chunked so the
        // `$apply=filter(IN(...))` URL stays small. Intercompany rows
        // excluded server-side.
        //
        // Financing-order rows can't be excluded on the server — F&O
        // rejects `not In(...)`, and the invoice-trans entity has no
        // `mserp_etgordertype` field to check (that lives on the
        // sales-table header). Workaround: include `mserp_salesid` in
        // the groupby key so the response carries one row per
        // (projid, currency, salesid). We then drop financing salesids
        // client-side and re-aggregate on (projid, currency) to match
        // the cache shape downstream consumers (composer's
        // salesActualUsd, dashboard rollups) expect.
        const projids = readAllScopedProjids();
        const result = await applyByInChunked<Record<string, unknown>>(
          client,
          SALES_ENTITY,
          "mserp_etgtryprojid",
          projids,
          (inClause) =>
            `filter((${inClause}) and (${NON_INTERCOMPANY_FILTER}))/groupby((mserp_etgtryprojid,mserp_currencycode,mserp_salesid),aggregate(mserp_lineamount with sum as total,$count as cnt))`
        );
        const financingSet = getFinancingSalesIdSet();
        // Re-aggregate on (projid, currency), dropping financing
        // salesids. Map key: `${projid}::${currency}`.
        const rolled = new Map<
          string,
          { projid: string; currency: string; total: number; cnt: number }
        >();
        for (const row of result.value) {
          const salesid = String(row.mserp_salesid ?? "");
          if (financingSet.has(salesid)) continue;
          const projid = String(row.mserp_etgtryprojid ?? "");
          const currency = String(row.mserp_currencycode ?? "");
          if (!projid) continue;
          const key = `${projid}::${currency}`;
          const total = Number(row.total) || 0;
          const cnt = Number(row.cnt) || 0;
          const existing = rolled.get(key);
          if (existing) {
            existing.total += total;
            existing.cnt += cnt;
          } else {
            rolled.set(key, { projid, currency, total, cnt });
          }
        }
        const reAggregated: Record<string, unknown>[] = [];
        for (const r of rolled.values()) {
          reAggregated.push({
            mserp_etgtryprojid: r.projid,
            mserp_currencycode: r.currency,
            total: r.total,
            cnt: r.cnt,
          });
        }
        writeCache("salesAggregateByProject", {
          fetchedAt: new Date().toISOString(),
          value: reAggregated,
        });
      },
    },
    // NOTE: "Proje × Ay Satış" intentionally REMOVED from the refresh
    // chain. The `salesByProjectMonth` cache it produced was written
    // every refresh but NEVER read by any consumer — pure dead weight
    // pulling tens of thousands of raw invoice rows for nothing. The
    // step took 60-90s after sub-project elevation (10+ parallel
    // chunks × heavy paginated `listAll`), making the whole refresh
    // feel hung. If a future dashboard surface ever needs a monthly
    // sales trend, add it as a server-side groupby aggregate
    // (`$apply=groupby((projid, year(date), month(date)), aggregate(...))`)
    // instead of pulling raw rows.
    // NOTE: "Gerçekleşen Gider Toplamları" intentionally OUT of the
    // refresh chain. The 4-stage rollup pipeline (inventdimb + dist +
    // expense-line + refmap) ran 1+ minute even with parallel chunks
    // and made the auto-refresh feel broken to users who don't open
    // the P&L Cost page. Now lazy-loaded by `useActualExpenseRollup`
    // when the P&L Cost page mounts, with a manual refresh button on
    // the page itself.
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.({ step: i + 1, totalSteps: steps.length, label: step.label });
    try {
      await step.run();
      completed.push(step.label);
    } catch (err) {
      return {
        ok: false,
        completedSteps: completed,
        failedStep: step.label,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
        projectCount,
      };
    }
  }

  // The Trade Cost rollup is derived from invoice + expense entities
  // that just changed underneath us. The rollup itself isn't part of
  // the refresh chain (it would add 1+ minute) — but leaving the old
  // snapshot in place after a successful refresh would let the user
  // see stale aggregates next time they open the page. Invalidating
  // the cache here means the next mount of `useActualExpenseRollup`
  // sees an empty snapshot, runs the lazy auto-fetch, and shows the
  // TYRO AI progress UI so the user knows it's recomputing.
  clearCache(ACTUAL_EXPENSE_ROLLUP_CACHE);

  return {
    ok: true,
    completedSteps: completed,
    durationMs: Date.now() - startedAt,
    projectCount,
  };
}
