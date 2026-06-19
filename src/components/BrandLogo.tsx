import { useEffect, useState } from 'react';
import { KASDAN_LOGO_PATH } from '../config/branding';
import { knockOutDarkBackground } from '../utils/donutRenderer';

export function BrandLogo() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      const canvas = knockOutDarkBackground(image, 42, 60);
      setSrc(canvas.toDataURL('image/png'));
    };

    image.src = KASDAN_LOGO_PATH;

    return () => {
      cancelled = true;
    };
  }, []);

  if (!src) return null;

  return (
    <div className="kiosk-brand-logo" aria-hidden>
      <img src={src} alt="" />
    </div>
  );
}
