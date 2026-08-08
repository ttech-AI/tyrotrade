import { useEffect } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMe } from "@/hooks/useMe"
import { cn, safeExternalUrl } from "@/lib/utils"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { showAgentNoAccess } from "@/components/common/AgentAccessToast"
import { PastelVoiceOrb } from "@/components/brand/PastelVoiceOrb"

function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "chat.greeting.morning"
  if (hour >= 12 && hour < 18) return "chat.greeting.afternoon"
  if (hour >= 18 && hour < 22) return "chat.greeting.evening"
  return "chat.greeting.night"
}

// Word-by-word reveal: smooth blur+rise stagger
const wordVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

const lineVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } },
}

function HeroSection({ onNewChat }) {
  const { t } = useLocale()
  const isMobile = useIsMobile()
  const me = useMe()
  const greetHour = new Date().getHours()
  const firstName = (me.name || "").split(" ")[0]
  const greetingText = t(greetingKey(greetHour))
  const greetingWords = greetingText.split(" ")

  // Mouse parallax — orb subtly follows cursor (desktop only)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { stiffness: 70, damping: 18, mass: 0.6 }
  const orbX = useSpring(useTransform(mouseX, [-1, 1], [-12, 12]), springConfig)
  const orbY = useSpring(useTransform(mouseY, [-1, 1], [-10, 10]), springConfig)

  useEffect(() => {
    if (isMobile) return
    function handle(e) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      mouseX.set(x)
      mouseY.set(y)
    }
    window.addEventListener("mousemove", handle, { passive: true })
    return () => window.removeEventListener("mousemove", handle)
  }, [isMobile, mouseX, mouseY])

  return (
    <section className="relative">
      <div className="grid grid-cols-1 items-center gap-10 pt-10 pb-4 md:grid-cols-[1.4fr_1fr] md:gap-12 md:pt-14 md:pb-6">
        {/* LEFT — greeting + CTA */}
        <div className="space-y-5">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={lineVariants}
            className="text-3xl font-semibold tracking-tight leading-[1.1] sm:text-4xl md:text-[44px]"
          >
            {greetingWords.map((word, i) => (
              <motion.span key={`g-${i}`} variants={wordVariants} className="inline-block">
                {word}
                {i < greetingWords.length - 1 && " "}
              </motion.span>
            ))}
            <motion.span variants={wordVariants} className="inline-block">
              ,&nbsp;
            </motion.span>
            <motion.span
              variants={wordVariants}
              className="inline-block bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-transparent"
            >
              {firstName}
            </motion.span>
            <motion.span variants={wordVariants} className="inline-block">
              .
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t("dashboard.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-3 pt-1"
          >
            <motion.button
              type="button"
              onClick={onNewChat}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full",
                "bg-gradient-to-r from-brand-from via-brand-via to-brand-to",
                "px-5 py-2.5 text-sm font-semibold text-white shadow-sm",
                "transition-shadow duration-200 hover:shadow-lg hover:brightness-110",
              )}
            >
              {t("dashboard.hero.cta")}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </motion.button>
            <a
              href="#apps"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              {t("dashboard.hero.secondary")} →
            </a>
          </motion.div>
        </div>

        {/* RIGHT — orb with parallax + entrance breath */}
        <div className="flex justify-center md:justify-end">
          <motion.div
            initial={{ opacity: 0, scale: 0.65, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 1.1,
              delay: 0.1,
              ease: [0.22, 1, 0.36, 1],
              scale: { type: "spring", stiffness: 110, damping: 16, mass: 0.9 },
            }}
            style={{ x: orbX, y: orbY }}
          >
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              onClick={onNewChat}
              role="button"
              tabIndex={0}
              aria-label="Yeni sohbet başlat"
              className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-via/40"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <PastelVoiceOrb state="idle" size={isMobile ? 130 : 180} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function LauncherCard({
  iconName,
  logo,
  title,
  subtitle,
  onClick,
  index = 0,
  accent = "brand",
  locked = false,
  lockedHint,
}) {
  const accentClass =
    accent === "brand"
      ? "bg-gradient-to-br from-brand-from via-brand-via to-brand-to"
      : accent === "business"
        ? "bg-brand-deep"
        : ""
  const accentStyle =
    accent === "ai"
      ? {
          background:
            "color-mix(in oklab, var(--brand-via) 60%, var(--brand-deep) 40%)",
        }
      : undefined
  return (
    <motion.button
      type="button"
      onClick={onClick}
      // Kilitli kart TIKLANABİLİR kalır (disabled DEĞİL) — tıklama toast'ı
      // tetikliyor, `disabled` olsa olay hiç ulaşmaz ve kullanıcı sessiz bir
      // duvara çarpardı. Yetki durumu aria-disabled ile duyurulur.
      aria-disabled={locked || undefined}
      title={locked ? lockedHint : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: locked ? 0 : -2 }}
      className={cn(
        "group relative flex h-full w-full flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left",
        "transition-all duration-200",
        // Kilitli kart hover'da daha az tepki verir (kalkma yok, gölge yok,
        // soluk kenarlık) — "burada açılacak bir şey yok" sinyalini renk
        // çatışması yaratmadan verir.
        locked ? "hover:border-brand/20" : "hover:border-brand/40 hover:shadow-lg",
      )}
    >
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-sm",
          accentClass,
          // Marka rengini söndürmek, kartı silikleştirmeden "şu an kapalı"
          // sinyali verir; başlık ve açıklama tam okunur kalır.
          locked && "opacity-55 saturate-50",
        )}
        style={accentStyle}
      >
        <IconOrLogo iconName={iconName} logo={logo} className="size-5" />
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {locked ? (
            <HugeiconsIcon
              icon={SquareLock02Icon}
              // text-brand = --brand-text: palet başına tanımlı ve dark modda
              // ayrıca override edilen tema-farkında marka rengi. Sabit bir
              // amber, paletten bağımsız durup her temada yabancı kalıyordu.
              className="size-4 shrink-0 text-brand"
              strokeWidth={2}
            />
          ) : (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
            />
          )}
        </div>
        <p className="text-xs leading-snug text-muted-foreground line-clamp-2">{subtitle}</p>
      </div>
    </motion.button>
  )
}

function Section({ title, subtitle, children, first = false }) {
  return (
    <section className={cn("space-y-4", !first && "pt-2")}>
      <div className="px-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {/* Cards: 1-col below 420 px (very small phones), 2-col from 420 px so
          standard phones (375/390/414 viewports) get the denser 2-col grid
          without horizontal scroll. */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  )
}

export function AppLauncher({ onOpenChat, onNewChat }) {
  const { t, locale } = useLocale()
  const { agents, businessApps } = useConfig()

  const agentSubtitle =
    locale === "tr" ? "Sohbet başlat ve sorularını sor" : "Start a chat and ask your questions"

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto px-3 pb-10 sm:gap-5 sm:px-4 sm:pb-12 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <HeroSection onNewChat={onNewChat} />

      {/* Elegant divider */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div id="apps" className="flex flex-col gap-10 scroll-mt-20">
        <Section
          first
          title={t("launcher.agents.title")}
          subtitle={t("launcher.agents.subtitle")}
        >
          {agents.map((agent, i) => (
            <LauncherCard
              key={agent.id}
              iconName={agent.iconName}
              logo={agent.logo}
              title={agent.name}
              subtitle={agent.description || agentSubtitle}
              locked={agent.locked}
              lockedHint={t("access.agent.hint")}
              // Kilitli agent chat'i açmaz — sohbete girip orada hata almak
              // yerine kullanıcı olduğu yerde net bir cevap alır.
              onClick={() =>
                agent.locked
                  ? showAgentNoAccess(agent.name, t)
                  : onOpenChat?.(agent.id)
              }
              index={i}
            />
          ))}
        </Section>

        <Section title={t("launcher.businessApps.title")} subtitle={t("launcher.businessApps.subtitle")}>
          {businessApps.map((app, i) => (
            <LauncherCard
              key={app.id}
              iconName={app.iconName}
              logo={app.logo}
              title={app.name}
              subtitle={app.description}
              onClick={() => {
                const safe = safeExternalUrl(app.url)
                if (safe !== "#") window.open(safe, "_blank", "noopener,noreferrer")
              }}
              index={i}
              accent="business"
            />
          ))}
        </Section>
      </div>
    </div>
  )
}
