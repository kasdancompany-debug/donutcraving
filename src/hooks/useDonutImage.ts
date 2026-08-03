import { useEffect, useState } from 'react';
import {
  DONUT_IMAGE_PATH,
  DONUT_WHITE_IMAGE_PATH,
} from '../config/branding';
import {
  getDonutImageDataUrl,
  getPremiumDonutDataUrl,
  USE_PROCEDURAL_DONUT,
} from '../utils/donutRenderer';

/** Primary donut (blueberry) for UI that needs a single asset. */
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

export interface AttractDonutSources {
  blueberry: string | null;
  white: string | null;
}

/** Both glaze variants for the attract homescreen mix. */
export function useAttractDonutSources(): AttractDonutSources {
  const [sources, setSources] = useState<AttractDonutSources>({
    blueberry: null,
    white: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (USE_PROCEDURAL_DONUT) {
        const url = getPremiumDonutDataUrl();
        if (!cancelled) setSources({ blueberry: url, white: url });
        return;
      }

      try {
        const [blueberry, white] = await Promise.all([
          getDonutImageDataUrl(DONUT_IMAGE_PATH),
          getDonutImageDataUrl(DONUT_WHITE_IMAGE_PATH),
        ]);
        if (!cancelled) setSources({ blueberry, white });
      } catch {
        const fallback = getPremiumDonutDataUrl();
        if (!cancelled) setSources({ blueberry: fallback, white: fallback });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return sources;
}
