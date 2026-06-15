import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Shown on Projects + Dashboard pages when `useProjects()` returns isEmpty
 * (real-mode + project header cache is missing). Points the user at the
 * Data Management page to populate the cache.
 */
export function ProjectsEmptyState() {
  const t = useT();
  return (
    <div className="h-full grid place-items-center px-4">
      <GlassPanel tone="default" className="rounded-2xl max-w-md w-full">
        <div className="px-6 py-8 text-center space-y-4">
          <div className="size-12 mx-auto rounded-2xl bg-amber-500/15 text-amber-700 grid place-items-center">
            <HugeiconsIcon
              icon={DatabaseIcon}
              size={24}
              strokeWidth={1.75}
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("proj.empty.title")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("proj.empty.bodyA")}
              <br />
              {t("proj.empty.bodyB")}{" "}
              <strong>{t("proj.empty.bodyRefresh")}</strong>
              {t("proj.empty.bodyC")}
            </p>
          </div>
          <Button asChild>
            <Link to="/data" className="gap-2 inline-flex items-center">
              <HugeiconsIcon
                icon={RefreshIcon}
                size={14}
                strokeWidth={2}
              />
              {t("proj.empty.cta")}
            </Link>
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
