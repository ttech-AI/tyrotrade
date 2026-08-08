import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CancelCircleIcon,
  HourglassIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/**
 * Premium "branded" toast bodies for the Dataverse refresh flow.
 *
 * Design language:
 * - Frosted popover surface, rounded-2xl, layered shadow.
 * - Thin gradient strip on the left edge (3px) carries the semantic
 *   accent without flooding the toast — "kararında yeşil".
 * - Icon pill (size-10) on the left:
 *     loading → tinted --success + hourglass + orbiting dot
 *     success → --success gradient + check
 *     error   → --destructive gradient + X
 * - Right text column: bold popover-foreground title + smaller
 *   muted-foreground detail.
 *
 * The green stays --success rather than the brand palette on purpose: it
 * signs "senkronizasyon sağlıklı", not "bu uygulamanın rengi".
 *
 * Used via `toast.custom(...)` from RefreshAllButton + DataverseLoginAutoRefresh.
 */

const SHELL =
  "relative flex items-center gap-3 min-w-[320px] max-w-[420px] " +
  "px-3.5 py-3 rounded-2xl overflow-hidden " +
  "bg-[color-mix(in_oklab,var(--popover)_97%,transparent)] backdrop-blur-xl backdrop-saturate-150 " +
  "border border-foreground/[0.06] " +
  "shadow-[0_18px_44px_-14px_color-mix(in_oklab,var(--foreground)_32%,transparent)]";

/* ─────────── Loading ─────────── */

interface RefreshLoadingToastProps {
  /** "Projeler" / "Gemi Planı" / etc — current step label */
  stepLabel?: string;
  /** 1-based current step index */
  current?: number;
  /** Total number of steps */
  total?: number;
}

/**
 * Hourglass center + orbiting success dot. Two counter-rotating
 * orbits give the "yörünge" feel without spinning the icon itself.
 */
export function RefreshLoadingToast({
  stepLabel,
  current,
  total,
}: RefreshLoadingToastProps) {
  return (
    <div className={SHELL}>
      {/* Left accent strip */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--success) 72%, white) 0%, var(--success) 100%)",
        }}
      />

      {/* Icon pill with orbital animation */}
      <div className="relative size-10 shrink-0 ml-1">
        {/* Hourglass core — soft --success tint over the card, --success stroke */}
        <span
          className="absolute inset-0 rounded-xl grid place-items-center"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--success) 22%, var(--card)) 0%, color-mix(in oklab, var(--success) 8%, var(--card)) 70%)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklab, var(--success) 22%, transparent), 0 2px 6px -2px color-mix(in oklab, var(--success) 20%, transparent)",
          }}
        >
          <motion.div
            animate={{ rotate: [0, 180, 360] }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.45, 1],
            }}
            className="text-success"
          >
            <HugeiconsIcon icon={HourglassIcon} size={16} strokeWidth={2} />
          </motion.div>
        </span>

        {/* Orbit 1 — clockwise, single dot at 12 o'clock */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute left-1/2 -top-0.5 -translate-x-1/2 size-1.5 rounded-full"
            style={{
              background: "var(--success)",
              boxShadow: "0 0 6px color-mix(in oklab, var(--success) 60%, transparent)",
            }}
          />
        </motion.div>

        {/* Orbit 2 — counter-clockwise, smaller dot at 6 o'clock */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 size-1 rounded-full"
            style={{
              background: "color-mix(in oklab, var(--success) 72%, white)",
              opacity: 0.85,
            }}
          />
        </motion.div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-popover-foreground leading-tight">
          Proje verileri güncelleniyor
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-1 truncate">
          {stepLabel ? (
            <>
              <span className="text-foreground font-medium">{stepLabel}</span>
              {typeof current === "number" && typeof total === "number" && (
                <>
                  <span className="text-muted-foreground/70 mx-1.5">·</span>
                  <span className="tabular-nums">
                    {current}/{total}
                  </span>
                </>
              )}
            </>
          ) : (
            "Bağlantı kuruluyor…"
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Success ─────────── */

interface RefreshSuccessToastProps {
  projectCount?: number;
  durationSec?: number;
  stepCount?: number;
}

export function RefreshSuccessToast({
  projectCount,
  durationSec,
  stepCount,
}: RefreshSuccessToastProps) {
  return (
    <div className={SHELL}>
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--success) 72%, white) 0%, color-mix(in oklab, var(--success) 82%, black) 100%)",
        }}
      />

      <span
        className="size-10 shrink-0 ml-1 rounded-xl grid place-items-center text-[var(--success-foreground)]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--success) 72%, white) 0%, var(--success) 55%, color-mix(in oklab, var(--success) 62%, black) 100%)",
          boxShadow:
            "0 4px 12px -2px color-mix(in oklab, var(--success) 45%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.30)",
        }}
      >
        <HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-popover-foreground leading-tight">
          Veriler başarıyla güncellendi
        </div>
        <div className="text-[11px] leading-tight mt-1 text-muted-foreground">
          {typeof projectCount === "number" && projectCount > 0 ? (
            <>
              <span className="font-bold tabular-nums text-success">
                {projectCount}
              </span>
              <span className="text-muted-foreground"> proje senkronlandı</span>
            </>
          ) : (
            <span className="text-muted-foreground">Senkronizasyon tamamlandı</span>
          )}
          {typeof durationSec === "number" && (
            <>
              <span className="text-muted-foreground/50 mx-1.5">·</span>
              <span className="tabular-nums">
                {durationSec.toFixed(1)} sn
              </span>
            </>
          )}
          {typeof stepCount === "number" && (
            <>
              <span className="text-muted-foreground/50 mx-1.5">·</span>
              <span className="tabular-nums">{stepCount} adım</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Error ─────────── */

interface RefreshErrorToastProps {
  stepLabel?: string;
  message?: string;
}

export function RefreshErrorToast({
  stepLabel,
  message,
}: RefreshErrorToastProps) {
  return (
    <div className={cn(SHELL)}>
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--destructive) 72%, white) 0%, color-mix(in oklab, var(--destructive) 85%, black) 100%)",
        }}
      />

      <span
        className="size-10 shrink-0 ml-1 rounded-xl grid place-items-center text-white"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--destructive) 72%, white) 0%, var(--destructive) 55%, color-mix(in oklab, var(--destructive) 65%, black) 100%)",
          boxShadow:
            "0 4px 12px -2px color-mix(in oklab, var(--destructive) 40%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.30)",
        }}
      >
        <HugeiconsIcon icon={CancelCircleIcon} size={18} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-popover-foreground leading-tight">
          Veri güncelleme başarısız
        </div>
        <div className="text-[11px] leading-tight mt-1 text-muted-foreground">
          {stepLabel && (
            <>
              <span className="font-medium text-destructive">{stepLabel}</span>
              <span className="text-muted-foreground/70"> adımında</span>
            </>
          )}
          {message && (
            <>
              {stepLabel && <span className="text-muted-foreground/50 mx-1">·</span>}
              <span
                className="text-muted-foreground break-words"
                title={message}
              >
                {message.slice(0, 240)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
