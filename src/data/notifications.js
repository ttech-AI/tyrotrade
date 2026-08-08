export const notifications = [
  {
    id: "n1",
    appId: "tyrosign",
    titleKey: "notif.newApproval",
    body: { tr: "Yeni bir sözleşme onay bekliyor.", en: "A new contract is awaiting approval." },
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
  },
  {
    id: "n2",
    appId: "tyrostrategy",
    titleKey: "notif.goalUpdated",
    body: { tr: "Q3 ihracat hedefi güncellendi.", en: "Q3 export target was updated." },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read: false,
  },
  {
    id: "n3",
    appId: "tyro-aiops",
    titleKey: "notif.systemAlert",
    body: { tr: "P2 uyarısı oluştu ve çözüldü.", en: "A P2 alert was raised and resolved." },
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    read: false,
  },
]

export const unreadCount = notifications.filter((n) => !n.read).length
