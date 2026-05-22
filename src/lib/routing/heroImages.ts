/**
 * Voyage-status-aware hero images for the Project detail card.
 *
 * Tiryaki **dökme yük** (dry bulk: grain + oilseed) taşır — konteyner yok.
 * Görseller buna göre seçildi: bulk carrier'lar (handysize / supramax sınıfı)
 * deniz seferi yapan, tahıl yüklenen / boşaltılan gemiler. Konteyner gemisi
 * görseli koymak operasyonel gerçeklikle çelişiyor — kepçeyle (grab crane)
 * tahıl/küspe boşaltan dökme tonajlı gemiler kullanıyoruz.
 *
 *   pending      → bulk carrier limanda demirli, henüz yükleme başlamadı
 *   loading      → tahıl yüklemesi (drone view, port industrial)
 *   in-transit   → bulk carrier açık denizde seyirde
 *   completed    → liman ekipmanı yanında tahliye sonu / sefer tamamlandı
 *
 * URL'ler `curl -I` ile 200 doğrulandı (Phase: dökme görsel revize).
 */

import type { Project } from "@/lib/dataverse/entities";
import { isSea } from "@/lib/dataverse/entities";
import { selectStage } from "@/lib/selectors/project";

const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&fit=crop`;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/** Pending — large bulk carrier docked at port with visible cranes (henüz aktif yükleme yok). */
export const HERO_PENDING = pexels(13958473);

/** Loading — aerial view of cargo ship loading grain at a bustling industrial port. */
export const HERO_LOADING = pexels(19500302);

/** In-transit — large bulk carrier sailing through calm blue ocean. */
export const HERO_IN_TRANSIT = pexels(36269623);

/** Completed — bulk carrier docked at industrial harbor with loading equipment (tahliye / sefer kapanışı). */
export const HERO_COMPLETED = pexels(23119441);

/** Road / truck fallback for non-Gemi projects. */
export const HERO_ROAD = unsplash("1532330393533-443990a51d10");

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
