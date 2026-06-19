import { useEffect, useState } from 'react';
import { DONUT_IMAGE_PATH } from '../config/branding';
import {
  getDonutImageDataUrl,
  getPremiumDonutDataUrl,
  USE_PROCEDURAL_DONUT,
} from '../utils/donutRenderer';

/** Shared donut image source for UI elements (attract screen, etc.). */
export function useDonutImageSrc(): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const url = USE_PROCEDURAL_DONUT
          ? getPremiumDonutDataUrl()
          : await getDonutImageDataUrl(DONUT_IMAGE_PATH);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(getPremiumDonutDataUrl());
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return src;
}
