import { useMsal } from "@azure/msal-react";
import { shouldUseMock } from "@/lib/dataverse";

/**
 * Email-bazlı görünürlük kuralı — tek kaynak.
 *
 * Anasayfa (`/`) ve Trade Cost (`/pl-cost`) yalnızca bu maillerle giriş
 * yapan kullanıcılarda görünür: hem sidebar linki (AppSidebar) hem de
 * route guard (App.tsx) bu seti okur. Karşılaştırma küçük harfe normalize
 * edilerek yapılır.
 */
export const RESTRICTED_NAV_EMAILS = new Set([
  "ceyda.degerli@tiryaki.com.tr",
  "cenk.sayli@tiryaki.com.tr",
  "pinar.kurtunluoglu@tiryaki.com.tr",
]);

/** Yalnızca izinli maillerin görebildiği rotalar. */
export const RESTRICTED_NAV_ROUTES = new Set(["/", "/pl-cost"]);

/**
 * İzinli olmayan kullanıcıların düşeceği varsayılan rota — Sefer Takibi.
 * Hem ilk açılışta `/` redirect'i hem de `/pl-cost` guard'ı buraya yönlendirir.
 */
export const DEFAULT_ALLOWED_ROUTE = "/projects";

/**
 * Aktif kullanıcının kısıtlı rotaları (Anasayfa + Trade Cost) görüp
 * göremeyeceğini döndürür. Mock/dev modunda gerçek kimlik olmadığı için
 * kısıtlama uygulanmaz (yerel geliştirme tüm menüleri görür).
 */
export function useCanSeeRestricted(): boolean {
  const { accounts, instance } = useMsal();
  const email = ((accounts[0] ?? instance.getActiveAccount())?.username ?? "")
    .trim()
    .toLowerCase();
  return shouldUseMock() || RESTRICTED_NAV_EMAILS.has(email);
}
