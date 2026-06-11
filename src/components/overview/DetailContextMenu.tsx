import * as React from "react";
import { createPortal } from "react-dom";
import { Ship, ArrowUpRight } from "lucide-react";

/**
 * Sağ-tık "Detaya git" menüsü — Genel Bakış'taki aggregate kartlar
 * SOL tıkla sayfayı filtreler; SAĞ tık bu tek-eylemlik menüyü açar ve
 * "Sefer Takibi'nde detaya git" seçeneği tıklanan veriyi (grup /
 * segment / sefer durumu / tümü) filtre olarak taşıyıp navigasyon yapar.
 *
 * Portal'a render edilir (body) — tıklanabilir kartların içinde
 * yaşamadığı için React-ağacı köpürmesi (Sheet'te yediğimiz bug) burada
 * yapısal olarak imkânsız. Kapanma: dışarı tık (görünmez backdrop),
 * Esc, scroll veya eylemin kendisi.
 */
export interface DetailMenuState {
  x: number;
  y: number;
  /** Menü başlığında gösterilen hedef etiketi (örn. "Arasa-Trabzon"). */
  label: string;
  /** "Detaya git" eylemi — navigasyonu sayfa kurar. */
  go: () => void;
}

const MENU_W = 232;
const MENU_H = 76;

export function DetailContextMenu({
  menu,
  onClose,
}: {
  menu: DetailMenuState | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Scroll ile menünün koordinatı bayatlıyor — kapat.
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  // Viewport kenarlarına taşmasın; dar ekranlarda negatif konuma düşmesin.
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - MENU_H - 8));

  return createPortal(
    <>
      {/* Görünmez backdrop — dışarı tık ve sağ-tık kapatır */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden
      />
      <div
        role="menu"
        aria-label={`${menu.label} — detay menüsü`}
        className="fixed z-[100] rounded-xl bg-white shadow-[0_18px_44px_-12px_rgba(15,23,42,0.35)] ring-1 ring-foreground/10 overflow-hidden"
        style={{ left: x, top: y, width: MENU_W }}
      >
        <div className="px-3 pt-2 pb-1.5 border-b border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {menu.label}
          </div>
        </div>
        {/* autoFocus YOK — odaklama bazı tarayıcılarda scroll tetikler,
            scroll-kapatma dinleyicisi menüyü açılır açılmaz kapatırdı. */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            menu.go();
          }}
          className="group w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-medium text-foreground hover:bg-foreground/[0.05] transition-colors focus-visible:outline-none focus-visible:bg-foreground/[0.05]"
        >
          <Ship className="size-4 text-sky-600 shrink-0" strokeWidth={2} />
          <span className="flex-1 min-w-0 truncate">
            Sefer Takibi'nde detaya git
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors"
            strokeWidth={2.25}
          />
        </button>
      </div>
    </>,
    document.body
  );
}
