import type { ODataQuery } from "./odata";

/**
 * 🔒 READ-ONLY Dataverse client contract.
 *
 * This interface deliberately exposes ONLY the GET surface (`list` + `get`).
 * The tyroFreight app never writes to Dataverse — no POST,
 * PATCH, PUT, DELETE under any circumstances. Implementations (mock or real)
 * MUST NOT add mutation methods. If a feature requires writing, that's a
 * conversation about whether this app is the right place for it (it's not).
 *
 * The real fetch implementation will be added in Phase G.3 / Phase E with:
 *   - MSAL token (Authorization: Bearer <token>)
 *   - 401 → silent token refresh + retry once
 *   - 429 → respect Retry-After header, exponential backoff, max 3 retries
 *   - Headers: OData-MaxVersion: 4.0, OData-Version: 4.0,
 *              Prefer: odata.include-annotations="*"
 */
export interface DataverseClient {
  /**
   * List one page of entries from an entity set with optional OData query
   * params. May return `nextLink` if results exceed Dataverse's page size
   * (default 5000). Use `listAll()` to walk all pages automatically.
   */
  list<T>(
    entitySet: string,
    query?: ODataQuery
  ): Promise<DataverseListResponse<T>>;

  /**
   * List ALL records, walking `@odata.nextLink` until exhausted. Returns
   * a single combined array. **No `$top` cap unless explicitly set in
   * `query.$top`** — use this when you want every row.
   *
   * Optional `onProgress` callback fires after each page so the UI can
   * show "X kayıt yüklendi…".
   */
  listAll<T>(
    entitySet: string,
    query?: ODataQuery,
    onProgress?: (loaded: number) => void
  ): Promise<DataverseListResponse<T>>;

  /**
   * Get a single record by ID with optional `$expand` / `$select`.
   */
  get<T>(entitySet: string, id: string, query?: ODataQuery): Promise<T>;
}

export interface DataverseListResponse<T> {
  value: T[];
  /** Server-side `$count=true` total (when requested). */
  totalCount?: number;
  /** OData `@odata.nextLink` for paginated results. */
  nextLink?: string;
}

/* ─────────── Errors ─────────── */

export class DataverseError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "DataverseError";
  }
}

export class DataverseNotFoundError extends DataverseError {
  constructor(entitySet: string, id: string) {
    super(`${entitySet}/${id} bulunamadı`, 404);
    this.name = "DataverseNotFoundError";
  }
}
