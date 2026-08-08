import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mic01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

function clampLevel(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function parsePercent(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// 5-bar waveform amplitude template (relative heights, center peak)
const WAVE_BARS = [0.35, 0.7, 1, 0.7, 0.35]

const PARTICLES = [
  { left: "34%", top: "24%", size: 2.2, color: "rgba(245,139,108,0.82)", delay: 0, drift: -10 },
  { left: "43%", top: "30%", size: 1.4, color: "rgba(229,111,142,0.64)", delay: 0.22, drift: 8 },
  { left: "51%", top: "21%", size: 1.7, color: "rgba(255,168,127,0.72)", delay: 0.54, drift: -8 },
  { left: "60%", top: "37%", size: 1.1, color: "rgba(164,92,223,0.56)", delay: 0.86, drift: 7 },
  { left: "32%", top: "57%", size: 1.1, color: "rgba(185,118,229,0.50)", delay: 1.1, drift: -6 },
  { left: "64%", top: "74%", size: 2.6, color: "rgba(255,255,255,0.95)", delay: 0.66, drift: -9 },
  { left: "49%", top: "51%", size: 1, color: "rgba(255,190,170,0.56)", delay: 1.42, drift: 6 },
  { left: "27%", top: "36%", size: 1.6, color: "rgba(255,178,132,0.62)", delay: 1.66, drift: -7 },
  { left: "70%", top: "47%", size: 0.9, color: "rgba(255,210,230,0.66)", delay: 1.9, drift: 5 },
]

export function PastelVoiceOrb({
  state = "idle",
  level = 0,
  size = 220,
  onClick,
  className,
  showIcon = false,
}) {
  const isListening = state === "listening"
  const isThinking = state === "thinking"
  const isSpeaking = state === "speaking"
  const isActive = isListening || isThinking || isSpeaking

  const lvl = clampLevel(level)
  const motionBoost = isThinking ? 1.25 : isSpeaking ? 1.15 : isListening ? 1.05 : 0.9
  const wrapperSize = Math.round(size * 1.78)
  const auraSize = Math.round(size * 1.45)
  // Aura blur scales linearly with size. Previous `max(22, size*0.13)` set a
  // 22 px floor, which on a 32 px header orb meant the aura (46 px) was 48 %
  // blurred — the colors smeared into a pale wash. Reduced floor to 6 px so
  // small header orbs keep their saturation; the big login/dashboard orbs
  // (size ≥ 170) hit the linear value (22+ px) so they're unaffected.
  const auraBlur = Math.max(6, Math.round(size * 0.13))

  // Outer aura animation
  const auraAnim = isActive
    ? { scale: [1, 1.13, 1], opacity: [0.54, 0.86, 0.54] }
    : { scale: [1, 1.055, 1], opacity: [0.42, 0.7, 0.42] }
  const auraDuration = isActive ? 1.18 : 3.8

  // Main orb scale
  let mainAnim
  let mainTransition = { duration: 3.8, repeat: Infinity, ease: "easeInOut" }
  if (isSpeaking) {
    mainAnim = { scale: 1 + lvl * 0.075 }
    mainTransition = { duration: 0.16, ease: "easeOut" }
  } else if (isListening) {
    mainAnim = { scale: [1, 1.04, 1] }
    mainTransition = { duration: 1.05, repeat: Infinity, ease: "easeInOut" }
  } else {
    mainAnim = { scale: [1, 1.018, 1] }
  }

  // Conic undercurrent
  const conicAnim = isThinking
    ? { rotate: [0, 360], scale: [1.02, 1.1, 1.02] }
    : { rotate: [0, 90, 0], scale: [1.02, 1.1, 1.02] }
  const conicTransition = isThinking
    ? {
        rotate: { duration: 7, repeat: Infinity, ease: "linear" },
        scale: { duration: 5.5 / motionBoost, repeat: Infinity, ease: "easeInOut" },
      }
    : {
        rotate: { duration: 9 / motionBoost, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 5.5 / motionBoost, repeat: Infinity, ease: "easeInOut" },
      }

  // Top lavender wave
  const topWaveAnim = isThinking
    ? {
        x: [0, 15, -10, 0],
        y: [0, 10, -5, 0],
        rotate: [8, 22, 4, 8],
        opacity: [0.48, 0.78, 0.52, 0.48],
        scaleX: [1, 1.1, 0.96, 1],
      }
    : {
        x: [0, 10, -5, 0],
        y: [0, 6, -3, 0],
        rotate: [8, 17, 4, 8],
        opacity: [0.44, 0.66, 0.46, 0.44],
        scaleX: [1, 1.1, 0.96, 1],
      }
  const topWaveDuration = isThinking ? 3.7 : 5.8 / motionBoost

  // Violet bloom upper-right
  const violetAnim = isThinking
    ? {
        x: [0, -17, 8, 0],
        y: [0, 15, -7, 0],
        opacity: [0.42, 0.68, 0.46, 0.42],
        scale: [1, 1.09, 0.98, 1],
      }
    : {
        x: [0, -11, 5, 0],
        y: [0, 10, -4, 0],
        opacity: [0.36, 0.58, 0.4, 0.36],
        scale: [1, 1.09, 0.98, 1],
      }
  const violetDuration = isThinking ? 3.9 : 5.7 / motionBoost

  // Lower-left warm glow
  const warmGlowAnim = isSpeaking
    ? {
        x: lvl * 16,
        y: -lvl * 18,
        opacity: 0.66 + lvl * 0.28,
        scale: 1 + lvl * 0.08,
      }
    : {
        x: [0, 15, -5, 0],
        y: [0, -15, 4, 0],
        opacity: [0.58, 0.86, 0.62, 0.58],
        scale: [1, 1.08, 0.98, 1],
      }
  const warmGlowTransition = isSpeaking
    ? { duration: 0.16, ease: "easeOut" }
    : { duration: 4.8 / motionBoost, repeat: Infinity, ease: "easeInOut" }

  // Shimmer
  const shimmerAnim = isThinking
    ? { x: ["-38%", "38%", "-38%"], opacity: [0.08, 0.34, 0.08] }
    : { x: ["-28%", "24%", "-28%"], opacity: [0.06, 0.2, 0.06] }
  const shimmerDuration = isThinking ? 2.9 : 6.5 / motionBoost

  // Bright bead
  const beadAnim = isSpeaking
    ? { scale: [1, 1 + lvl * 1.25, 1], opacity: [0.42, 0.95, 0.42], y: [0, -4, 0] }
    : { scale: [1, 1.75, 1], opacity: [0.42, 0.95, 0.42], y: [0, -4, 0] }

  const IconComp = isThinking ? SparklesIcon : Mic01Icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pastel voice assistant orb"
      className={cn(
        "relative grid place-items-center rounded-full bg-transparent p-0 outline-none",
        "appearance-none border-0",
        "focus-visible:ring-2 focus-visible:ring-brand-via/40",
        className,
      )}
      // Mobile defaults: kill iOS Safari's button background-fill and tap
      // highlight that otherwise render as a visible square behind the orb.
      style={{
        width: wrapperSize,
        height: wrapperSize,
        WebkitAppearance: "none",
        WebkitTapHighlightColor: "transparent",
        background: "transparent",
      }}
    >
      {/* 2. Outer Aura */}
      <motion.span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: auraSize,
          height: auraSize,
          filter: `blur(${auraBlur}px)`,
          background:
            "radial-gradient(circle at 42% 38%, rgba(255,255,255,0.95) 0%, rgba(var(--voiceorb-c5),0.82) 26%, rgba(var(--voiceorb-c2),0.54) 50%, rgba(var(--voiceorb-c1),0.36) 72%, rgba(255,255,255,0) 100%)",
        }}
        animate={auraAnim}
        transition={{ duration: auraDuration, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 3. Listening Ripples */}
      {isListening && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute rounded-full border border-pink-300/50"
              style={{ width: size * 1.05, height: size * 1.05 }}
              initial={{ scale: 0.94, opacity: 0.34 }}
              animate={{ scale: 1.72, opacity: 0 }}
              transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.36, ease: "easeOut" }}
            />
          ))}
        </>
      )}

      {/* 4. Main Orb Container.
          On iOS Safari, `overflow:hidden + border-radius:50%` fails to
          clip children that use mix-blend-mode or filter (Layers C/D/F
          use both) — the children "escape" through the corners and the
          orb-base appears as a tinted square behind the visible round.
          clip-path on the parent would fix the clip but ALSO clip the
          outer box-shadow halo, killing the orb's glow.
          The fix is structural: this outer span carries the bg + box-
          shadow (halo paints freely outside the circle), and an inner
          .clipped span holds the round mask + all the layers. */}
      <motion.span
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow:
            "0 28px 85px rgba(var(--voiceorb-c2),0.32), 0 16px 52px rgba(var(--voiceorb-c1),0.20)",
        }}
        animate={mainAnim}
        transition={mainTransition}
      >
        <span
          className="absolute inset-0 overflow-hidden rounded-full"
          aria-hidden="true"
          style={{
            background: "rgba(255,255,255,0.32)",
            boxShadow:
              "inset 0 0 22px rgba(255,255,255,0.64), inset 0 0 54px rgba(255,255,255,0.34)",
            // Belt-and-braces clip-path for iOS Safari which ignores the
            // overflow+border-radius pair when children use mix-blend-mode.
            clipPath: "circle(50% at 50% 50%)",
            WebkitClipPath: "circle(50% at 50% 50%)",
            isolation: "isolate",
          }}
        >
        {/* Layer A — Milky Base */}
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 34% 27%, rgba(255,255,255,0.99) 0%, rgba(255,250,252,0.92) 12%, rgba(var(--voiceorb-c5),0.82) 30%, rgba(var(--voiceorb-c2),0.55) 45%, rgba(var(--voiceorb-c2),0.50) 58%, rgba(var(--voiceorb-c1),0.74) 80%, rgba(var(--voiceorb-c4),0.68) 100%)",
          }}
          animate={{ opacity: [0.94, 1, 0.94], scale: [1, 1.025, 1] }}
          transition={{ duration: 4.2 / motionBoost, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer B — Liquid Conic Undercurrent */}
        <motion.span
          className="pointer-events-none absolute -inset-8 rounded-full"
          style={{
            opacity: 0.6,
            filter: "blur(18px)",
            mixBlendMode: "multiply",
            background:
              "conic-gradient(from 210deg at 50% 50%, rgba(255,255,255,0.35), rgba(var(--voiceorb-c2),0.50), rgba(var(--voiceorb-c1),0.54), rgba(var(--voiceorb-c1),0.36), rgba(var(--voiceorb-c2),0.42), rgba(255,255,255,0.35))",
          }}
          animate={conicAnim}
          transition={conicTransition}
        />

        {/* Layer C — Top Lavender Wave */}
        <motion.span
          className="pointer-events-none absolute"
          style={{
            left: "6%",
            top: "4%",
            width: "96%",
            height: "42%",
            filter: "blur(10px)",
            borderRadius: "54% 46% 60% 40% / 64% 48% 52% 36%",
            mixBlendMode: "multiply",
            background:
              "radial-gradient(ellipse at 48% 52%, rgba(var(--voiceorb-c2),0.60) 0%, rgba(var(--voiceorb-c2),0.42) 42%, rgba(255,255,255,0) 78%)",
          }}
          animate={topWaveAnim}
          transition={{ duration: topWaveDuration, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer D — Secondary Lavender Ribbon */}
        <motion.span
          className="pointer-events-none absolute"
          style={{
            left: "18%",
            top: "16%",
            width: "78%",
            height: "30%",
            filter: "blur(14px)",
            borderRadius: "48% 52% 44% 56% / 48% 58% 42% 52%",
            mixBlendMode: "multiply",
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(var(--voiceorb-c2),0.46) 0%, rgba(var(--voiceorb-c2),0.30) 38%, rgba(255,255,255,0) 78%)",
          }}
          animate={{
            x: [8, -11, 4, 8],
            y: [-2, 8, -6, -2],
            rotate: [-12, -4, -18, -12],
            opacity: [0.26, 0.48, 0.3, 0.26],
          }}
          transition={{ duration: 6.6 / motionBoost, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer E — Lower-left Warm Glow */}
        <motion.span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "-28%",
            bottom: "-27%",
            width: "103%",
            height: "103%",
            filter: "blur(10px)",
            mixBlendMode: "multiply",
            background:
              "radial-gradient(circle at 48% 46%, rgba(var(--voiceorb-c1),0.82) 0%, rgba(var(--voiceorb-c1),0.55) 38%, rgba(var(--voiceorb-c1),0.24) 64%, rgba(255,255,255,0) 80%)",
          }}
          animate={warmGlowAnim}
          transition={warmGlowTransition}
        />

        {/* Layer F — Lower-center Salmon Wash */}
        <motion.span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "15%",
            bottom: "-16%",
            width: "82%",
            height: "62%",
            filter: "blur(14px)",
            mixBlendMode: "multiply",
            background:
              "radial-gradient(ellipse at 50% 46%, rgba(var(--voiceorb-c4),0.56) 0%, rgba(var(--voiceorb-c4),0.32) 52%, rgba(255,255,255,0) 82%)",
          }}
          animate={{
            x: [0, -13, 8, 0],
            y: [0, -8, 5, 0],
            opacity: [0.42, 0.66, 0.46, 0.42],
            scaleX: [1, 1.14, 0.96, 1],
          }}
          transition={{ duration: 5.2 / motionBoost, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer G — Upper-right Violet Bloom */}
        <motion.span
          className="pointer-events-none absolute rounded-full"
          style={{
            right: "-24%",
            top: "-5%",
            width: "88%",
            height: "88%",
            filter: "blur(14px)",
            mixBlendMode: "multiply",
            background:
              "radial-gradient(circle at 45% 45%, rgba(var(--voiceorb-c3),0.54) 0%, rgba(var(--voiceorb-c2),0.38) 42%, rgba(255,255,255,0) 76%)",
          }}
          animate={violetAnim}
          transition={{ duration: violetDuration, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer I — Glass Highlight */}
        <motion.span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "7%",
            top: "16%",
            width: "70%",
            height: "36%",
            filter: "blur(16px)",
            background:
              "radial-gradient(ellipse at 40% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.26) 46%, rgba(255,255,255,0) 80%)",
          }}
          animate={{
            x: [0, 8, -4, 0],
            y: [0, -5, 4, 0],
            rotate: [-9, 8, -11, -9],
            opacity: [0.24, 0.46, 0.28, 0.24],
          }}
          transition={{ duration: 6.8 / motionBoost, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer J — Calm Shimmer */}
        <motion.span
          className="pointer-events-none absolute -inset-x-20 inset-y-0 rounded-full"
          style={{
            filter: "blur(7px)",
            background:
              "linear-gradient(105deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.34) 43%, rgba(255,255,255,0.08) 57%, rgba(255,255,255,0) 76%)",
          }}
          animate={shimmerAnim}
          transition={{ duration: shimmerDuration, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer K — Soft Edge Overlay (radial) */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 55%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0.48) 90%, rgba(255,255,255,0.68) 100%)",
          }}
        />
        {/* Layer K — Soft Edge Overlay (inset shadow) */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow:
              "inset 0 0 14px rgba(255,255,255,0.76), inset 0 0 38px rgba(255,255,255,0.28), inset 0 -16px 28px rgba(var(--voiceorb-c1),0.10)",
          }}
        />

        {/* Layer H — Bright Liquid Bead */}
        <motion.span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: "61%",
            top: "70%",
            width: "4.2%",
            height: "4.2%",
            filter: "blur(1px)",
            background: "rgba(255,255,255,0.86)",
            boxShadow:
              "0 0 13px rgba(255,255,255,0.72), 0 0 22px rgba(var(--voiceorb-c1),0.32)",
          }}
          animate={beadAnim}
          transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer L — Particles (listening/thinking: converge toward center) */}
        {PARTICLES.map((p, idx) => {
          let particleAnim
          let particleDuration
          if (isThinking || isListening) {
            // Convergence vector toward center (50%, 50%)
            const dx = ((50 - parsePercent(p.left)) * size) / 100
            const dy = ((50 - parsePercent(p.top)) * size) / 100
            particleAnim = {
              x: [0, dx * 0.85, 0],
              y: [0, dy * 0.85, 0],
              scale: [1, 0.6, 1],
              opacity: [0.36, 0.95, 0.36],
            }
            particleDuration = (isThinking ? 1.6 : 2.1) + idx * 0.05
          } else if (isSpeaking) {
            particleAnim = {
              y: [0, p.drift, 0],
              x: [0, idx % 2 ? 3 : -3, 0],
              scale: [1, 1 + lvl * 0.9, 1],
              opacity: [0.32, 0.82 + lvl * 0.18, 0.32],
            }
            particleDuration = (1.9 + idx * 0.22) / motionBoost
          } else {
            particleAnim = {
              y: [0, p.drift, 0],
              x: [0, idx % 2 ? 3 : -3, 0],
              scale: [1, 1.65, 1],
              opacity: [0.34, 0.82, 0.34],
            }
            particleDuration = (1.9 + idx * 0.22) / motionBoost
          }
          return (
            <motion.span
              key={idx}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                background: p.color,
              }}
              animate={particleAnim}
              transition={{
                duration: particleDuration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )
        })}

        {/* Layer M — Listening focus ring (subtle, close to center) */}
        {(isListening || isThinking) && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full border border-white/30"
            style={{
              inset: "28%",
              mixBlendMode: "overlay",
            }}
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.97, 1.03, 0.97] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Layer N — Center waveform (always on; pronounced in listening/speaking) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[3px]"
        >
          {WAVE_BARS.map((amp, i) => {
            const minH = 4
            const peakAmp = isSpeaking ? 36 + lvl * 24 : isListening ? 22 : 12
            const baseMax = peakAmp * amp
            const peakOpacity = isSpeaking ? 0.9 : isListening ? 0.75 : 0.4
            const restOpacity = isSpeaking ? 0.45 : isListening ? 0.4 : 0.2
            return (
              <motion.span
                key={i}
                className="rounded-full bg-white/85"
                style={{
                  width: 3,
                  height: minH,
                  boxShadow: "0 0 6px rgba(255,255,255,0.45)",
                }}
                animate={{
                  height: [minH, baseMax, minH],
                  opacity: [restOpacity, peakOpacity, restOpacity],
                }}
                transition={{
                  duration: isSpeaking ? 0.42 + i * 0.04 : isListening ? 0.95 + i * 0.08 : 1.6 + i * 0.1,
                  delay: i * 0.07,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )
          })}
        </span>

        {/* Optional centered icon */}
        {showIcon && (
          <span
            className="pointer-events-none absolute inset-0 grid place-items-center text-white"
            style={{ opacity: isActive ? 0.76 : 0.42 }}
          >
            <HugeiconsIcon icon={IconComp} className="size-7" />
          </span>
        )}
        </span>
      </motion.span>
    </button>
  )
}
