import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home01Icon,
  ShipmentTrackingIcon,
  DatabaseIcon,
  Settings02Icon,
  FilterIcon,
  Notification03Icon,
  Robot01Icon,
  ChatEdit01Icon,
  RefreshIcon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

interface HelpSection {
  /** Anchor / route this card explains. */
  to?: string;
  icon: IconSvgElement;
  title: string;
  /** One-line tagline shown next to the title. */
  tagline: string;
  /** Body paragraph(s) — markdown-ish but rendered as plain text. */
  body: string;
  /** Bulleted feature list. */
  bullets?: string[];
}

const PAGE_SECTIONS: HelpSection[] = [
  {
    to: "/",
    icon: Home01Icon,
    title: "Dashboard",
    tagline: "Yönetici özeti · KPI bento grid",
    body: "Açıldığında portföydeki seçili dönemin (varsayılan: aktif finansal yıl) tüm tahmini ve gerçekleşen özetini tek ekranda gösterir. KPI kartlarına tıklayarak proje bazlı kırılım drawer'ı açılır; oradan ilgili projeye tek tıkla geçilir.",
    bullets: [
      "Dönem Performansı, Tahmini K&Z, Tahmini Miktar — finansal headline'lar.",
      "Aktif Pipeline, Ortalama Transit, Para Birimi Maruziyeti — operasyonel sağlık.",
      "Koridor Konsantrasyonu, Karşı Taraf Dağılımı — risk göstergeleri (HHI).",
      "Kral Projeler & Kral Segmentler — satış / kâr / zarar liderlik tabloları.",
      "Olaylar paneli — son 30 ve önümüzdeki 30 gün milestone akışı.",
    ],
  },
  {
    to: "/projects",
    icon: ShipmentTrackingIcon,
    title: "Vessel Projects",
    tagline: "Proje bazlı detay · harita + zaman çizelgesi",
    body: "Bireysel projeyi seçip rotasını dünya haritasında, zaman çizelgesini milestone bantında, finansal göstergelerini sağ paneldeki kartlarda izlersin. Solda proje listesi + arama + gelişmiş filtre; ortada harita + animasyonlu gemi marker; sağda Proje Genel, Komodite Satış, Tahmini Gider, Gerçekleşen K&Z kartları.",
    bullets: [
      "Solda 437 proje listesi, search'ten gemi/liman/tedarikçi/müşteri arayabilirsin.",
      "Gelişmiş Filtre — sefer durumu, durum, incoterm, segment, trader, tedarikçi, alıcı, gemi, proje grubu çoklu filtreler + dönem.",
      "Ortada MapLibre haritası — yükleme limanı, deniz rotası, animasyonlu gemi pozisyonu, varış limanı.",
      "Sağda kart yığını — proje özeti, kargo değeri, masraf bucket'ları, gerçekleşen K&Z karşılaştırması.",
    ],
  },
  {
    to: "/data",
    icon: DatabaseIcon,
    title: "Veri Yönetimi",
    tagline: "Dataverse entity inspector · 5 tablo",
    body: "Dataverse'ten gelen ham veriyi denetlemek + filtrelemek için. Ana tab Projeler; alt taklarda her seçili projenin satırları, gemi planı, tahmini gider satırları ve gerçekleşen satış faturaları. Verileri Güncelle butonu 7 entity'yi sırayla çeker, sonuç toast'la bildirilir.",
    bullets: [
      "Projeler tablosu — sortlanabilir, filtrelenir, detay paneli sağa açılır.",
      "Tahmini Bütçe (Segment) tab'ı — segment bazlı bütçe vs. gerçekleşen.",
      "Gelişmiş Filtre paneli + dönem filtresi (FY/aylık/çeyreklik/yıllık/tüm zamanlar).",
      "Verileri Güncelle butonu — 7 adımlık fetch + cache write, toast'ta proje sayısı + süre.",
    ],
  },
  {
    to: "/settings",
    icon: Settings02Icon,
    title: "Ayarlar",
    tagline: "API key, model, agent URL",
    body: "Gemini API key (AI sohbet için), Gemini model seçimi, Copilot Studio agent URL'i (TYRO Chat drawer'ı için), localStorage temizliği gibi tarayıcı düzeyinde tercihler.",
    bullets: [
      "Gemini API Key — varsayılan dev key gömülü, kendi key'inle override edebilirsin.",
      "Model seçimi — gemini-2.5-flash / 2.5-pro / 1.5-flash arasında geçiş.",
      "TYRO Chat URL — Copilot Studio webchat URL'i; boş bırakıp kaydedersen varsayılana döner.",
      "Yerel Depolama — tüm cache slot'larını listeler, tek tek veya toplu silebilirsin.",
    ],
  },
];

interface ButtonHelp {
  icon: IconSvgElement;
  title: string;
  body: string;
  /** Ink colour for the icon (gradient / status). When omitted falls
   *  back to the live sidebar accent. */
  iconColor?: string;
}

const TOPBAR_BUTTONS: ButtonHelp[] = [
  {
    icon: FilterIcon,
    title: "Gelişmiş Filtre",
    body: "Header'daki beyaz cam pill — proje, gemi, tedarikçi, alıcı, segment, durum gibi 11 ayrı boyutta çoklu filtre + finansal dönem seçimi. Aynı filtre Dashboard, Vessel Projects ve Veri Yönetimi sayfalarında ortak çalışır — bir kez seçtiğin filtre üç sayfada da geçerlidir.",
  },
  {
    icon: Notification03Icon,
    title: "Bildirim",
    body: "Yaklaşan ve geçmiş milestone'ları tek panelde gösterir — son 30 gün gerçekleşen olaylar + önümüzdeki 30 gün için planlı yükleme/varış/tahliye tarihleri. Bildirime tıklayınca ilgili proje seçili olarak Vessel Projects sayfasına gidersin.",
  },
  {
    icon: Robot01Icon,
    title: "TYRO AI",
    body: "Google Gemini destekli sohbet drawer'ı — proje, gemi ve finansal verileri doğal Türkçe ile sorgulayabilirsin. \"Yolda olan gemiler\", \"En kârlı 3 segment\", \"Risk altındaki düşük marjlı projeler\" gibi sorular önceden hazırlanmış. Sohbet bağlamı her seferinde dashboard verisinden besleniyor.",
  },
  {
    icon: ChatEdit01Icon,
    title: "TYRO Chat",
    body: "Microsoft Copilot Studio agent'ını embedded iframe olarak açar — TYRO ticaret operasyonu için özel eğitilmiş agent. Drawer açılırken bir karşılama ekranı sunar; \"Sohbete başla\" tıklayınca canlı agent görünür hale gelir.",
  },
  {
    icon: RefreshIcon,
    title: "Verileri Güncelle (Veri Yönetimi)",
    body: "Veri Yönetimi sayfasındaki yuvarlak buton — Dataverse'ten 5 ana entity + sales aggregate verilerini sırayla çeker (~15 saniye). Premium toast ile her adım gösterilir; başarı veya hata bildirilir. Login sonrası ilk açılışta otomatik olarak çalışır.",
  },
];

const KEYBOARD_SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "⌘ K", action: "Komut paleti — sayfalar, projeler arasında hızlı ara" },
  { keys: "Esc", action: "Açık drawer / popover'ı kapat" },
  { keys: "Tab / ⇧ Tab", action: "Filtre alanları, suggestion chip'leri arasında gezin" },
];

/**
 * /help — single-scroll help/onboarding page. Theme-aware: hero panel
 * + section icon pills track the live sidebar accent so the help
 * surface speaks the same brand language as the rest of the app.
 */
export function HelpPage() {
  const accent = useThemeAccent();

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">
        {/* Hero */}
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="px-6 py-6 flex items-center gap-4">
            <span
              className="size-12 rounded-2xl grid place-items-center text-white shadow-sm shrink-0"
              style={{
                background: accent.gradient,
                boxShadow: `0 6px 18px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
              }}
            >
              <HugeiconsIcon
                icon={HelpCircleIcon}
                size={24}
                strokeWidth={1.75}
              />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Yardım & Kullanım Rehberi
              </h1>
              <p className="text-[12.5px] text-foreground/70 mt-1 leading-snug">
                tyroFreight'in dört ana sayfası, header
                butonları ve klavye kısayolları için kısa anlatım. Hangi
                bölüme tıklayacağını bulamadığında veya yeni bir
                yöneticiye linki gönderdiğinde başlangıç noktası bu
                sayfadır.
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Pages */}
        <SectionTitle>Sayfalar</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAGE_SECTIONS.map((s) => (
            <PageHelpCard key={s.title} section={s} accent={accent} />
          ))}
        </div>

        {/* Topbar buttons */}
        <SectionTitle>Header Butonları</SectionTitle>
        <GlassPanel tone="default" className="rounded-2xl">
          <ul className="divide-y divide-border/50">
            {TOPBAR_BUTTONS.map((b) => (
              <li key={b.title} className="px-5 py-4 flex items-start gap-3">
                <span
                  className="size-9 rounded-xl grid place-items-center text-white shrink-0 shadow-sm"
                  style={{
                    background: accent.gradient,
                    boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  <HugeiconsIcon icon={b.icon} size={16} strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">
                    {b.title}
                  </div>
                  <p className="text-[12px] text-foreground/70 mt-1 leading-relaxed">
                    {b.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Keyboard shortcuts */}
        <SectionTitle>Klavye Kısayolları</SectionTitle>
        <GlassPanel tone="default" className="rounded-2xl">
          <ul className="divide-y divide-border/50">
            {KEYBOARD_SHORTCUTS.map((k) => (
              <li
                key={k.keys}
                className="px-5 py-3 flex items-center justify-between gap-4"
              >
                <span className="text-[12.5px] text-foreground/85">
                  {k.action}
                </span>
                <kbd
                  className="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
                  style={{
                    color: accent.stops[2],
                    background: accent.tint,
                    boxShadow: `inset 0 0 0 1px ${accent.ring}, inset 0 -1px 0 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  {k.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Footer */}
        <p className="text-[11px] text-foreground/55 px-1 pb-2">
          Daha fazla yardım için Tiryaki BT ekibine ulaşabilirsin. Veri
          erişim sorunlarında yöneticinin Power Platform admin merkezinde
          ilgili rolün atandığından emin ol.
        </p>
      </div>
    </ScrollArea>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/65 px-2 pt-2">
      {children}
    </h2>
  );
}

function PageHelpCard({
  section,
  accent,
}: {
  section: HelpSection;
  accent: ReturnType<typeof useThemeAccent>;
}) {
  const inner = (
    <GlassPanel
      tone="default"
      className={cn(
        "rounded-2xl h-full transition-all",
        section.to && "hover:shadow-lg hover:-translate-y-px"
      )}
    >
      <div className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <span
            className="size-10 rounded-xl grid place-items-center text-white shrink-0 shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={section.icon} size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                {section.title}
              </h3>
              {section.to && (
                <ChevronRight className="size-3.5 text-foreground/40" />
              )}
            </div>
            <p className="text-[10.5px] uppercase tracking-wider text-foreground/60 mt-0.5">
              {section.tagline}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-foreground/75 leading-relaxed">
          {section.body}
        </p>
        {section.bullets && (
          <ul className="space-y-1.5 mt-auto">
            {section.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[11.5px] text-foreground/75"
              >
                <span
                  className="mt-1.5 size-1.5 rounded-full shrink-0"
                  style={{ background: accent.solid }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassPanel>
  );

  if (!section.to) return inner;
  return (
    <Link to={section.to} className="block">
      {inner}
    </Link>
  );
}
