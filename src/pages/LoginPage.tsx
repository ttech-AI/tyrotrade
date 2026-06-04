import * as React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ShipmentTrackingIcon,
  ChartLineData01Icon,
  RouteBlockIcon,
  AiBrain01Icon,
  LoginCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

// Lazy-load the 3D globe scene — keeps three.js + world-atlas out of
// the main bundle and shows a navy fallback while the chunk loads.
const GlobeScene = React.lazy(() => import("@/components/login/GlobeScene"));

interface LoginPageProps {
  /** Called when the CTA is pressed. When provided (e.g. by AuthGate),
   *  triggers the MSAL redirect flow instead of router navigation. */
  onLogin?: () => void;
  /** When true, the CTA button shows a spinner / disabled state — used
   *  while MSAL handles a redirect that hasn't completed yet. */
  isLoading?: boolean;
}

/**
 * tyrotrade — sinematik giriş ekranı.
 *
 * Sol panel: marka + slogan + 4-feature grid + MSAL CTA. Frosted glass
 * üzerine sky-navy gradient detaylar; logo'nun origami diliyle birebir
 * uyumlu palet (#7dd3fc → #2563eb → #1e3a8a).
 *
 * Sağ panel (lg+): `OrigamiVesselScene` — origami kargo gemisi + akan
 * ticaret rotaları, sky-navy radial gradient gökyüzü. Mobile altında
 * gizlenir (perf + ekran ekonomisi).
 *
 * Mount sequence (cinematic phased reveal):
 *   1. Logo + wordmark fade-in
 *   2. Sahne sağdan kayar
 *   3. Slogan slide-up
 *   4. Feature grid stagger
 *   5. CTA button slide-up
 * Tüm sequence ~1.6s. `prefers-reduced-motion` → tüm gecikmeler 0,
 * stagger yok.
 */
export function LoginPage({ onLogin, isLoading }: LoginPageProps = {}) {
  const reduce = useReducedMotion();
  const T = (delay: number) =>
    reduce
      ? { duration: 0 }
      : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const };

  // "Connecting…" transition: when the user clicks the CTA we show a
  // cinematic overlay (centred "tyroverse bağlanıyor" text + the globe
  // accelerating in the background) for ~1.8s before handing off to
  // MSAL's redirect. With no MSAL handler (mock mode) we still play
  // the transition for visual continuity, then navigate via `<Link>`.
  const [connecting, setConnecting] = React.useState(false);
  const handleConnect = React.useCallback(() => {
    if (connecting) return;
    setConnecting(true);
    if (onLogin) {
      window.setTimeout(() => onLogin(), reduce ? 0 : 1800);
    }
  }, [connecting, onLogin, reduce]);

  return (
    <div className="min-h-screen w-screen md:h-screen md:overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] bg-[#020617] text-foreground">
      {/* ── Left panel — brand + content + CTA ── */}
      {/* Vertical padding scales with viewport height (clamp on vh) so the
          whole panel always fits one screen at md+ — even at >100% zoom or
          short desktop windows — without scrolling. Horizontal padding stays
          fixed per breakpoint. */}
      <div className="relative flex flex-col px-4 sm:px-10 lg:px-16 py-4 md:py-[clamp(1rem,4vh,4rem)] z-[1] md:min-h-screen">
        {/* Subtle ambient glow behind content (only visible on mobile when
            scene is hidden) */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden pointer-events-none opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, rgba(56,189,248,0.18) 0%, transparent 60%)",
          }}
        />

        {/* Mobile-only mini scene at top — shorter so the CTA fits on
            375×667 without scrolling. */}
        <div className="md:hidden relative h-24 sm:h-36 -mx-4 sm:-mx-10 mb-3 rounded-b-3xl overflow-hidden">
          <SceneFallback>
            <GlobeScene accelerated={connecting || !!isLoading} />
          </SceneFallback>
        </div>

        {/* Brand — centred on mobile (with the globe overhead), anchored
            top-left from md+. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={T(0)}
          className="relative flex items-center gap-3 justify-center md:justify-start"
        >
          <Logo size={40} />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sky-400/80 font-semibold">
              Tiryaki
            </span>
            <span className="text-2xl font-extrabold tracking-tight lowercase">
              <span className="text-white">tyro</span>
              <span className="text-brand-gradient">trade</span>
            </span>
          </div>
        </motion.div>

        {/* Slogan + content — vertically centred in the remaining space
            on mobile (so the feature pill stack + CTA sit dead-centre)
            and from md+ where there's room. */}
        <div className="relative flex-1 flex flex-col justify-center max-w-md w-full mx-auto md:mx-0 mt-3 md:py-8">
          {/* Slogan + tagline — single line slogan on mobile (subtitle
              hidden), full block from md+ where there's room. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T(0.15)}
            className="mb-5 md:mb-[clamp(0.75rem,3vh,2.25rem)] text-center md:text-left"
          >
            <h1 className="text-[20px] sm:text-4xl md:text-[length:clamp(1.5rem,4.2vh,2.25rem)] font-bold tracking-tight leading-[1.2] text-white">
              Uluslararası{" "}
              <span className="text-brand-gradient">Tedarik Zinciri</span>{" "}
              Platformu<span className="text-sky-400">.</span>
            </h1>
            <p className="hidden md:block mt-[clamp(0.5rem,1.6vh,1rem)] text-[13.5px] sm:text-[15px] text-slate-400 leading-relaxed">
              Tedarikten teslimata, uluslararası ticaretin tüm operasyon
              süreçlerini tek panelden yönet.
            </p>
          </motion.div>

          {/* Feature list — vertical pill stack on mobile (icon + title
              over subtitle), classic 2×2 grid from md+. */}
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.3 },
              },
            }}
            className="flex flex-col gap-1.5 md:grid md:grid-cols-2 md:gap-[clamp(0.5rem,1.4vh,0.625rem)] mb-5 md:mb-[clamp(0.75rem,3vh,2.5rem)]"
          >
            {FEATURES.map((f) => (
              <FeatureCell key={f.title} {...f} />
            ))}
          </motion.ul>

          {/* CTA */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T(0.7)}
          >
            {/* CTA — when AuthGate passes `onLogin` we trigger the MSAL
                redirect; otherwise (mock mode / standalone preview) we
                fall back to router-based navigation into the app. */}
            <Button
              asChild={!onLogin && !connecting}
              onClick={onLogin ? handleConnect : undefined}
              disabled={isLoading || connecting}
              size="lg"
              className="w-full h-12 rounded-xl text-[16px] font-semibold relative overflow-hidden group disabled:opacity-70 disabled:cursor-wait tracking-tight"
              style={{
                // Deep navy gradient — lets the sky-navy "verse" text
                // gradient on the wordmark stand out against it.
                background:
                  "linear-gradient(135deg, #0c1a3e 0%, #1e3a8a 55%, #1e40af 100%)",
                color: "white",
                border: "1px solid rgba(56,189,248,0.35)",
                boxShadow:
                  "0 10px 32px -8px rgba(37,99,235,0.55), inset 0 1px 0 0 rgba(255,255,255,0.18)",
              }}
            >
              {onLogin ? (
                <span className="inline-flex items-center justify-center gap-2 w-full">
                  <Logo size={20} className="relative z-[1]" />
                  <span className="relative z-[1] lowercase">
                    <span className="text-white">tyro</span>
                    <span
                      style={{
                        color: "#38bdf8",
                        fontWeight: 700,
                      }}
                    >
                      verse
                    </span>
                    <span className="text-white"> ile bağlan</span>
                  </span>
                  <HugeiconsIcon
                    icon={LoginCircle02Icon}
                    size={18}
                    strokeWidth={2.5}
                    className="relative z-[1] transition-transform group-hover:translate-x-1"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700"
                  />
                </span>
              ) : (
                <Link to="/projects" className="lowercase">
                  <Logo size={20} className="relative z-[1]" />
                  <span className="relative z-[1]">
                    <span className="text-white">tyro</span>
                    <span
                      style={{
                        color: "#38bdf8",
                        fontWeight: 700,
                      }}
                    >
                      verse
                    </span>
                    <span className="text-white"> ile bağlan</span>
                  </span>
                  <HugeiconsIcon
                    icon={LoginCircle02Icon}
                    size={18}
                    strokeWidth={2.5}
                    className="relative z-[1] transition-transform group-hover:translate-x-1"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700"
                  />
                </Link>
              )}
            </Button>
            <p className="hidden md:block mt-3 text-[11px] text-slate-500 text-center">
              Yetkili Tiryaki kullanıcıları için. Erişim yoksa{" "}
              <span className="text-sky-400 underline decoration-dotted">
                BT ekibiyle
              </span>{" "}
              iletişime geç.
            </p>
          </motion.div>
        </div>

        {/* Footer — pinned to the very bottom of the viewport on mobile
            so the centred content above doesn't push it. */}
        <div className="relative text-[10px] sm:text-[10.5px] text-slate-600 text-center md:text-left mt-3">
          © {new Date().getFullYear()} TTECH Business Solutions · TYRO AI
        </div>
      </div>

      {/* ── Right panel — origami vessel scene (md+ desktop) ── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative hidden md:block w-full h-full min-h-0 overflow-hidden"
      >
        <SceneFallback>
          <GlobeScene accelerated={connecting} />
        </SceneFallback>

        {/* Soft left edge fade so the scene blends into the left panel */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, #020617 0%, transparent 100%)",
          }}
        />
      </motion.div>

      {/* Connection transition overlay — full-screen frosted black with
          centred "tyroverse bağlanıyor" text. Plays for ~1.8s while the
          globe accelerates in the background, then MSAL redirect fires. */}
      <ConnectionOverlay visible={connecting || !!isLoading} />
    </div>
  );
}

/* ─────────── Connection transition overlay ─────────── */

function ConnectionOverlay({ visible }: { visible: boolean }) {
  const isMobile = useIsMobile();
  const portalSize = isMobile ? 80 : 96; // px — size-20 vs size-24
  const logoSize = isMobile ? 44 : 56;
  const ringScaleMax = isMobile ? 1.8 : 2.2;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="fixed inset-0 z-[50] flex items-center justify-center"
    >
      {/* Backdrop blur — gives the impression the page is "lifting off" */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.92) 80%)",
        }}
      />

      {/* Centre stage */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Animated logo + portal ring */}
        <div className="relative">
          <motion.div
            animate={visible ? { rotate: 360, scale: [1, 1.08, 1] } : {}}
            transition={{
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="rounded-full grid place-items-center"
            style={{
              width: portalSize,
              height: portalSize,
              background:
                "radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)",
              boxShadow:
                "0 0 60px 0 rgba(56,189,248,0.45), inset 0 0 0 1px rgba(125,211,252,0.4)",
            }}
          >
            <Logo size={logoSize} />
          </motion.div>

          {/* Outer expanding rings */}
          {visible &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ opacity: 0.65, scale: 0.7 }}
                animate={{ opacity: 0, scale: ringScaleMax }}
                transition={{
                  duration: 2.4,
                  delay: i * 0.7,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                className="absolute inset-0 rounded-full"
                style={{
                  border: "1px solid rgba(125,211,252,0.55)",
                }}
              />
            ))}
        </div>

        {/* Wordmark with shimmer */}
        <div className="text-2xl sm:text-3xl font-bold tracking-tight lowercase relative text-center px-4">
          <span className="text-white">tyro</span>
          <span style={{ color: "#38bdf8" }}>verse</span>{" "}
          <span className="text-slate-300">bağlanıyor</span>
          <motion.span
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="text-sky-300"
          >
            …
          </motion.span>
        </div>

        <div className="text-[11px] sm:text-[12px] text-slate-500 tracking-wide text-center px-6">
          Microsoft kimlik doğrulamasına yönlendiriliyorsun
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────── Feature cell ─────────── */

interface Feature {
  icon: typeof ShipmentTrackingIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: ShipmentTrackingIcon,
    title: "Uluslararası Proje Takibi",
    body: "Proje, gemi pozisyonu ve milestone zaman çizelgesi",
  },
  {
    icon: ChartLineData01Icon,
    title: "KPI & P/L",
    body: "Segment bütçesi vs gerçekleşen satış karşılaştırması",
  },
  {
    icon: RouteBlockIcon,
    title: "Liman & Rota",
    body: "Yükleme-tahliye limanları, sefer rotası takibi",
  },
  {
    icon: AiBrain01Icon,
    title: "TYRO AI",
    body: "Yapay zeka asistanına doğal dilde soru sor",
  },
];

/** Suspense + dark navy radial fallback shown while the 3D globe
 *  chunk is being fetched. Matches the final scene's background so the
 *  hand-off is invisible. */
function SceneFallback({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        // Deep-space backdrop: pure black base + a faint cool nebula
        // smear so the canvas doesn't read as flat. Renders behind the
        // globe canvas, visible at the edges where the planet halo
        // fades out.
        background:
          "radial-gradient(ellipse at 50% 35%, rgba(30,58,138,0.25) 0%, rgba(12,26,62,0.35) 35%, #020617 75%), #000000",
      }}
    >
      {/* Subtle nebula highlight in the upper-right — extra colour
          variation that mimics distant deep-space gas clouds. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(56,189,248,0.12) 0%, transparent 35%), radial-gradient(circle at 25% 75%, rgba(99,102,241,0.10) 0%, transparent 40%)",
        }}
      />
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </div>
  );
}

function FeatureCell({ icon, title, body }: Feature) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      // Mobile: horizontal pill (icon left, title + subtitle stacked
      // right). md+: classic 2-col card (icon over title over subtitle).
      className={cn(
        "group hover:bg-white/[0.03] transition-colors",
        "flex items-center gap-2.5 px-3 py-2 rounded-full",
        "md:block md:px-3 md:py-[clamp(0.5rem,1.6vh,0.75rem)] md:rounded-xl"
      )}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(56,189,248,0.12)",
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        className={cn(
          "size-7 rounded-lg grid place-items-center shrink-0",
          "md:size-8 md:mb-2"
        )}
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(37,99,235,0.18) 100%)",
          border: "1px solid rgba(56,189,248,0.25)",
        }}
      >
        <HugeiconsIcon
          icon={icon}
          size={16}
          strokeWidth={2}
          style={{ color: "#7dd3fc" }}
        />
      </div>
      <div className="min-w-0 flex-1 md:flex-initial">
        <div className="text-[12.5px] font-semibold text-white tracking-tight leading-tight">
          {title}
        </div>
        <div className="text-[10.5px] text-slate-400 leading-snug mt-0.5 line-clamp-1 md:line-clamp-2">
          {body}
        </div>
      </div>
    </motion.li>
  );
}
