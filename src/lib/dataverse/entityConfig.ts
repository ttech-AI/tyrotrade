/**
 * Read-only Data Inspector entity catalog.
 *
 * Each entry describes an entity set we can list in the Data Management
 * page. Field names are NOT pre-declared — we discover them by fetching
 * actual rows and inspecting the response.
 */

import { PROJECTS_FILTER } from "@/lib/dataverse/refreshAll";

export interface InspectorEntityConfig {
  /** Internal key (also used in URL: /data/:key) */
  key: string;
  /** Tab/title shown to the user (Turkish fallback when `labelKey` unset). */
  label: string;
  /** i18n key resolved via `useT()` at the call site; falls back to `label`. */
  labelKey?: string;
  /** Brief one-line description (Turkish fallback). */
  description: string;
  /** Dataverse entity set name (the URL path segment) */
  entitySet: string;
  /** Default $filter applied on fetch (optional). */
  defaultFilter?: () => string | undefined;
  /** Hint text shown above the table (Turkish fallback when `hintKey` unset). */
  hint?: string;
  /** i18n key resolved via `useT()` at the call site; falls back to `hint`. */
  hintKey?: string;
}

export const INSPECTOR_ENTITIES: InspectorEntityConfig[] = [
  {
    key: "projects",
    label: "Projeler",
    labelKey: "dm.tab.projects",
    description: "Proje header tablosu (mserp_etgtryprojecttableentities)",
    entitySet: "mserp_etgtryprojecttableentities",
    // Same `PROJECTS_FILTER` constant the refresh chain + the
    // DataManagementPage main projects hook use — single source of
    // truth so the ORGANIK01 exception (and any future whitelist
    // additions) propagate everywhere automatically.
    defaultFilter: () => PROJECTS_FILTER,
    hint:
      "Teslimat şekli 'Gemi' + segment dolu projeler ile istisna projid'ler çekilir.",
    hintKey: "dm.entity.projects.hint",
  },
  {
    key: "sub-projects",
    label: "Alt Projeler",
    labelKey: "dm.tab.subProjects",
    description:
      "Alt-proje tablosu (mserp_trysubprojectentities) — projeleri sefer/dönem bazlı leg'lere bölen alt kayıtlar",
    entitySet: "mserp_trysubprojectentities",
    hint:
      "Yalnızca cache'te zaten olan projelerin alt satırları çekilir (mserp_projid IN [...]).",
    hintKey: "dm.entity.subProjects.hint",
  },
  {
    key: "sub-project-details",
    label: "Alt Proje Satırları",
    labelKey: "dm.tab.subProjectDetails",
    description:
      "Alt-proje detay satırları (mserp_trysubprojectdetailsentities) — her leg'in itinerary'si",
    entitySet: "mserp_trysubprojectdetailsentities",
    hint:
      "Yalnızca cache'teki alt-proje ID'lerine bağlı satırlar çekilir (mserp_subprojectid IN [...]).",
    hintKey: "dm.entity.subProjectDetails.hint",
  },
  {
    key: "project-ship",
    label: "Proje-Gemi Planı",
    labelKey: "dm.tab.ship",
    description:
      "Proje-Gemi ilişkisi (mserp_tryaiprojectshiprelationentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectshiprelationentities",
    hint:
      "Tüm satırlar çekilir; üst projelerle eşleştirme client tarafında yapılır (alan adlarını gördükten sonra).",
    hintKey: "dm.entity.ship.hint",
  },
  {
    key: "project-lines",
    label: "Proje Satırları",
    labelKey: "dm.tab.lines",
    description:
      "Proje line items (mserp_tryaiprojectlineentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectlineentities",
  },
  {
    key: "expense-lines",
    label: "Tahmini Gider Satırları",
    labelKey: "dm.tab.expense",
    description:
      "Other expense satırları (mserp_tryaiotherexpenseentities) — projectId (mserp_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaiotherexpenseentities",
  },
  {
    key: "actual-expense-lines",
    label: "Gerçekleşen Gider Satırları",
    labelKey: "dm.tab.actualExpense",
    description:
      "Realised expense distribution (mserp_tryaifrtexpenselinedistlineentities) — projectId (mserp_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaifrtexpenselinedistlineentities",
  },
  {
    key: "purchase-lines",
    label: "Proje Satınalma Satırları",
    labelKey: "dm.tab.purchase",
    description:
      "Realised project purchases — vendor invoice transactions (mserp_tryaivendinvoicetransentities) — projectId (mserp_purchtable_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaivendinvoicetransentities",
  },
  {
    key: "budget-lines",
    label: "Tahmini Bütçe (Segment)",
    labelKey: "dm.tab.budget",
    description:
      "Segment-bazlı bütçe (mserp_tryaiprojectbudgetlineentities) — segment üzerinden",
    entitySet: "mserp_tryaiprojectbudgetlineentities",
  },
];

export function findEntityConfig(key: string): InspectorEntityConfig | undefined {
  return INSPECTOR_ENTITIES.find((e) => e.key === key);
}
