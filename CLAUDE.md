# tyroTrade

Tiryaki Agro / TTECH'in ticaret operasyonları web uygulaması.
Canlı adres (hedef): `https://tyrotrade.ttech.business` — GitHub Pages, custom domain.

## Köken ve amaç

Bu repo, `../tyro` (TYRO AI launcher platformu) uygulama iskeletinin kopyasından
doğdu (2026-08-08). tyro'nun UI/UX'i — renk paletleri, dark/light tema, TR/EN/RU/AR
i18n, header, sol sidebar, login deneyimi — burada **tasarım sistemi** olarak yeniden
kullanılıyor. Kural:

- **Aynı kalanlar**: Home (`/dashboard`, AppLauncher) ve Chat (`/chat`) sayfaları,
  layout kabuğu (Header, Sidebar), tema/palet/dil altyapısı, login sayfası.
  İstisna: **AI Solutions/AI Çözümler bölümü kaldırıldı** — hem launcher'dan
  (`AppLauncher`) hem sidebar'dan (`NavApps`). Veri katmanı duruyor:
  ConfigProvider hâlâ `aiApps` veriyor ve /settings'teki AI Ürünler sekmesi
  onları yönetiyor; sadece bu iki yüzey göstermiyor. Bölümü geri istersen
  `launcher.aiApps.*` string'leri ve `nav.appsAI` yerinde duruyor.
- **Değişecekler**: `/analytics`, `/settings`, `/help` şu an tyro'dan gelen
  ÖRNEK/placeholder sayfalardır. tyroTrade'e özel sayfalar bunların yerine
  eklenecek — yeni sayfa yazarken bu üçünü şablon olarak kullan.
- Home/Chat'in ayrıntılı davranış dokümantasyonu (`PersistentChat`, ConfigProvider
  merge kuralları, Copilot Studio auth ayrımı, bildirimler) `../tyro/CLAUDE.md`'de
  duruyor ve bu kopya için de geçerli; buraya kopyalanmadı.

## Stack

React 19 · Vite 8 (rolldown) · Tailwind v4 (`@tailwindcss/vite`, config'siz) ·
shadcn/ui + Radix (`src/components/ui/`) · Hugeicons · motion · MSAL browser/react ·
vite-plugin-pwa (generateSW + `public/notify-sw.js` importScripts).

Komutlar: `npm run dev` (5173) · `npm run build` · `npm run lint`. Test yok.

## Yapı

- `src/App.jsx` — rotalar + auth gate. `PATH_TO_ID`/`ID_TO_PATH` sidebar-rota eşlemesi.
- `src/providers/` — `ThemeProvider` (dark/light, `tyrotrade-theme`),
  `PaletteProvider` (renk paleti, `tyrotrade-palette`), `LocaleProvider`
  (`tyrotrade-locale`), `ConfigProvider` (launcher verisi, `tyrotrade-config-v1`;
  MSAL girişliyse Dataverse'ten okur, değilse `src/data/seedConfig.js`).
- `src/components/layout/` — DashboardLayout, Header, Sidebar, Nav*, ThemeToggle,
  LanguageSwitcher, PaletteSwitcher. Yeni sayfa eklerken: rota `App.jsx`'e,
  sidebar girdisi `src/data/nav.js`'e, string'ler 4 locale dosyasına birden.
- `src/data/strings.{tr,en,ru,ar}.js` — TÜM UI metinleri. Bir key eklerken dört
  dosyaya birden ekle; TR ekleri (`'i`, `'e`) markaya göre elle yazılır.
- `src/data/palettes.js` — palet tanımları; `src/index.css` — tema token'ları.
- `src/lib/msal.js` — Entra ID. Tenant/client ID'lerin çalışan varsayılanları
  gömülü (SPA client ID gizli değildir); `VITE_MSAL_*` ile override edilir.
  `DATAVERSE_URL` varsayılanı TYRO ortamı (`https://tyro.crm4.dynamics.com`),
  `VITE_DATAVERSE_URL` ile değiştirilebilir.
- `src/lib/dataverse.js` — Web API sarmalayıcı (`tyro_launcherapp` tablosu; şema
  adları Dataverse'e ait, REBRAND ETME). `src/lib/copilot.js` — Copilot Studio chat.
- `src/lib/constants.js` — TYRO Trader agent görünürlük kuralları (Entra manager
  hiyerarşisi). Launcher'dan miras; home aynen kaldığı için korunuyor.

## Freight sayfaları (`src/freight/`)

Sefer Takibi (`/vessels`), E.M Bakış (`/em-overview`) ve Veri Yönetimi
(`/data`) sayfaları `../tyrofreight/tyrotrade` uygulamasından taşındı
(2026-08-08). Kaynak TypeScript'ti ve **tipleriyle birlikte** taşındı: Vite
TS'i tip kontrolü yapmadan derler, bu yüzden `npm run build`'i asla bir tip
hatası düşüremez; kontrol `npm run typecheck` ile opt-in'dir. Mevcut `.jsx`
dosyalarının hiçbiri dönüştürülmedi.

**Neden `src/freight/` altında?** Uygulamada zaten `src/lib/dataverse.js`
adlı bir DOSYA var; kaynağın `lib/dataverse/` DİZİNİ onun yanına konsaydı
`@/lib/dataverse` belirsizleşir ve sessizce launcher sarmalayıcısına
çözülürdü. Namespace bunu yapısal olarak imkânsız kılar.

Uyarlama katmanları (port kodu bunlara bakar, tersi değil):

- `src/freight/icons.tsx` — kaynak lucide-react kullanıyordu; bu dosya lucide
  ADLARIYLA export edip Hugeicons çizer. İkon eşlemesi tek yerde denetlenir.
- `src/freight/hooks/useBrandAccent.ts` — kaynağın sabit üç temalı
  `useThemeAccent`'inin yerine geçer, aynı şekli döner ama değerler CSS
  değişkeni İFADESİDİR; palet/tema değişince React işi olmadan yeniden boyanır.
  MapLibre ve recharts `var()` kabul etmediği için `useResolvedBrandAccent()`
  bunları `rgb()`e çözer ve `data-palette`/`class` MutationObserver'ıyla tazeler.
- `src/freight/lib/auth/acquireToken.ts` — freight Dataverse'i **ayrı bir
  ortamdır** (`operations-tiryaki`, launcher `tyro` ortamında). Ayrı kaynak =
  ayrı token; `src/lib/msal.js`'teki `freightRequest` ile sessizce alınır,
  `loginRequest`'e EKLENMEZ (giriş duvarı riski).
- i18n: kaynağın `useT()`'si `useLocale().t`'ye yeniden yazıldı. 451 anahtar
  TR+EN olarak dört dosyaya işlendi; RU/AR bilinçli olarak İngilizceye düşer
  (D365/denizcilik jargonunda makine çevirisi anlamsız çıkıyor).
- Mock modu taşınmadı: kaynakta env değişkeni tanımsızsa mock AÇIK'tı
  (fail-open) — üretimde uydurma rakam gösterebilirdi.

Veri akışı: Veri Yönetimi'ndeki **Yenile** düğmesi Dataverse'ten entity
kümelerini çekip IndexedDB aynasına (`tyrotrade-freight-cache`) yazar; diğer
iki sayfa yalnızca bu aynadan okur (`composeProjects` türetmesi). Yani önce
Veri Yönetimi'nden yenilemeden Sefer Takibi ve E.M Bakış boş görünür — bu
tasarım gereğidir, arıza değil. Aynanın hidratlanması `main.jsx`'te ilk
boyamadan önce 2 sn'lik yarışla yapılır.

## Marka kuralları

- Görünen ad **tyroTrade** ("tyro" + `text-brand` renkli "Trade" — `BrandText.jsx`
  ve `LoginPage.jsx` header/footer'ında). Login'deki dev "HI, I'M TYRO" başlığı
  asistan personasıdır, bilinçli olarak tutuldu (daha uzun metin masaüstünde taşar).
- Varsayılanlar: dil **en** (`LocaleProvider` DEFAULT + LoginPage ilk-ziyaret
  efekti), palet **ocean-breeze-v2** (`palettes.js` DEFAULT_PALETTE). Marka
  renkleri Ocean Breeze v2 (#48cae4 → #00b4d8 → #0077b6, koyu: #03045e):
  favicon/pwa SVG'leri, manifest `theme_color`, index.html theme-color (light)
  ve LoginPage `BRAND_COLORS`/`BRAND_GRADIENT` sabitleri bu setten. Uygulama
  içi logo/`text-brand` palet CSS token'larını kullanır, otomatik uyar.
  Login orb'u da palet uyumludur: `--voiceorb-*` değişkenlerinin
  ocean-breeze-v2 override'ı index.css'te (Peach Sorbet / Pastel Lavender
  pastel spec'te kalır). Renk seti değişirse `public/*.svg` +
  `apple-touch-icon.png` + manifest/meta + `BRAND_*` birlikte güncellenmeli.
- Varsayılan değişikliği geçmiş ziyaretçilere ulaşsın diye
  `src/lib/defaultsMigration.js` tek seferlik kayıtlı locale/palette siler
  (`tyrotrade-defaults-v` sürümü). İleride varsayılan değiştirirsen VERSION'ı
  artır.
- Storage anahtarları `tyrotrade-*` önekli (tyro ile localhost'ta çakışmasın diye).
  Yeni anahtar eklerken aynı öneki kullan ve `src/data/appMeta.js` +
  `GeneralTab.jsx` storage registry'sini güncelle.
- Dataverse şema adları (`tyro_launcherapp`, `tyro_name`, `tyro_type`…) ve şirket
  adları (Tiryaki, TTECH) markalamanın DIŞINDADIR.

## Deploy

`main`'e push → `.github/workflows/deploy.yml` → GitHub Pages (SPA fallback:
`dist/index.html` → `404.html`; workflow'daki `configure-pages` adımı ilk
deployda Pages'i kendisi etkinleştirir). `vite.config.js` `base: "/"` (custom
domain kökten servis eder). İlk yayında: repo Settings → Pages → Custom domain:
`tyrotrade.ttech.business` (Actions deploylarında `public/CNAME` dosyası GitHub
tarafından yok sayılır, asıl bağlama bu ayardır); DNS CNAME kaydı; Azure AD app
registration'a `https://tyrotrade.ttech.business/` SPA redirect URI'ı ekle —
eklenmezse canlıda login dönüşü `AADSTS50011` ile düşer. Localhost zaten kayıtlı
olduğundan dev'de login çalışır.
