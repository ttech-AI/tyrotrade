import type { DataverseClient } from "./client"
import { realDataverseClient } from "./realClient"

/**
 * The active Dataverse client.
 *
 * The source app shipped a mock client that was used whenever VITE_USE_MOCK
 * was unset — i.e. it FAILED OPEN into synthetic data. That is not carried
 * over: tyroTrade always talks to the real environment, so a missing env var
 * can never make these pages quietly display invented figures.
 *
 * 🔒 Read-only by construction — the DataverseClient interface exposes only
 * list() / listAll() / get(). Nothing here can write to Dataverse.
 */
export function getDataverseClient(): DataverseClient {
  return realDataverseClient
}

/** Kept so ported call sites compile; there is no mock mode any more. */
export function shouldUseMock(): boolean {
  return false
}

export { realDataverseClient }
export type { DataverseClient, DataverseListResponse } from "./client"
export { DataverseError, DataverseNotFoundError } from "./client"
export { OData, odataQueryString, type ODataQuery } from "./odata"
