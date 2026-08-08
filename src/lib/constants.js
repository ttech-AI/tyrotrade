// Tenant-scoped constants live here so admin/security-gating IDs stay
// co-located with other Azure AD identifiers (CLIENT_ID, TENANT_ID,
// DATAVERSE_URL in src/lib/msal.js) and so future UI surfaces (an
// admin-only sidebar entry, a "request access" CTA, etc.) can import
// the same ID without each component shipping its own copy.

/**
 * Entra ID security group "BT Ttech Business" (39 direct members at
 * provisioning time). Membership in this group gates the admin tabs in
 * /settings (AI Asistanlar / AI Çözümler / İş Uygulamaları). The check
 * lives in src/hooks/useIsInGroup — primary read off
 * `account.idTokenClaims.groups`, fallback to
 * Microsoft Graph `POST /me/checkMemberGroups`.
 */
export const ADMIN_GROUP_ID = "62b4ed73-59aa-4397-be26-d2891675f867"

/**
 * "TYRO Trader" agent'ı yalnızca bu iki yöneticiye — doğrudan VEYA ara
 * yöneticiler üzerinden — bağlı çalışanlara görünür. Kural Entra ID manager
 * hiyerarşisinden okunur (src/hooks/useIsUnderManager), grup üyeliğinden
 * DEĞİL: Entra dinamik grup kuralları manager zincirini ifade edemiyor, o
 * yüzden bir güvenlik grubu her işe alım/terfide elle bakım gerektirirdi.
 *
 * Her yönetici için objectId VE UPN birlikte tutuluyor; hook ikisinden
 * herhangi biri eşleşirse kabul eder. objectId asıl kimliktir (UPN evlilik /
 * soyad değişikliğinde değişebilir), UPN ise objectId henüz doldurulmadan
 * kuralın çalışabilmesi için yedektir. objectId'leri çözmek için:
 *   python scripts/resolve_managers.py  (../tyro reposunda)
 *
 * DİKKAT: eşleşme kullanıcının KENDİSİNİ de kapsar (hook zincire kendi
 * kimliğini de ekler) — yani Fatih ve Timur agent'ı kendileri de görür.
 */
export const TRADER_MANAGERS = [
  {
    label: "Fatih Tiryakioğlu",
    // Dataverse systemuser.azureactivedirectoryobjectid üzerinden doğrulandı
    // (Başkan Yardımcısı / Uluslararası Ticaret). Entra UPN'i büyük harfli
    // yazılmış — `Fatih.Tiryakioglu@…` — ama zincir de hedefler de küçük
    // harfe normalize edildiği için bu fark bir şeyi bozmuyor.
    id: "0b8982c7-2f49-4386-9ad9-da48af6458a4",
    upn: "fatih.tiryakioglu@tiryaki.com.tr",
  },
  {
    label: "Timur Karaman",
    // Aynı kaynaktan doğrulandı (Bilgi Teknolojileri Direktörü).
    id: "fe585c9b-614f-4e96-88ce-27b2b879acce",
    upn: "timur.karaman@tiryaki.com.tr",
  },
]

/**
 * Zincirde aranacak anahtarlar (küçük harfe normalize edilmiş objectId + UPN
 * karışık). Modül seviyesinde bir kez hesaplanır → referansı sabit, effect
 * bağımlılığı olarak güvenli.
 *
 * Burada kişiye özel bir istisna listesi YOK ve olmamalı. Bir kez denendi ve
 * geri alındı: agent'ın kilitli kalma sebebi eksik bir Graph izniydi, oysa
 * listelenen kişiler kurala fiilen uyuyordu. İsim eklemek o arızayı gizler,
 * çözmez — ve kimsenin bakmadığı paralel bir yetki listesi bırakır. Birileri
 * kurala uyduğu hâlde agent'ı açamıyorsa doğru müdahale buraya isim yazmak
 * değil, `?authdebug=1` ile sebebi bulmaktır.
 */
export const TRADER_MANAGER_KEYS = TRADER_MANAGERS.flatMap((m) =>
  [m.id, m.upn].filter(Boolean).map((v) => v.trim().toLowerCase()),
)

/**
 * Kısıtlı agent'ı tanımanın anahtarları — Dataverse `tyro_launcherapp`
 * satırının adı (normalize) veya id'si. Ad üzerinden eşleştiriyoruz çünkü
 * satırın GUID'i ortama (dev/prod Dataverse) göre değişir, `tyro_name` ise
 * alternate key'in (tyro_NameTypeKey) yarısı olduğu için ortamlar arası
 * kararlıdır. Dataverse'teki ad değişirse buraya yeni alias eklenmeli —
 * aksi halde agent HERKESE açılır (fail-open), bu yüzden adı değiştirirken
 * bu listeyi de güncelle.
 */
export const TRADER_AGENT_ALIASES = ["tyro trader", "tyrotrader"]
