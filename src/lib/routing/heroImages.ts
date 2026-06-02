/**
 * Voyage-status-aware hero images for the Project detail card.
 *
 *   pending      → büyük cargo gemileri demirli, henüz yükleme yok
 *   loading      → tahıl yüklemesi (drone view, industrial port) —
 *                  eski konteyner kreyni görseli yerine; Tiryaki dökme
 *                  yük (grain / oilseed) taşır, konteyner kullanmıyor.
 *   in-transit   → büyük kargo gemisi açık denizde
 *   completed    → drone view, gemi tahliyeye yanaşmış
 *
 * URL'ler `curl -I` ile 200 doğrulandı.
 */

import type { Project } from "@/lib/dataverse/entities";
import { isSea } from "@/lib/dataverse/entities";
import { selectStage } from "@/lib/selectors/project";

const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&fit=crop`;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/** Pending — container ships moored at Hamburg terminal under clear sky. */
export const HERO_PENDING = pexels(31637365);

/** Loading — aerial view of cargo ship loading **grain** at a bustling
 *  industrial port. Eski "crane lifting containers" görseli operasyonel
 *  gerçeklikle çelişiyordu (biz dökme tahıl yapıyoruz) — yerine drone
 *  view tahıl yüklemesi. */
export const HERO_LOADING = pexels(19500302);

/** In-transit — large container ship crossing open sea (verified cargo, not a yacht). */
export const HERO_IN_TRANSIT = pexels(35982637);

/** Completed — drone view of vessel with cargo containers near pier (discharge). */
export const HERO_COMPLETED = pexels(6572431);

/** Road / truck fallback for non-Gemi projects. */
export const HERO_ROAD = unsplash("1532330393533-443990a51d10");

/** Office — team of coworkers in an open-plan office. Used when a
 *  project has no drawable route yet (both ports unresolved): the
 *  voyage hasn't left the desk — nomination pending / contract phase —
 *  so a ship/truck photo is misleading. "Hala ofis çalışmasında." */
export const HERO_OFFICE = pexels(5324900);

/** Port is "resolved" when it has a real name (not the "—" sentinel)
 *  AND non-(0,0) coords. Mirrors `isPortDefined` in RouteMap so the
 *  hero image and the map empty-state agree on what "no route" means. */
function isPortResolved(
  p?: { name?: string; lat?: number; lon?: number } | null
): boolean {
  if (!p) return false;
  const hasName =
    typeof p.name === "string" && p.name.trim().length > 0 && p.name !== "—";
  const hasCoords =
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    (p.lat !== 0 || p.lon !== 0);
  return hasName && hasCoords;
}

/**
 * Pick the hero image URL for a project based on its current voyage
 * stage. Honours an explicit override (`vesselPlan.heroImageUrl`) when
 * the composer happens to set one (mock data does; real data won't).
 */
export function selectHeroImage(
  project: Project,
  now: Date = new Date()
): string {
  const explicit = project.vesselPlan?.heroImageUrl;
  if (explicit) return explicit;

  // No drawable route — BOTH loading & discharge ports unresolved.
  // These projects are still desk work (To Be Nominated / contract
  // phase), so a vessel/truck photo reads as irrelevant. Show the
  // office image instead — same "no route" signal the map uses for
  // its "limanlar girilmemiş" empty state.
  const lpResolved = isPortResolved(project.vesselPlan?.loadingPort);
  const dpResolved = isPortResolved(project.vesselPlan?.dischargePort);
  if (!lpResolved && !dpResolved) return HERO_OFFICE;

  if (!isSea(project)) return HERO_ROAD;

  // Stage from milestones + vesselStatus. Falls back to vesselStatus alone
  // when no milestones are populated yet.
  const stage = selectStage(project, now);
  if (stage) {
    if (stage === "discharged") return HERO_COMPLETED;
    if (stage === "in-transit" || stage === "at-discharge-port") {
      return HERO_IN_TRANSIT;
    }
    if (stage === "loading" || stage === "at-loading-port") {
      return HERO_LOADING;
    }
    // pre-loading falls through to status-based pick
  }

  const vs = project.vesselPlan?.vesselStatus;
  if (vs === "Completed") return HERO_COMPLETED;
  if (vs === "Commenced") return HERO_IN_TRANSIT;
  return HERO_PENDING;
}
