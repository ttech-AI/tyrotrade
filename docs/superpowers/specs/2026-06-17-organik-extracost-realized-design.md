# Organik gerçekleşen gider — extra-cost entity entegrasyonu

**Date:** 2026-06-17 · **Status:** approved, building · **Scope:** per-project realized (Sefer Takibi); Trade Cost rollup = follow-up.

## Goal
`sunriseTrOverrides.ts` hardcoded gerçekleşen-gider hack'ini gerçek veriyle değiştir: gerçekleşen gideri yeni **extra-cost (yan masraf) entity**'sinden de topla. Tüm projelere uygula (extra-cost kaydı olan herkes); ORGANIK01-133 ile doğrula.

## Source entity
`mserp_tryaietgextracostdistributingentities` — extra-cost distribution. 117+ alan; sadece gerekli olanları çekiyoruz.

## Calibration (canlı, ORGANIK01-133)
- **Join:** `mserp_trysubprojectid eq '<projectNo>'` → 24 satır. (Ana proje `findimproject`/`inventdimension2`'de ama dev boyutlu; alt-proje link = `trysubprojectid` = uygulamadaki projeNo.)
- **Realized USD = `mserp_distribuitionamountreporting`** — reporting para birimi = USD, satır bazında zaten çevrilmiş. **Manuel kur/işaret/exclusion mantığı YOK.** Para birimi karışık (6 USD / 16 TRY / 2 EUR) ama bu alan hepsinde USD. Satır bazında PBI ile birebir (NAVLUN 312.815,45 ✓). Σ = 349.224,73 vs PBI 349.239,57 (%99,996; ~14,84 fark = PBI yuvarlama).
- Filtre gerekmiyor: 24 satırın hepsi `distributiontype=200000000` + `etgisnotdistribute=200000000`.

## Fetch ($select — ~7 alan)
`mserp_trysubprojectid, mserp_extracostentryno, mserp_expensename, mserp_expenseid, mserp_currencycode, mserp_distribuitionamountreporting, mserp_transdate`

## Mapping (her satır → sentetik gider satırı, mevcut zincir çıktısıyla aynı şekil)
- `mserp_amountcur_usd` = `mserp_distribuitionamountreporting` (pozitif, düz)
- `mserp_amountcur` = aynı; `mserp_currencycode` = "USD" (tutar USD)
- `mserp_description` = `mserp_refexpenseid` = `mserp_expensename`
- `mserp_expenseid` = `mserp_expenseid`; `mserp_expensenum` = `mserp_extracostentryno`
- `mserp_datefinancial` = `mserp_transdate`; `mserp_extracost` = true (kaynak işareti); `mserp_projectnum` = projectNo

## Files
- **New:** `src/lib/dataverse/extraCostExpense.ts` — `EXTRACOST_ENTITY`, `fetchExtraCostExpenseRows(client, projectNo)` → mapped synthetic rows.
- **Modify:** `src/hooks/useProjectExpenseLines.ts` — sunrise override bloğu + import KALDIR; extra-cost fetch'i Step 0/R/P paralel `Promise.allSettled`'a 4. eleman olarak ekle (best-effort); `enriched`'e append. **DİKKAT:** `expensenums.length === 0` erken-dönüşü artık `[]` değil `extraCostRows` döner (ORGANIK01-133'te freight zinciri boş, extra-cost dolu).
- **Delete:** `src/lib/dataverse/sunriseTrOverrides.ts`.

## Consumers (değişmez)
Gider Karşılaştırması + Gerçekleşen K&Z + detay paneli zaten `mserp_amountcur_usd` toplayıp `refexpenseid`/`description` ile grupluyor; sentetik satırlar bunları taşıyor.

## Risk / follow-up — ÇÖZÜLDÜ (2026-06-17)
- **Çift-sayım: YOK (canlı doğrulandı).** Extra-cost `mserp_trysubprojectid` (alt-proje) ile, freight zinciri `mserp_inventdimension2` (ana-proje) ile çalışıyor → temiz partisyon. Extra-cost kaydı olan projelerin freight zinciri BOŞ (HASATA-2, PRJ…-1, PRJ…-14 vb. hepsi `inventdimb=0`); çalışan freight zincirli projelerin (PRJ000002570, ORGANIK01 ana 292K dim) extra-cost'u 0. Bir proje ya freight ya extra-cost — ikisi birden değil. Union güvenli; "extra-cost öncelikli" moda gerek kalmadı.
- **Rollup: YAPILDI.** `actualExpenseRollup.ts` → `fetchExtraCostRollupForAllProjects` eklendi. Tek server-side `$apply groupby((trysubprojectid,expenseid,expensename),sum+count)` (detay satır ÇEKMEZ — bazı projeler 100K-277K satır), `projids`'e filtrelenir, freight rollup'a append edilir. ORGANIK01-133 = 349.224,73 (per-proje ile birebir). Düz pozitif toplam, FX/işaret/exclusion yok — per-proje hook ile aynı.

## Verify
`npm run lint` + `npm run build`. ORGANIK01-133 → ~349.224 USD. Read-only korunur (sadece `listAll`). Kullanıcı tarayıcıda doğrular.
