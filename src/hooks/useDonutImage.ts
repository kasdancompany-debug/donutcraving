import { useEffect, useState } from 'react';
import { DONUT_IMAGE_PATH } from '../config/branding';
import {
  getPremiumDonutDataUrl,
  loadDonutImage,
  USE_PROCEDURAL_DONUT,
} from '../utils/donutRenderer';

/** Shared donut image source for UI elements (attract screen, etc.). */
export function useDonutImageSrc(): string {
  const [src, setSrc] = useState(() =>
    USE_PROCEDURAL_DONUT ? getPremiumDonutDataUrl() : DONUT_IMAGE_PATH,
  );

  useEffect(() => {
    if (USE_PROCEDURAL_DONUT) {
      setSrc(getPremiumDonutDataUrl());
      return;
    }

    let cancelled = false;
    loadDonutImage(DONUT_IMAGE_PATH)
      .then((image) => {
        if (!cancelled) setSrc(image.src);
      })
      .catch(() => {
        if (!cancelled) setSrc(getPremiumDonutDataUrl());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return src;
}
