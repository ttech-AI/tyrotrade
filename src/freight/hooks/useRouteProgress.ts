import * as React from "react";
import {
  computeRouteProgress,
  describeProgress,
  type RouteProgressInfo,
} from "@/freight/lib/routing/progress";
import type { Project } from "@/freight/lib/dataverse/entities";

/**
 * Returns route progress info for a project, recomputed every minute by default.
 */
export function useRouteProgress(
  project: Project | null,
  refreshMs = 60_000
): RouteProgressInfo {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  return React.useMemo(() => {
    if (!project?.vesselPlan) return { progress: 0, stage: "pre-loading" };
    return describeProgress(
      project.vesselPlan.milestones,
      project.vesselPlan.vesselStatus,
      now
    );
  }, [project, now]);
}

export { computeRouteProgress };
