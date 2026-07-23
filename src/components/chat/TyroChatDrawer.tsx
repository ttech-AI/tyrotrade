import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Trash2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Robot01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import { ProjectWebChat, type ProjectContext, type UserContext } from "./ProjectWebChat";
import { useChatWidth } from "./useChatWidth";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

interface TyroChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectContext?: ProjectContext;
  userContext?: UserContext;
}

/**
 * Right-side drawer that hosts the Copilot Studio agent via
 * botframework-webchat (Direct Line). When `projectContext` is
 * provided the agent automatically receives the current project ID and
 * name so it can answer project-scoped questions without the user
 * having to repeat themselves.
 */
export function TyroChatDrawer({
  open,
  onOpenChange,
  projectContext,
  userContext,
}: TyroChatDrawerProps) {
  const t = useT();
  const features: string[] = [
    t("ai.copilot.feature.shipments"),
    t("ai.copilot.feature.finance"),
    t("ai.copilot.feature.ports"),
  ];

  // Lazy-mount the webchat — only starts connecting after the first open.
  // Stays mounted afterwards so subsequent re-opens skip the cold-start.
  const [hasOpened, setHasOpened] = React.useState(false);
  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // One-time onboarding overlay — dismissed by the primary CTA.
  // Stays dismissed while the drawer remains mounted.
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  const [chatKey, setChatKey] = React.useState(0);
  const clearChat = React.useCallback(() => {
    sessionStorage.removeItem("tyro:chat:session");
    setChatKey((k) => k + 1);
    setOverlayVisible(false);
  }, []);

  // Drag-to-resize width (shared with the desktop panel via localStorage).
  const { width, reset: resetWidth, startResize } = useChatWidth();


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideOverlay
        side="right"
        // Inline width beats the sheet variant's `w-3/4 sm:max-w-sm`; maxWidth
        // caps it at 95vw so it never fully covers the app.
        style={{ width, maxWidth: "95vw" }}
        className={cn(
          "w-full p-0 flex flex-col gap-0 overflow-hidden",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        {/* Resize handle — drag the left edge to widen/narrow; double-click
            to reset to the default width. Hidden on mobile (full-width). */}
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Sohbet genişliğini ayarla"
          className="group absolute left-0 top-0 z-50 hidden h-full w-2 cursor-col-resize sm:block"
        >
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-[#6366f1]"
          />
        </div>

        {/* Top accent bar */}
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: TYRO_CHAT_TONE.gradient }}
        />

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-10 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
            style={{
              background: TYRO_CHAT_TONE.gradient,
              boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            {/* Match the topbar TyroChatButton's `Robot01Icon` so the
                drawer header reads as "the same brand mark, just
                expanded" instead of swapping to a different glyph
                once the drawer opens. */}
            <HugeiconsIcon icon={Robot01Icon} size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[16px] font-semibold tracking-tight leading-tight">
              TYRO Chat
            </SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              {projectContext
                ? projectContext.projectName
                : t("ai.subtitle")}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={clearChat}
            title={t("ai.copilot.clear.aria")}
            className="shrink-0 size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/* Body — webchat + onboarding overlay */}
        <div className="flex-1 min-h-0 bg-white relative">
          {hasOpened ? (
            <>
              {/* WebChat panel — mounts immediately so the Direct Line
                  handshake starts in the background while the user
                  reads the onboarding overlay. */}
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-300",
                  overlayVisible ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
              >
                <ProjectWebChat key={chatKey} projectContext={projectContext} userContext={userContext} />
              </div>

              <AnimatePresence>
                {overlayVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "absolute inset-0 z-10 flex flex-col items-center",
                      "px-6 py-10",
                      "bg-white/98 backdrop-blur-sm"
                    )}
                  >
                    <motion.span
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.08,
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="size-16 rounded-2xl grid place-items-center shadow-sm text-white relative"
                      style={{
                        background: TYRO_CHAT_TONE.gradient,
                        boxShadow: `0 8px 22px -6px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
                      }}
                    >
                      <HugeiconsIcon
                        icon={Robot01Icon}
                        size={30}
                        strokeWidth={1.75}
                      />
                      <span
                        aria-hidden
                        className="absolute -inset-1.5 rounded-3xl pointer-events-none"
                        style={{
                          boxShadow: `0 0 0 1px ${TYRO_CHAT_TONE.ring}`,
                          opacity: 0.35,
                        }}
                      />
                    </motion.span>

                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.4 }}
                      className="text-center mt-5"
                    >
                      <h3 className="text-[18px] font-bold tracking-tight text-slate-900 leading-tight">
                        {t("ai.copilot.welcome.title")}
                      </h3>
                      {projectContext ? (
                        <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed max-w-[320px] mx-auto">
                          <span className="font-semibold text-slate-700">
                            {projectContext.projectName}
                          </span>{" "}
                          {t("ai.copilot.welcome.projectDesc")}
                        </p>
                      ) : (
                        <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed max-w-[320px] mx-auto">
                          {t("ai.copilot.welcome.desc")}
                        </p>
                      )}
                    </motion.div>

                    <motion.ul
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: {
                          transition: {
                            staggerChildren: 0.07,
                            delayChildren: 0.28,
                          },
                        },
                      }}
                      className="mt-6 w-full max-w-[320px] flex flex-col gap-2.5"
                    >
                      {features.map((feature) => (
                        <motion.li
                          key={feature}
                          variants={{
                            hidden: { opacity: 0, x: -8 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-start gap-2.5"
                        >
                          <span
                            className="size-5 rounded-full grid place-items-center shrink-0 mt-0.5"
                            style={{
                              background: "rgba(99,102,241,0.10)",
                              color: TYRO_CHAT_TONE.solid,
                            }}
                          >
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              size={11}
                              strokeWidth={2.5}
                            />
                          </span>
                          <span className="text-[12.5px] text-slate-700 leading-snug">
                            {feature}
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>

                    <div className="flex-1" />

                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      onClick={() => setOverlayVisible(false)}
                      className={cn(
                        "group relative inline-flex items-center justify-center gap-2",
                        "h-11 px-5 rounded-full text-[13.5px] font-semibold text-white",
                        "shadow-md hover:shadow-lg",
                        "ring-1 ring-white/15 hover:ring-white/30",
                        "transition-all duration-200",
                        "hover:scale-[1.02] active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        "overflow-hidden w-full max-w-[320px]"
                      )}
                      style={{
                        background: TYRO_CHAT_TONE.gradient,
                        boxShadow: `0 8px 22px -6px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                      }}
                    >
                      <span className="relative z-[1] tracking-tight">
                        {t("ai.copilot.cta")}
                      </span>
                      <ArrowRight className="relative z-[1] size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="h-full grid place-items-center text-[12px] text-muted-foreground">
              {t("ai.copilot.loading")}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
