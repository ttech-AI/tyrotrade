import { useRealProjects } from "./useRealProjects"
import type { Project } from "@/freight/lib/dataverse/entities"

export interface UseProjectsResult {
  projects: Project[]
  /** True when the project header cache slot has never been filled. */
  isEmpty: boolean
  /** Most recent project header fetch timestamp. */
  fetchedAt: string | null
}

/**
 * 🔒 Read-only hook: the active project list.
 *
 * Hydrates the cached Dataverse entity arrays (filled by the Data Management
 * page's refresh) and runs the `composeProjects` derivation over them.
 * `isEmpty=true` means nothing has been fetched yet — callers show
 * ProjectsEmptyState, which points the user at Data Management.
 *
 * The source's mock branch (and its 75k-line synthetic dataset) is
 * deliberately not ported: it defaulted to ON whenever the env flag was
 * unset, which would have shown invented figures in production.
 */
export function useProjects(): UseProjectsResult {
  const real = useRealProjects()
  return {
    projects: real.projects,
    isEmpty: real.isEmpty,
    fetchedAt: real.fetchedAt.projects,
  }
}
