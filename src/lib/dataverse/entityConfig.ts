/**
 * Read-only Data Inspector entity catalog.
 *
 * Each entry describes an entity set we can list in the Data Management
 * page. Field names are NOT pre-declared — we discover them by fetching
 * actual rows and inspecting the response.
 */

export interface InspectorEntityConfig {
  /** Internal key (also used in URL: /data/:key) */
  key: string;
  /** Tab/title shown to the user */
  label: string;
  /** Brief one-line description */
  description: string;
  /** Dataverse entity set name (the URL path segment) */
  entitySet: string;
  /** Default $filter applied on fetch (optional). */
  defaultFilter?: () => string | undefined;
  /** Hint text shown above the table */
  hint?: string;
}

export const INSPECTOR_ENTITIES: InspectorEntityConfig[] = [
  {
    key: "projects",
    label: "Projeler",
    description: "Proje header tablosu (mserp_etgtryprojecttableentities)",
    entitySet: "mserp_etgtryprojecttableentities",
    defaultFilter: () =>
      "mserp_dlvmode eq 'Gemi' and mserp_tryprojectsegment ne null",
    hint: "Teslimat şekli 'Gemi' + segment dolu projeler çekilir.",
  },
  {
    key: "sub-projects",
    label: "Alt Projeler",
    description:
      "Alt-proje tablosu (mserp_trysubprojectentities) — projeleri sefer/dönem bazlı leg'lere bölen alt kayıtlar",
    entitySet: "mserp_trysubprojectentities",
    hint:
      "Yalnızca cache'te zaten olan projelerin alt satırları çekilir (mserp_projid IN [...]).",
  },
  {
    key: "sub-project-details",
    label: "Alt Proje Satırları",
    description:
      "Alt-proje detay satırları (mserp_trysubprojectdetailsentities) — her leg'in itinerary'si",
    entitySet: "mserp_trysubprojectdetailsentities",
    hint:
      "Yalnızca cache'teki alt-proje ID'lerine bağlı satırlar çekilir (mserp_subprojectid IN [...]).",
  },
  {
    key: "project-ship",
    label: "Proje-Gemi Planı",
    description:
      "Proje-Gemi ilişkisi (mserp_tryaiprojectshiprelationentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectshiprelationentities",
    hint:
      "Tüm satırlar çekilir; üst projelerle eşleştirme client tarafında yapılır (alan adlarını gördükten sonra).",
  },
  {
    key: "project-lines",
    label: "Proje Satırları",
    description:
      "Proje line items (mserp_tryaiprojectlineentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectlineentities",
  },
  {
    key: "expense-lines",
    label: "Tahmini Gider Satırları",
    description:
      "Other expense satırları (mserp_tryaiotherexpenseentities) — projectId (mserp_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaiotherexpenseentities",
  },
  {
    key: "actual-expense-lines",
    label: "Gerçekleşen Gider Satırları",
    description:
      "Realised expense distribution (mserp_tryaifrtexpenselinedistlineentities) — projectId (mserp_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaifrtexpenselinedistlineentities",
  },
  {
    key: "purchase-lines",
    label: "Proje Satınalma Satırları",
    description:
      "Realised project purchases — vendor invoice transactions (mserp_tryaivendinvoicetransentities) — projectId (mserp_purchtable_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaivendinvoicetransentities",
  },
  {
    key: "budget-lines",
    label: "Tahmini Bütçe (Segment)",
    description:
      "Segment-bazlı bütçe (mserp_tryaiprojectbudgetlineentities) — segment üzerinden",
    entitySet: "mserp_tryaiprojectbudgetlineentities",
  },
];

export function findEntityConfig(key: string): InspectorEntityConfig | undefined {
  return INSPECTOR_ENTITIES.find((e) => e.key === key);
}
