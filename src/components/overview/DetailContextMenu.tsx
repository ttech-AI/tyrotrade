import * as React from "react";
import { Ship, ArrowUpRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Sağ-tık "Detaya git" menüsü — Genel Bakış'taki aggregate kartlar
 * SOL tıkla sayfayı filtreler; SAĞ tık bu menüyü açar ve "Sefer
 * Takibi'nde detaya git" eylemi tıklanan veriyi (grup / segment /
 * sefer durumu / tümü) filtre olarak taşıyıp navigasyon yapar.
 *
 * shadcn DropdownMenu üzerine kurulu: imleç koordinatına yerleşen
 * SIFIR boyutlu sabit bir tetikleyiciye çapalanır — dış-tık / Esc /
 * odak yönetimi / viewport çarpışma kaydırması / animasyonları Radix
 * üstlenir (önceki el-yapımı clamp + backdrop kalktı). Eylem metni
 * whitespace-nowrap: menü içeriğe göre genişler, ad asla kırpılmaz.
 * Scroll'da yine de kapatıyoruz — çapa sabit (fixed) olduğundan sayfa
 * kayınca menü tıklanan verinin üzerinden ayrılırdı.
 */
export interface DetailMenuState {
  x: number;
  y: number;
  /** Menü başlığında gösterilen hedef etiketi (örn. "Arasa-Trabzon"). */
  label: string;
  /** "Detaya git" eylemi — navigasyonu sayfa kurar. */
  go: () => void;
}

export function DetailContextMenu({
  menu,
  onClose,
}: {
  menu: DetailMenuState | null;
  onClose: () => void;
}) {
  const t = useT();
  React.useEffect(() => {
    if (!menu) return;
    window.addEventListener("scroll", onClose, true);
    return () => window.removeEventListener("scroll", onClose, true);
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        {/* Görünmez çapa — Radix içeriği bu noktaya konumlar */}
        <span
          aria-hidden
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            width: 0,
            height: 0,
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        className="min-w-[224px]"
      >
        <DropdownMenuLabel className="max-w-[280px] truncate">
          {menu.label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onClose();
            menu.go();
          }}
        >
          <Ship className="size-4 text-sky-600 shrink-0" strokeWidth={2} />
          <span className="whitespace-nowrap flex-1">
            {t("ov.menu.goToDetail")}
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/60"
            strokeWidth={2.25}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
