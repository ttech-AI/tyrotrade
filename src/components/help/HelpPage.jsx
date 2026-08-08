import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiChat02Icon,
  Robot01Icon,
  Settings02Icon,
  ColorsIcon,
  ArrowDown01Icon,
  Mail01Icon,
  Comment02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { useLocale } from "@/hooks/useLocale"
import { PwaInstallButton } from "@/components/common/PwaInstallButton"
import { cn } from "@/lib/utils"

function GuideCard({ icon, title, description, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand/40 hover:shadow-lg"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
        <HugeiconsIcon icon={icon} className="size-5" strokeWidth={1.6} />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  )
}

function FaqItem({ question, answer, isOpen, onToggle, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-border last:border-b-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full min-h-11 items-center justify-between gap-3 py-4 text-left transition",
          "hover:text-brand",
        )}
      >
        <span className="text-sm font-medium leading-snug">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" strokeWidth={2} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-2 text-sm leading-relaxed text-muted-foreground sm:pr-12">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function HelpPage() {
  const { t } = useLocale()
  const [openFaq, setOpenFaq] = useState(0)

  const guides = [
    {
      icon: AiChat02Icon,
      title: t("help.guides.chat.title"),
      description: t("help.guides.chat.body"),
    },
    {
      icon: Robot01Icon,
      title: t("help.guides.agents.title"),
      description: t("help.guides.agents.body"),
    },
    {
      icon: Settings02Icon,
      title: t("help.guides.settings.title"),
      description: t("help.guides.settings.body"),
    },
    {
      icon: ColorsIcon,
      title: t("help.guides.theme.title"),
      description: t("help.guides.theme.body"),
    },
  ]

  const faqs = [
    { question: t("help.faq.q1"), answer: t("help.faq.a1") },
    { question: t("help.faq.q2"), answer: t("help.faq.a2") },
    { question: t("help.faq.q3"), answer: t("help.faq.a3") },
    { question: t("help.faq.q4"), answer: t("help.faq.a4") },
    { question: t("help.faq.q5"), answer: t("help.faq.a5") },
    { question: t("help.faq.q6"), answer: t("help.faq.a6") },
  ]

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-10 overflow-y-auto px-3 pb-12 pt-6 sm:gap-12 sm:px-4 sm:pb-16 sm:pt-8 lg:px-6">
      {/* Hero */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
          {t("help.title")}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t("help.subtitle")}
        </p>
      </motion.header>

      {/* Quick guides */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("help.sections.guides")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("help.sections.guidesSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((g, i) => (
            <GuideCard key={g.title} {...g} index={i} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("help.sections.faq")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("help.sections.faqSubtitle")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5">
          {faqs.map((f, i) => (
            <FaqItem
              key={i}
              question={f.question}
              answer={f.answer}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* Support */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("help.sections.support")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("help.sections.supportSubtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SupportCard
            icon={Mail01Icon}
            title={t("help.support.email.title")}
            value={t("help.support.email.value")}
            href={`mailto:${t("help.support.email.value")}`}
          />
          <SupportCard
            icon={Comment02Icon}
            title={t("help.support.slack.title")}
            value={t("help.support.slack.value")}
            href="#"
          />
        </div>
        <PwaInstallButton className="mt-3" />
      </section>
    </div>
  )
}

function SupportCard({ icon, title, value, href }) {
  return (
    <motion.a
      href={href}
      whileHover={{ y: -2 }}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand/40 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white shadow-sm">
          <HugeiconsIcon icon={icon} className="size-5" strokeWidth={1.6} />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-brand"
      />
    </motion.a>
  )
}
