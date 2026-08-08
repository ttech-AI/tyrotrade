import {
  acquireDataverseToken,
  refreshDataverseToken,
} from "@/freight/lib/auth/acquireToken";
import {
  DataverseError,
  DataverseNotFoundError,
  type DataverseClient,
  type DataverseListResponse,
} from "./client";
import { odataQueryString, type ODataQuery } from "./odata";

/**
 * 🔒 Real Dataverse Web API client (read-only).
 *
 * - Auth: Bearer <token> from MSAL (`acquireDataverseToken`).
 * - On 401 → silent refresh + retry once.
 * - On 429 → respect `Retry-After`, exponential backoff, max 3 retries.
 * - Headers: OData-MaxVersion: 4.0, OData-Version: 4.0,
 *            Prefer: odata.include-annotations="*".
 *
 * 🔒 GET only. No `POST`/`PATCH`/`PUT`/`DELETE` methods exposed.
 */

const dataverseUrl = (import.meta.env.VITE_DATAVERSE_URL ?? "").replace(
  /\/$/,
  ""
);

const COMMON_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
  // Only include FormattedValue annotations (human-readable strings for
  // option sets / dates / lookups). Wildcard `"*"` would also bring back
  // `@odata.etag`, `@odata.type`, `@odata.context` etc. on EVERY row,
  // which inflates payload ~30% and pushes 5–10 MB localStorage caches
  // over quota for entities like lines (3286 rows) and budget (1267).
  Prefer:
    'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
};

interface DataverseListBody<T> {
  value: T[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

async function authedFetch(
  url: string,
  init: RequestInit = {},
  retryAfter401 = true,
  retryAfter429 = 3
): Promise<Response> {
  const token = await acquireDataverseToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(COMMON_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  const res = await fetch(url, { ...init, headers });

  // 401 — try silent refresh once, then retry
  if (res.status === 401 && retryAfter401) {
    try {
      await refreshDataverseToken();
      return authedFetch(url, init, false, retryAfter429);
    } catch {
      // Fall through and throw below
    }
  }

  // 429 — exponential backoff, respect Retry-After
  if (res.status === 429 && retryAfter429 > 0) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const waitMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : (4 - retryAfter429) * 1000; // 1s → 2s → 3s
    await new Promise((r) => setTimeout(r, waitMs));
    return authedFetch(url, init, retryAfter401, retryAfter429 - 1);
  }

  return res;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new DataverseError(
      `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      res.status,
      text.slice(0, 500)
    );
  }
}

/** Try to extract the human-readable error message Dataverse buries in
 *  its 400/403/etc payloads. The standard OData error envelope is
 *  `{ error: { code, message } }` but virtual entities sometimes send
 *  back `{ Message }` or `{ ExceptionMessage }` from the underlying
 *  F&O service — handle both shapes so the toast surfaces something
 *  diagnosable instead of bare `"400"`. */
function extractDataverseError(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  // Standard OData v4 envelope
  if (obj.error && typeof obj.error === "object") {
    const err = obj.error as Record<string, unknown>;
    const msg = err.message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  // F&O virtual entity / legacy fall-throughs
  if (typeof obj.Message === "string") return obj.Message;
  if (typeof obj.ExceptionMessage === "string") return obj.ExceptionMessage;
  if (typeof obj.message === "string") return obj.message;
  return undefined;
}

class RealDataverseClient implements DataverseClient {
  async list<T>(
    entitySet: string,
    query?: ODataQuery
  ): Promise<DataverseListResponse<T>> {
    if (!dataverseUrl) {
      throw new DataverseError("VITE_DATAVERSE_URL tanımlı değil");
    }
    const qs = odataQueryString(query);
    const url = `${dataverseUrl}/api/data/v9.2/${entitySet}${qs}`;

    const res = await authedFetch(url);
    if (!res.ok) {
      const body = await readJson<unknown>(res);
      const detail = extractDataverseError(body);
      throw new DataverseError(
        // Surface the real error message from the response body so the
        // refresh toast (and console) shows something actionable like
        // "Property mserp_tryshipprojid not found" instead of just 400.
        detail
          ? `${res.status} ${res.statusText} — ${detail}`
          : `Dataverse list failed: ${res.status} ${res.statusText}`,
        res.status,
        body
      );
    }

    const body = await readJson<DataverseListBody<T>>(res);
    return {
      value: body.value ?? [],
      totalCount: body["@odata.count"],
      nextLink: body["@odata.nextLink"],
    };
  }

  async listAll<T>(
    entitySet: string,
    query?: ODataQuery,
    onProgress?: (loaded: number) => void
  ): Promise<DataverseListResponse<T>> {
    if (!dataverseUrl) {
      throw new DataverseError("VITE_DATAVERSE_URL tanımlı değil");
    }

    // First page: standard list() call
    const first = await this.list<T>(entitySet, query);
    const all: T[] = [...first.value];
    onProgress?.(all.length);

    // When the caller set $top=N, stop after N records — don't keep walking
    // pagination past the requested cap. Without this guard, $top=10 + a
    // populated entity would still fetch every record because Dataverse
    // hands back nextLink even when the per-request slice is full.
    const topCap =
      typeof query?.$top === "number" && query.$top > 0 ? query.$top : null;
    if (topCap != null && all.length >= topCap) {
      return { value: all.slice(0, topCap), totalCount: first.totalCount };
    }

    // Walk @odata.nextLink until exhausted. Dataverse caps a single page
    // at 5000 by default — listAll() respects that and just keeps fetching.
    let nextLink = first.nextLink;
    while (nextLink) {
      const res = await authedFetch(nextLink);
      if (!res.ok) {
        const body = await readJson<unknown>(res);
        const detail = extractDataverseError(body);
        throw new DataverseError(
          detail
            ? `${res.status} ${res.statusText} — ${detail}`
            : `Dataverse listAll page failed: ${res.status} ${res.statusText}`,
          res.status,
          body
        );
      }
      const body = await readJson<DataverseListBody<T>>(res);
      all.push(...(body.value ?? []));
      onProgress?.(all.length);
      if (topCap != null && all.length >= topCap) {
        return { value: all.slice(0, topCap), totalCount: first.totalCount };
      }
      nextLink = body["@odata.nextLink"];
    }

    return {
      value: all,
      totalCount: first.totalCount,
    };
  }

  async get<T>(
    entitySet: string,
    id: string,
    query?: ODataQuery
  ): Promise<T> {
    if (!dataverseUrl) {
      throw new DataverseError("VITE_DATAVERSE_URL tanımlı değil");
    }
    const qs = odataQueryString(query);
    // Dataverse pattern: /entitySet(<id>)?$select=...
    const url = `${dataverseUrl}/api/data/v9.2/${entitySet}(${id})${qs}`;

    const res = await authedFetch(url);
    if (res.status === 404) {
      throw new DataverseNotFoundError(entitySet, id);
    }
    if (!res.ok) {
      const body = await readJson<unknown>(res);
      throw new DataverseError(
        `Dataverse get failed: ${res.status} ${res.statusText}`,
        res.status,
        body
      );
    }
    return readJson<T>(res);
  }
}

export const realDataverseClient: DataverseClient = new RealDataverseClient();
