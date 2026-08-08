// İşletim sisteminin bildirim ayarlarına giden yol.
//
// Neden gerekiyor: sitenin izni ile İŞLETİM SİSTEMİNİN tarayıcıya verdiği izin
// iki ayrı şey. Birincisini biz isteyebiliyoruz (Notification.requestPermission);
// ikincisini bir web sayfası ne isteyebilir ne de okuyabilir. macOS'te Chrome
// "granted" izne sahipken Sistem Ayarları her bildirimi sessizce yutabilir ve
// bunu JavaScript'ten anlamanın hiçbir yolu yoktur.
//
// Elimizden gelen: kullanıcıyı doğru panele tek tıkla götürmek. URL şemaları
// resmî olarak belgelenmiş değil, sürümler arasında değişebilir — bu yüzden
// çağıran taraf her zaman yazılı tarifi de göstermeli, düğme tek yol olmamalı.

/** Ana ekrana eklenmiş (standalone) olarak mı çalışıyoruz? */
function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari'nin kendi bayrağı — display-mode'u desteklemiyor.
    window.navigator.standalone === true
  )
}

export function osNotificationSettings() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent

  // iOS'u macOS'ten AYIRMAK şart: ikisi de "Mac" içerebiliyor ama kuralları
  // taban tabana zıt. iOS'ta bildirim yalnızca ana ekrana eklenmiş uygulamada
  // çalışır (Safari sekmesinde Notification API'si hiç yoktur), ve iOS bir web
  // sayfasının Ayarlar'a derin bağlantı açmasına izin vermez — o yüzden url
  // null, yalnızca tarif veriyoruz.
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ masaüstü Safari gibi görünür; dokunma desteği ayırt ediyor.
    (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)

  if (isIOS) {
    return {
      os: "ios",
      url: null,
      hintKey: isStandalone() ? "chat.notify.help.ios" : "chat.notify.help.iosInstall",
    }
  }

  if (/Mac/i.test(ua)) {
    return {
      os: "mac",
      // macOS 13+ bu şemayı Bildirimler paneline yönlendiriyor. Tarayıcı
      // "System Settings'i açmak istiyor musunuz?" onayı gösterir.
      url: "x-apple.systempreferences:com.apple.preference.notifications",
      hintKey: "chat.notify.help.mac",
    }
  }
  if (/Windows/i.test(ua)) {
    return {
      os: "windows",
      url: "ms-settings:notifications",
      hintKey: "chat.notify.help.windows",
    }
  }
  return { os: "other", url: null, hintKey: "chat.notify.help.generic" }
}
