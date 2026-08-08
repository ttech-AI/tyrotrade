# tyroTrade

Tiryaki Agro / TTECH'in ticaret operasyonları platformu — `https://tyrotrade.ttech.business`

UI iskeleti [tyro](../tyro) launcher platformundan alınmıştır: aynı tasarım sistemi
(renk paletleri, dark/light tema, 4 dilli i18n, header, sol sidebar), aynı stack.
Home (launcher) ve Chat sayfaları tyro ile aynıdır; diğer sayfalar tyroTrade'e özel
sayfalarla değiştirilecektir.

## Stack

React 19 · Vite 8 · Tailwind v4 · shadcn/ui (Radix) · Hugeicons · MSAL (Entra ID) · PWA

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run lint
```

Ortam değişkenleri opsiyoneldir (çalışan varsayılanlar gömülü) — bkz. `.env.example`.

## Deploy — GitHub Pages

`main`'e her push, `.github/workflows/deploy.yml` ile GitHub Pages'e deploy eder.
İlk kurulumda:

1. GitHub'da repo oluştur, `main`'i push et.
2. Repo → Settings → Pages → Source: **GitHub Actions** seç.
3. Repo → Settings → Pages → **Custom domain**: `tyrotrade.ttech.business` yaz
   (Actions tabanlı deploylarda GitHub `public/CNAME` dosyasını YOK SAYAR — asıl
   bağlama bu ayardır; dosya yine de dursun). DNS'te `tyrotrade.ttech.business`
   için `<kullanıcı/org>.github.io`'ya CNAME kaydı ekle.
4. Azure AD app registration'ının SPA Redirect URI listesine
   `https://tyrotrade.ttech.business/` ekle (yoksa canlıda login dönüşü çalışmaz).

Mimari ve kurallar için `CLAUDE.md`'ye bak.
