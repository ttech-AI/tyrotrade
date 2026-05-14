import * as React from "react";
import { shouldUseMock } from "@/lib/dataverse";
import { useRealProjects } from "./useRealProjects";
import type { Project } from "@/lib/dataverse/entities";

export interface UseProjectsResult {
  projects: Project[];
  /** True only in real-mode when the project header cache slot is missing. */
  isEmpty: boolean;
  /** Most recent project header fetch timestamp (real mode only). */
  fetchedAt: string | null;
}

// Module-level cache so the 1.6 MB mock chunk is loaded once and reused
// across all hook instances and navigations.
let _mockCache: Project[] | null = null;
let _mockLoadPromise: Promise<Project[]> | null = null;

function loadMock(): Promise<Project[]> {
  if (_mockCache) return Promise.resolve(_mockCache);
  if (!_mockLoadPromise) {
    _mockLoadPromise = import("@/mocks/projects").then((m) => {
      _mockCache = m.mockProjects;
      return m.mockProjects;
    });
  }
  return _mockLoadPromise;
}

/**
 * 🔒 Read-only hook: returns the active project list.
 *
 * - Mock mode (`VITE_USE_MOCK=true`): loads the synthetic `mockProjects`
 *   lazily so the 1.6 MB chunk stays out of the main bundle. In production
 *   builds (VITE_USE_MOCK=false) Vite dead-code-eliminates the dynamic
 *   import entirely — the chunk is never bundled.
 * - Real mode: hydrates the 5 cached Dataverse entity arrays from
 *   localStorage (populated by Data Management page) and runs the
 *   `composeProjects` derivation. `isEmpty=true` when the project header
 *   cache hasn't been fetched yet — UI should show ProjectsEmptyState.
 */
export function useProjects(): UseProjectsResult {
  // Hooks must be called unconditionally per React rules.
  const real = useRealProjects();
  const [mockProjects, setMockProjects] = React.useState<Project[]>(
    () => _mockCache ?? []
  );

  React.useEffect(() => {
    // In production builds (VITE_USE_MOCK=false) Vite replaces this env
    // reference with the literal "false", making the block dead code that
    // Rollup removes — the mock chunk is never referenced in the bundle.
    if (import.meta.env.VITE_USE_MOCK === "false") return;
    let cancelled = false;
    loadMock().then((projects) => {
      if (!cancelled) setMockProjects(projects);
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (shouldUseMock()) {
    return { projects: mockProjects, isEmpty: false, fetchedAt: null };
  }
  return {
    projects: real.projects,
    isEmpty: real.isEmpty,
    fetchedAt: real.fetchedAt.projects,
  };
}
