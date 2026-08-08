import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import { useMsal } from "@azure/msal-react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon, Moon02Icon, Sun03Icon, VolumeHighIcon, VolumeMute02Icon } from "@hugeicons/core-free-icons"
import { TyroLogo } from "@/components/brand/TyroLogo"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"
import { useIsMobile } from "@/hooks/use-mobile"
import { isMsalConfigured, loginRequest, MOCK_LOGGED_IN_KEY } from "@/lib/msal"
import { clearSignedOut, isSignedOut, markSignedOut } from "@/lib/silentSso"
import { cn } from "@/lib/utils"

// Ocean Breeze v2 — the app's default brand colors. Values mirror the
// :root[data-palette="ocean-breeze-v2"] --brand-logo-1..5 tokens in index.css
// (kept literal here because the login page pins its own look regardless of
// the palette the user later picks in the app).
const BRAND_COLORS = {
  gradStart: "#48cae4",
  gradEnd: "#00b4d8",
  fillA: "#0077b6",
  fillB: "#00b4d8",
  fillC: "#03045e",
}

const BRAND_GRADIENT =
  "linear-gradient(135deg, #48cae4 0%, #00b4d8 50%, #0077b6 100%)"

const LOGIN_INIT_FLAG = "tyrotrade-login-initialized"
const LOGIN_MUTED_KEY = "tyrotrade-login-muted"

const VOICE_FILES = [
  "voiceassets/ElevenLabs_Britishv2.mp3",
  "voiceassets/ElevenLabs_britisv3.mp3",
]

function readMuted() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(LOGIN_MUTED_KEY) === "1"
}

const headlineParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18, delayChildren: 0.35 } },
}

const headlineLetter = {
  hidden: { opacity: 0, y: 40, filter: "blur(14px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(12px)",
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
}

export function LoginPage() {
  const { t } = useLocale()
  const { theme, setTheme } = useTheme()
  const { setLocale } = useLocale()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { instance } = useMsal()

  // phase: idle | listening | connecting | dissolving
  const [phase, setPhase] = useState("idle")
  const activityTimer = useRef(null)
  // Connect-flow timers (dissolve + loginRedirect). Held so they can be cleared on
  // unmount — otherwise a stale timer fires loginRedirect after the user left.
  const connectTimers = useRef([])

  // Voice greeting state
  const [muted, setMuted] = useState(readMuted)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const audioRef = useRef(null)
  const speakingTimer = useRef(null)
  // Latest-value ref for playGreeting so the mount-time effect (deps:[])
  // can call the current version without going stale.
  const playGreetingRef = useRef(() => {})

  const isDark = theme === "dark"
  // Single-phase handoff. Click → "dissolving":
  //   - chrome fades out in ~220ms (everything except the orb)
  //   - orb sits alone on stage at its natural size for a short breath
  //   - orb fades out as the TYRO scramble overlay materializes in its place
  //   - 4 cells cycle random ASCII glyphs then settle into T · Y · R · O
  //   - navigate at t=1.8s (well inside the user's 2s ceiling)
  // The orb itself does NOT scale — it stays at its original optical size
  // while the chrome rips out and the scramble takes over.
  const isSpinning = phase === "dissolving"
  // Same boolean, named for what it drives in the JSX: when true, all chrome
  // (header, headline, tagline, CTA, footer) fades out fast.
  const isConnecting = isSpinning
  // During handoff the orb stays in speaking visual so it pulses while it
  // fades — last-breath beat before it shatters into the scramble.
  const orbState = isSpinning
    ? "speaking"
    : isSpeaking
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : "idle"

  // First-time defaults: light + en (only on first ever login visit)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.localStorage.getItem(LOGIN_INIT_FLAG)) {
      setTheme("light")
      setLocale("en")
      window.localStorage.setItem(LOGIN_INIT_FLAG, "1")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track short viewports (laptops ≤ 820px height) so orb / spacing can shrink to fit
  const [isShortHeight, setIsShortHeight] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-height: 820px)").matches
  })
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(max-height: 820px)")
    const update = (e) => setIsShortHeight(e.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  // Track narrow viewports (phone + tablet, ≤ 1023px). The giant single-line
  // headline (nowrap, 18vw) only fits comfortably on true desktop; in the
  // 768–1023px band it ran edge-to-edge and clipped "TYRO" on the right. On
  // compact widths the headline wraps to two lines and shrinks so it always
  // fits. Single-line headline is desktop-only (≥ 1024px).
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 1023px)").matches
  })
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(max-width: 1023px)")
    const update = (e) => setIsCompact(e.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  // Very short viewports (≤ 680px height — e.g. 1024×600 laptops, split
  // screens). `isShortHeight` (≤820px) alone wasn't aggressive enough: the
  // orb + spacing pushed the CTA over the footer, making it unclickable. On
  // very short heights the orb and vertical spacing shrink further so the
  // whole stage + CTA fits above the footer.
  const [isVeryShort, setIsVeryShort] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-height: 680px)").matches
  })
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(max-height: 680px)")
    const update = (e) => setIsVeryShort(e.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  // Restart-on-call greeting playback. Used by the orb click handler AND
  // by the mount-time effect below (via playGreetingRef so the effect can
  // stay deps:[] and call the latest version). Tears down any in-flight
  // playback first so a click during the greeting jumps cleanly to a fresh
  // start instead of layering on top of itself.
  function playGreeting() {
    if (muted || isSpinning) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    setIsSpeaking(false)
    const pick = VOICE_FILES[Math.floor(Math.random() * VOICE_FILES.length)]
    const src = import.meta.env.BASE_URL + pick
    const audio = new Audio(src)
    audio.preload = "auto"
    audioRef.current = audio
    audio.addEventListener("ended", () => setIsSpeaking(false))
    audio.addEventListener("pause", () => setIsSpeaking(false))
    audio
      .play()
      .then(() => setIsSpeaking(true))
      .catch(() => {
        // Blocked (autoplay policy / file error). Null the ref so a later
        // gesture or orb click can retry with a fresh Audio instance.
        audioRef.current = null
      })
  }
  // Mirror the latest playGreeting into a ref so the mount-time effect
  // (deps:[]) reaches the current closure instead of a stale one.
  useEffect(() => {
    playGreetingRef.current = playGreeting
  })

  // ---------- Mount-time greeting: race 2s timer against first gesture ----------
  // Browsers (Chrome / Safari / Firefox) block autoplay until the page has
  // received a "user gesture". The Media Engagement Index makes the bar
  // fuzzy — repeat visitors who've played audio here before usually pass
  // the 2s timer, fresh visitors don't. That mismatch caused playback to
  // *sometimes* fire from the timer and sometimes not.
  //
  // Fix: race the 2s timer against the first real gesture (pointerdown /
  // keydown / touchstart). Whichever fires first unlocks playback. The
  // existing onMouseMove on the root drives the listening state but does
  // NOT count as a gesture per the spec, so we have to listen explicitly.
  useEffect(() => {
    if (muted) return
    let fired = false
    const removers = []

    const fire = () => {
      if (fired) return
      fired = true
      playGreetingRef.current()
      // First play attempted (success or fail). Drop the gesture listeners
      // so later clicks/keypresses don't re-trigger the mount-time path —
      // orb clicks are the only intentional replay surface from here on.
      removers.splice(0).forEach((fn) => fn())
    }

    const playTimer = setTimeout(fire, 2000)
    const events = ["pointerdown", "keydown", "touchstart"]
    events.forEach((evt) => {
      const handler = () => fire()
      window.addEventListener(evt, handler, { passive: true })
      removers.push(() => window.removeEventListener(evt, handler))
    })

    return () => {
      clearTimeout(playTimer)
      removers.splice(0).forEach((fn) => fn())
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
      setIsSpeaking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Speaking level oscillation (drives orb scale during speak) ----------
  // Also oscillates during the dissolve handoff so the orb pulses *while*
  // it grows — without this, an audio-less click would scale a static orb.
  useEffect(() => {
    if (!isSpeaking && phase !== "dissolving") return
    speakingTimer.current = setInterval(() => {
      setSpeakingLevel(0.25 + Math.random() * 0.75)
    }, 95)
    return () => clearInterval(speakingTimer.current)
  }, [isSpeaking, phase])

  const effectiveLevel = isSpeaking || phase === "dissolving" ? speakingLevel : 0

  function handleToggleMute() {
    const next = !muted
    setMuted(next)
    if (next) {
      // Mute: stop playback + remember
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
      setIsSpeaking(false)
      window.localStorage.setItem(LOGIN_MUTED_KEY, "1")
    } else {
      window.localStorage.removeItem(LOGIN_MUTED_KEY)
    }
  }

  // ---------- Mouse movement → listening, stops → idle quickly ----------
  const triggerListening = useCallback(() => {
    setPhase((p) => {
      if (p === "connecting" || p === "dissolving") return p
      return "listening"
    })
    if (activityTimer.current) clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => {
      setPhase((p) => (p === "listening" ? "idle" : p))
    }, 350)
  }, [])

  useEffect(() => {
    const timers = connectTimers.current
    return () => {
      if (activityTimer.current) clearTimeout(activityTimer.current)
      timers.forEach(clearTimeout)
    }
  }, [])

  // bfcache: backing out of the Entra account picker restores this page
  // mid-"dissolving" — React state survives the restore, so the chrome sits at
  // opacity 0, the CTA is disabled and the fired timers won't come back. Reset
  // to idle explicitly so the page is interactive again.
  useEffect(() => {
    function handlePageShow(e) {
      if (!e.persisted) return
      connectTimers.current.forEach(clearTimeout)
      connectTimers.current.length = 0
      setPhase("idle")
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  async function handleConnect() {
    if (isSpinning) return
    if (activityTimer.current) clearTimeout(activityTimer.current)
    // Clear any fired-timer ids left over from previous failed attempts so
    // the array doesn't grow across retries. Mutate in place (length = 0)
    // rather than reassigning — the unmount cleanup captured this array
    // reference at mount, so reassigning would orphan new timer ids.
    connectTimers.current.forEach(clearTimeout)
    connectTimers.current.length = 0
    // Two-beat shatter handoff (see TyroScramble for timeline). Chrome
    // fades, orb inhales (260ms) then implodes (360ms) while 18 glyph
    // cells spawn inside the orb's footprint and drift inward to spell
    // "CONNECTING TO TYRO". Lock left-to-right at 46ms cadence, settle
    // with a micro-breath, navigate at t=2.38s.
    setPhase("dissolving")

    if (isMsalConfigured) {
      connectTimers.current.push(
        setTimeout(() => {
          // The ONE place the deliberate sign-out marker may be cleared: the
          // user explicitly clicked connect. Cleared here (not on cache hits)
          // so silent SSO works again on their next visit. If the redirect
          // fails to even START, the click didn't become a login — restore
          // the marker as it was so an abandoned attempt can't un-sign-out.
          const wasSignedOut = isSignedOut()
          clearSignedOut()
          instance.loginRedirect(loginRequest).catch((err) => {
            if (wasSignedOut) markSignedOut()
            console.warn("[MSAL] login failed:", err?.errorCode || err?.message || err)
            setPhase("idle")
            toast.error(t("login.error"))
          })
        }, 2380),
      )
      return
    }

    // Mock auth fallback
    connectTimers.current.push(
      setTimeout(() => {
        try {
          window.sessionStorage.setItem(MOCK_LOGGED_IN_KEY, "1")
          window.localStorage.removeItem(MOCK_LOGGED_IN_KEY)
          navigate("/dashboard")
        } catch (err) {
          console.warn("[mock-auth] navigate failed:", err?.message || err)
          setPhase("idle")
          toast.error(t("login.error"))
        }
      }, 2380),
    )
  }

  const orbSize = isMobile ? 170 : isVeryShort ? 150 : isShortHeight ? 200 : 280

  return (
    <div
      onMouseMove={triggerListening}
      className={cn(
        // Browser tabs use 100dvh (tracks the URL bar). pwa:h-screen overrides
        // to 100vh in installed standalone mode, where iOS miscomputes dvh on
        // the first paint and leaves a bottom gap until the first scroll — vh
        // is the stable full-screen height there. 100svh was the original
        // cause of the bottom white strip in the browser (sized to the
        // SMALLEST viewport even with the URL bar collapsed).
        "relative flex h-[100dvh] pwa:h-screen w-full flex-col overflow-hidden",
        isDark ? "bg-[#0c0c0c] text-[#D7E2EA]" : "bg-[#fafafa] text-[#1a1a1a]",
      )}
      style={{
        fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif',
        // PWA standalone safe-area: insets push content out of the status
        // bar (Dynamic Island / notch) and home indicator zones. Inline
        // env() guarantees the values land — Tailwind arbitrary-value
        // utilities with env() can occasionally be optimized away.
        // Browser tabs evaluate env() to 0, so layout is identical there.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Diagonal grain backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 40%, rgba(221,42,123,0.04) 100%)",
        }}
      />

      {/* Insta tinted radial glow (light mode) */}
      {!isDark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top right, rgba(254,218,119,0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(129,52,175,0.06), transparent 55%)",
          }}
        />
      )}

      {/* Border frame — also fades during handoff so the stage is just the orb. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: isConnecting ? 0 : 1 }}
        transition={{ duration: isConnecting ? 0.22 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute inset-0"
      >
        <div className={cn("absolute left-0 right-0 top-[76px] h-px sm:top-[92px]", isDark ? "bg-white/10" : "bg-black/10")} />
        <div className={cn("absolute left-0 right-0 bottom-[48px] h-px sm:bottom-[56px]", isDark ? "bg-white/10" : "bg-black/10")} />
        <div className={cn("absolute left-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />
        <div className={cn("absolute right-0 top-0 bottom-0 w-px", isDark ? "bg-white/[0.06]" : "bg-black/[0.06]")} />
      </motion.div>

      {/* TOP bar (in-flow, shrink-0) — fades out during the handoff so only
          the orb remains on the stage. */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={
          isConnecting
            ? { opacity: 0, y: -8, filter: "blur(6px)" }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{
          duration: isConnecting ? 0.22 : 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-20 flex h-[76px] shrink-0 items-center justify-between px-4 sm:h-[92px] sm:px-10 lg:px-14"
      >
        {/* Brand block left */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <TyroLogo size={36} className="size-[34px] shrink-0 sm:size-[42px]" themeColors={BRAND_COLORS} />
          <div className="flex min-w-0 flex-col leading-none">
            <span className={cn("inline-flex items-baseline text-lg font-bold tracking-tight sm:text-2xl", isDark ? "text-white" : "text-[#1a1a1a]")}>
              <span>tyro</span>
              <span
                style={{
                  backgroundImage: BRAND_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Trade
              </span>
            </span>
            <span
              className={cn("mt-1 hidden text-[10px] font-medium uppercase sm:mt-1.5 sm:inline", isDark ? "text-[#D7E2EA]/55" : "text-[#1a1a1a]/50")}
              style={{ letterSpacing: "0.18em" }}
            >
              {t("login.subBrand")}
            </span>
          </div>
        </div>

        {/* Controls right */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <LoginMuteToggle muted={muted} isDark={isDark} onToggle={handleToggleMute} />
          <LoginThemeToggle isDark={isDark} />
          <LoginLanguageToggle isDark={isDark} />
        </div>
      </motion.header>

      {/* MAIN STAGE (fills remaining viewport between header and footer) */}
      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 sm:px-10",
          // Tall viewports (1080p+) get ASYMMETRIC padding on purpose. The
          // giant headline is `absolute`, so it contributes nothing to the
          // flex height — justify-center balances orb + tagline + CTA only,
          // while the eye also weighs the ~220px headline. The result on a
          // 1920×1080 screen was a big gap under the header and a CTA nearly
          // touching the footer. A heavier bottom pad pulls the whole stack
          // up so the optical centre matches the geometric one. Short
          // viewports keep their tight symmetric padding — there the CTA is
          // fighting for room, not sitting in too much of it.
          isShortHeight ? "py-2 sm:py-3" : "pt-6 pb-14 sm:pt-10 sm:pb-24",
        )}
      >
        {/* Stage: headline behind, orb on top */}
        <div className="relative flex w-full items-center justify-center">
          <motion.h1
            initial="hidden"
            animate={isConnecting ? "exit" : "visible"}
            variants={headlineParent}
            aria-label="HI, I'M TYRO"
            className="pointer-events-none absolute inset-x-0 select-none text-center"
            style={{
              fontFamily: '"Kanit", "Inter Variable", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: isMobile
                ? "clamp(56px, 22vw, 100px)"
                : isCompact
                  ? "clamp(72px, 13vw, 150px)"
                  : isShortHeight
                    ? "clamp(80px, 14vw, 180px)"
                    : "clamp(96px, 18vw, 240px)",
              lineHeight: 0.92,
              letterSpacing: "-0.0023em",
              textTransform: "uppercase",
              whiteSpace: isCompact ? "normal" : "nowrap",
            }}
          >
            <motion.span
              variants={headlineLetter}
              className={cn(
                "inline-block bg-clip-text text-transparent",
                isDark
                  ? "bg-gradient-to-b from-white via-white/85 to-white/30"
                  : "bg-gradient-to-b from-[#1a1a1a] via-[#1a1a1a]/70 to-[#1a1a1a]/20",
              )}
            >
              {isCompact ? (
                <>
                  {t("login.headlineGreeting")}
                  <br />
                  {t("login.headlineBrand")}
                </>
              ) : (
                <>{t("login.headlineGreeting")}&nbsp;{t("login.headlineBrand")}</>
              )}
            </motion.span>
          </motion.h1>

          {/* Orb container — entrance fade-in for first paint. The orb itself
              never scales during the connect handoff; instead it fades out as
              the TYRO scramble overlay (rendered as a sibling inside this same
              wrapper so they share the optical center) cycles ASCII glyphs and
              settles into the brand text. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            onClick={playGreeting}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                playGreeting()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t("login.audio.replay")}
            className={cn(
              "relative z-10 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              !isSpinning && !muted && "cursor-pointer",
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {/* Orb — two-beat shatter on handoff (see workflow design spec):
                  Beat 1 INHALE  (0-260ms): scale 1.00→1.10, brightness 1.18
                  Beat 2 IMPLODE (260-620ms): scale 1.10→0.72, blur 0→16px,
                                              opacity 1→0
                  Beat 0 IDLE   : scale 1, brightness 1, no blur, opaque
                The keyframe arrays put each beat in its time slice via
                cubic-bezier curves. Without active=true, sits at idle. */}
            <motion.div
              animate={
                isConnecting
                  ? {
                      scale: [1, 1.1, 0.72],
                      opacity: [1, 1, 0],
                      filter: [
                        "brightness(1) blur(0px)",
                        "brightness(1.18) blur(0px)",
                        "brightness(1.18) blur(16px)",
                      ],
                    }
                  : { scale: 1, opacity: 1, filter: "brightness(1) blur(0px)" }
              }
              transition={{
                duration: 0.62,
                times: [0, 260 / 620, 1],
                ease: [0.32, 0, 0.67, 0],
              }}
              className="relative"
            >
              <PastelVoiceOrb state={orbState} level={effectiveLevel} size={orbSize} />
            </motion.div>

            {/* Backdrop bloom — Insta-tinted radial that fades in during
                the orb's inhale, peaks during the implode, holds through
                the scramble, and decays across the lock window. Sits
                behind the orb (z=-1) so it doesn't tint the glyphs. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1/2 -z-10 rounded-full"
              initial={{ opacity: 0 }}
              animate={{
                opacity: isConnecting ? [0, 0.55, 0.7, 0.7, 0.4, 0.25] : 0,
              }}
              transition={{
                duration: isConnecting ? 2.38 : 0.3,
                times: isConnecting ? [0, 0.11, 0.18, 0.56, 0.89, 1] : [0, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  "radial-gradient(circle at center, rgba(221,42,123,0.16) 0%, rgba(129,52,175,0.08) 45%, transparent 75%)",
                filter: "blur(20px)",
              }}
            />

            {/* TYRO scramble overlay — sits absolutely centered over the orb,
                only materializes during the handoff. Width can spill outside
                the orb's box (TYRO at display size is wider than the orb) but
                positioned dead-center so the optical anchor stays the same. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <TyroScramble active={isConnecting} isDark={isDark} />
            </div>
          </motion.div>
        </div>

        {/* Tagline + CTA — both fade out together when the handoff starts so
            only the orb remains on the stage. */}
        <motion.div
          animate={
            isConnecting
              ? { opacity: 0, y: 12, filter: "blur(6px)" }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{ duration: isConnecting ? 0.22 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative z-10 flex flex-col items-center text-center",
            isVeryShort
              ? "mt-2 gap-2 sm:mt-3 sm:gap-3"
              : isShortHeight
                ? "mt-4 gap-4 sm:mt-6 sm:gap-5"
                // Tightened from mt-10/gap-7: on a tall screen the orb, the
                // tagline and the CTA drifted apart enough to read as three
                // unrelated blocks instead of one centred composition.
                : "mt-5 gap-4 sm:mt-7 sm:gap-6",
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-w-3xl flex-col items-center gap-2 text-center"
          >
            <span className="inline-flex items-baseline text-lg font-bold tracking-tight sm:text-2xl">
              <span className={cn(isDark ? "text-white" : "text-[#1a1a1a]")}>TYRO</span>
              <span
                className="ml-1.5"
                style={{
                  backgroundImage: BRAND_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Trade
              </span>
            </span>
            <p
              className={cn(
                "text-sm leading-relaxed sm:text-xl",
                isDark ? "text-[#D7E2EA]/85" : "text-[#1a1a1a]/75",
              )}
            >
              {t("login.motto")}
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed sm:text-xl",
                isDark ? "text-[#D7E2EA]/85" : "text-[#1a1a1a]/75",
              )}
            >
              {t("login.mottoEnd")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <CtaButton
              onClick={handleConnect}
              disabled={isSpinning}
              label={t("login.cta")}
              isDark={isDark}
            />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer — fades out with the rest of the chrome during the handoff. */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={
          isConnecting
            ? { opacity: 0, y: 6, filter: "blur(4px)" }
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{
          duration: isConnecting ? 0.22 : 0.6,
          delay: isConnecting ? 0 : 1.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-10 flex h-[48px] shrink-0 items-center justify-center px-3 sm:h-[56px] sm:px-10"
      >
        <p className={cn("text-center text-[9px] tracking-[0.04em] sm:text-[11px]", isDark ? "text-[#D7E2EA]/50" : "text-[#1a1a1a]/45")}>
          {t("login.copyright")}
        </p>
      </motion.footer>

      {/* Screen-reader announcement for the handoff — visually hidden so the
          orb stays the sole focal point but assistive tech still hears that
          the system is authenticating. */}
      {isConnecting && (
        <span className="sr-only" aria-live="polite" aria-busy="true">
          {t("login.connectingTitle")}
        </span>
      )}

      {/* Backdrop dim — fades in as the orb grows so the orb's pastel bloom
          reads brighter against a slightly darker stage. Sits BEHIND the orb
          (z-0) so the orb stays the focal point. No text, no spinner, no
          logo — the orb itself is the transition. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: phase === "dissolving" ? 1 : 0 }}
        transition={{
          duration: phase === "dissolving" ? 1.2 : 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(10,22,40,0.55) 0%, rgba(10,22,40,0.85) 60%, rgba(10,22,40,0.95) 100%)"
            : "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(245,240,250,0.65) 60%, rgba(235,225,245,0.85) 100%)",
        }}
      />
    </div>
  )
}

// --- TYRO scramble (shatter handoff) ---

const SCRAMBLE_POOL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·:/\\|<>{}[]=+-_ΞΛΔΣΩΦ◆◇△▽"
const FINAL_TEXT = "CONNECTING TO TYRO"
const FINAL_CHARS = FINAL_TEXT.split("")
const SPACE_INDICES = new Set(
  FINAL_CHARS.map((c, i) => (c === " " ? i : -1)).filter((i) => i >= 0),
)
// Timeline (designed by the cinematic-connect-handoff-design workflow):
//   0-260   ms: chrome fades out + orb inhales (scale 1.10, brightness 1.18)
//   260-620 ms: orb implodes (scale 0.72, blur 16px, opacity 0)
//   300+i*14 ms: cell i spawns inside orb radius, drifts inward over 420 ms
//   620-1340 ms: all cells settled, scrambling random glyphs
//   1340+i*46 ms: cell i locks left-to-right (spaces lock instantly)
//   2120-2380 ms: locked text holds with a micro-breath, then navigate
const GLYPH_SPAWN_DELAY = 300
const GLYPH_STAGGER = 14
const GLYPH_SETTLE_DURATION = 420
const LOCK_START_MS = 1340
const LOCK_STEP_MS = 46
const SCRAMBLE_TICK_MS = 55

// Seeded Gaussian-ish offset per cell index so initial random positions
// stay stable across re-renders during the scramble (re-sampling would
// cause the inward-drift animation to flicker).
function gaussianOffset(seed) {
  const r1 = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
  const r2 = Math.abs(Math.sin(seed * 78.233) * 12345.6789) % 1
  const r3 = Math.abs(Math.sin(seed * 31.7172) * 91234.567) % 1
  return (r1 + r2 + r3) / 3
}

function TyroScramble({ active, isDark }) {
  const [chars, setChars] = useState(() =>
    FINAL_CHARS.map((c) => (c === " " ? " " : "")),
  )
  // Stable spawn offsets per cell — computed once and frozen via useMemo
  // (a ref read during render trips react-hooks/refs-in-render).
  const offsets = useMemo(
    () =>
      FINAL_CHARS.map((_, i) => ({
        x: (gaussianOffset(i + 1) - 0.5) * 2 * 100,
        y: (gaussianOffset(i + 101) - 0.5) * 2 * 26,
      })),
    [],
  )

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChars(FINAL_CHARS.map((c) => (c === " " ? " " : "")))
      return
    }
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setChars(
        FINAL_CHARS.map((finalChar, i) => {
          if (finalChar === " ") return " "
          const scrambleStart =
            GLYPH_SPAWN_DELAY + i * GLYPH_STAGGER + GLYPH_SETTLE_DURATION
          if (elapsed < scrambleStart) return ""
          const lockAt = LOCK_START_MS + i * LOCK_STEP_MS
          if (elapsed >= lockAt) return finalChar
          return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]
        }),
      )
    }, SCRAMBLE_TICK_MS)
    return () => clearInterval(interval)
  }, [active])

  return (
    <motion.div
      aria-hidden="true"
      className="select-none leading-none whitespace-nowrap"
      style={{
        fontFamily:
          '"JetBrains Mono Variable", "JetBrains Mono", "Geist Mono", "SF Mono", ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace',
        fontSize: "clamp(20px, 3.4vw, 44px)",
        fontWeight: 600,
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        fontVariantNumeric: "tabular-nums",
        textTransform: "uppercase",
      }}
      initial={{ letterSpacing: "0.18em", scale: 1 }}
      animate={
        active
          ? {
              letterSpacing: ["0.18em", "0.18em", "0.12em", "0.12em"],
              scale: [1, 1, 1, 1.012, 1],
            }
          : { letterSpacing: "0.18em", scale: 1 }
      }
      transition={{
        letterSpacing: {
          duration: 2.12,
          times: [0, LOCK_START_MS / 2120, 1, 1],
          ease: "linear",
        },
        scale: {
          duration: 2.38,
          times: [0, 0.91, 0.94, 0.97, 1],
          ease: [0.4, 0, 0.2, 1],
        },
      }}
    >
      {chars.map((c, i) => {
        if (SPACE_INDICES.has(i)) {
          return (
            <span
              key={i}
              aria-hidden="true"
              className="inline-block"
              style={{ width: "0.55ch" }}
            >
              {" "}
            </span>
          )
        }
        const locked = c === FINAL_CHARS[i] && c !== ""
        const off = offsets[i]
        return (
          <motion.span
            key={i}
            initial={{
              opacity: 0,
              scale: 0.55,
              x: off.x,
              y: off.y,
              filter: "blur(10px)",
            }}
            animate={
              active
                ? {
                    opacity: 0.85,
                    scale: 1,
                    x: 0,
                    y: 0,
                    filter: "blur(0px)",
                  }
                : { opacity: 0, filter: "blur(10px)" }
            }
            transition={{
              duration: GLYPH_SETTLE_DURATION / 1000,
              delay: (GLYPH_SPAWN_DELAY + i * GLYPH_STAGGER) / 1000,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="inline-block"
            style={{
              minWidth: "0.62ch",
              textAlign: "center",
              color: locked
                ? "transparent"
                : isDark
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(26,26,26,0.78)",
              backgroundImage: locked ? BRAND_GRADIENT : undefined,
              WebkitBackgroundClip: locked ? "text" : undefined,
              backgroundClip: locked ? "text" : undefined,
              WebkitTextFillColor: locked ? "transparent" : undefined,
              filter: locked
                ? "drop-shadow(0 0 3px rgba(221,42,123,0.22))"
                : "none",
              transition: "color 280ms ease-out, filter 320ms ease-out",
            }}
          >
            {c || " "}
          </motion.span>
        )
      })}
    </motion.div>
  )
}

// --- Controls ---

function LoginMuteToggle({ muted, isDark, onToggle }) {
  const { t } = useLocale()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? t("login.audio.unmute") : t("login.audio.mute")}
      title={muted ? t("login.audio.unmute") : t("login.audio.mute")}
      className={cn(
        "grid size-10 place-items-center rounded-full transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
    >
      <HugeiconsIcon icon={muted ? VolumeMute02Icon : VolumeHighIcon} className="size-[18px]" strokeWidth={1.6} />
    </button>
  )
}

function LoginThemeToggle({ isDark }) {
  const { toggle } = useTheme()
  const { t } = useLocale()
  const label = isDark ? t("header.toggleLight") : t("header.toggleDark")
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={cn(
        "grid size-10 place-items-center rounded-full transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
    >
      <HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} className="size-[18px]" strokeWidth={1.6} />
    </button>
  )
}

function LoginLanguageToggle({ isDark }) {
  const { locale, setLocale } = useLocale()
  const next = locale === "tr" ? "en" : "tr"
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`Switch to ${next.toUpperCase()}`}
      className={cn(
        "grid h-10 min-w-10 place-items-center rounded-full px-3 text-[11px] font-semibold uppercase transition",
        isDark
          ? "text-white/70 hover:bg-white/[0.06] hover:text-white"
          : "text-[#1a1a1a]/70 hover:bg-black/[0.04] hover:text-[#1a1a1a]",
      )}
      style={{ letterSpacing: "0.18em" }}
    >
      {next}
    </button>
  )
}

function CtaButton({ onClick, disabled, label, isDark }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "group relative inline-flex items-center gap-6 overflow-hidden rounded-lg border px-8 py-4 text-[13px] font-semibold uppercase tracking-[0.18em] transition-all duration-300",
        isDark
          ? "border-white/20 bg-transparent text-white hover:border-transparent"
          : "border-[#1a1a1a]/25 bg-transparent text-[#1a1a1a] hover:border-transparent hover:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: BRAND_GRADIENT }}
      />
      <span className="relative z-10 transition-colors duration-300 group-hover:text-white">
        {label}
      </span>
      <span
        className={cn(
          "relative z-10 grid size-8 shrink-0 place-items-center rounded-md border transition-all duration-300",
          isDark ? "border-white/30 group-hover:border-white/70" : "border-[#1a1a1a]/30 group-hover:border-white/70",
          "group-hover:bg-white/[0.12]",
        )}
      >
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          className="size-4 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white"
          strokeWidth={1.8}
        />
      </span>
    </motion.button>
  )
}
