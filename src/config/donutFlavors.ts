/**
 * Donut flavor registry — the game element. Each locked guest is randomly
 * assigned one of these for their whole turn, so "what you get" varies
 * person to person instead of always being the same blueberry donut.
 *
 * To add a flavor: drop a transparent PNG (same framing as the existing
 * assets — single donut, 3/4 top-down, nothing touching the image edges)
 * into public/assets/donuts/ and add an entry below.
 */
import { DONUT_IMAGE_PATH, DONUT_WHITE_IMAGE_PATH } from './branding';

export interface DonutFlavor {
  id: string;
  /** Short — used in "You desire… the X." Keep to 2-3 words, no trailing period. */
  desireLabel: string;
  imagePath: string;
}

/**
 * Only the two proven, already-correctly-styled assets ship for now.
 * Six more flavors (chocolate, strawberry, matcha, maple-bacon,
 * rainbow-sprinkle, salted-caramel) are mid-flight — see the
 * donut-flavor-art-pending project memory for status. Add entries back
 * here once their art matches donut-blueberry.png's painted-illustration
 * style; everything else (random assignment, preloading, desire text) is
 * already built to scale to any number of flavors.
 */
export const DONUT_FLAVORS: DonutFlavor[] = [
  {
    id: 'blueberry',
    desireLabel: 'Blueberry Hibiscus',
    imagePath: DONUT_IMAGE_PATH,
  },
  {
    id: 'vanilla',
    desireLabel: 'Vanilla Bean',
    imagePath: DONUT_WHITE_IMAGE_PATH,
  },
];

export function getDefaultFlavor(): DonutFlavor {
  return DONUT_FLAVORS[0];
}

/**
 * Random flavor for a newly-locked guest. Avoids repeating the last one
 * shown, and — if given the set of flavor ids that actually finished
 * preloading — only picks among those, so a flavor whose art failed to
 * load never gets handed to a guest.
 */
export function pickRandomFlavor(
  excludeId: string | null,
  availableIds?: ReadonlySet<string> | null,
): DonutFlavor {
  let pool = DONUT_FLAVORS;

  if (availableIds && availableIds.size > 0) {
    const restricted = DONUT_FLAVORS.filter((flavor) => availableIds.has(flavor.id));
    if (restricted.length > 0) pool = restricted;
  }

  if (excludeId && pool.length > 1) {
    const withoutLast = pool.filter((flavor) => flavor.id !== excludeId);
    if (withoutLast.length > 0) pool = withoutLast;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
