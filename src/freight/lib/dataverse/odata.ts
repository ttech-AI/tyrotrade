/**
 * Fluent OData v4 query builder.
 *
 * Read-only by design — only `$filter`, `$select`, `$expand`, `$orderby`,
 * `$top`, `$skip` are supported. Mutation params have no place here because
 * the app never writes to Dataverse.
 *
 * Usage:
 *   const q = OData.filter("tryk_status eq 'Açık'")
 *     .expand("tryk_lines,tryk_vesselplan")
 *     .orderby("tryk_projectdate desc")
 *     .top(50)
 *     .build();
 *   //  => { $filter: "...", $expand: "...", $orderby: "...", $top: 50 }
 */

export interface ODataQuery {
  $filter?: string;
  $select?: string;
  $expand?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  /** Server-side `$count=true` — returns total count alongside `value[]`. */
  $count?: boolean;
  /** Server-side aggregation pipeline — e.g.
   *  `filter(...)/groupby((field),aggregate($count as cnt,total with sum as t))`.
   *  Used for the per-project sales-total query so a single request returns
   *  all 320 projects' invoiced totals instead of 2,400 raw rows. */
  $apply?: string;
}

class ODataBuilder {
  private q: ODataQuery = {};

  filter(expr: string): this {
    // Compose multiple filters with AND if called repeatedly.
    this.q.$filter = this.q.$filter
      ? `(${this.q.$filter}) and (${expr})`
      : expr;
    return this;
  }

  select(...fields: string[]): this {
    this.q.$select = fields.join(",");
    return this;
  }

  expand(expr: string): this {
    this.q.$expand = expr;
    return this;
  }

  orderby(expr: string): this {
    this.q.$orderby = expr;
    return this;
  }

  top(n: number): this {
    this.q.$top = n;
    return this;
  }

  skip(n: number): this {
    this.q.$skip = n;
    return this;
  }

  count(enable = true): this {
    this.q.$count = enable;
    return this;
  }

  /** Return the plain query object for the client to serialize. */
  build(): ODataQuery {
    return { ...this.q };
  }

  /** URL-encoded `?$filter=...&$top=...` string. */
  toQueryString(): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(this.q)) {
      if (v === undefined || v === null || v === "") continue;
      parts.push(`${k}=${encodeURIComponent(String(v))}`);
    }
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }
}

/** Entry point — `OData.filter(...).expand(...).build()` */
export const OData = {
  filter: (expr: string) => new ODataBuilder().filter(expr),
  select: (...fields: string[]) => new ODataBuilder().select(...fields),
  expand: (expr: string) => new ODataBuilder().expand(expr),
  orderby: (expr: string) => new ODataBuilder().orderby(expr),
  top: (n: number) => new ODataBuilder().top(n),
  skip: (n: number) => new ODataBuilder().skip(n),
  count: () => new ODataBuilder().count(),
  /** Empty builder — for incremental construction */
  empty: () => new ODataBuilder(),
};

/**
 * Helper: build a `?$param=...&...` query string from a plain ODataQuery
 * (for the real fetch client).
 */
export function odataQueryString(q?: ODataQuery): string {
  if (!q) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}
