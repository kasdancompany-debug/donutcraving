import {
  ATTRACT_EYEBROW,
  ATTRACT_HEADLINE,
  ATTRACT_SUBTEXT,
  ATTRACT_SUBTEXT_WAVE,
} from '../config/branding';
import { useDonutImageSrc } from '../hooks/useDonutImage';
import { QRCodePanel } from './QRCodePanel';

interface AttractScreenProps {
  visible: boolean;
  onStart: () => void;
  subtext?: string;
  waveMode?: boolean;
}

const FLOATING_DONUTS = [
  { left: '6%', top: '10%', size: 118, duration: 6.5, delay: 0, rotate: -14, drift: 1.15 },
  { left: '80%', top: '6%', size: 52, duration: 8.2, delay: 1.1, rotate: 22, drift: 0.85 },
  { left: '88%', top: '48%', size: 96, duration: 7.4, delay: 0.4, rotate: -10, drift: 1 },
  { left: '3%', top: '58%', size: 74, duration: 9.1, delay: 1.8, rotate: 16, drift: 0.9 },
  { left: '44%', top: '2%', size: 42, duration: 5.8, delay: 0.2, rotate: 8, drift: 1.2 },
  { left: '58%', top: '76%', size: 132, duration: 7.8, delay: 1.3, rotate: -18, drift: 1.05 },
  { left: '18%', top: '80%', size: 58, duration: 6.9, delay: 0.7, rotate: 12, drift: 0.95 },
  { left: '72%', top: '28%', size: 38, duration: 8.6, delay: 2.1, rotate: -6, drift: 1.1 },
] as const;

export function AttractScreen({ visible, onStart, subtext, waveMode = false }: AttractScreenProps) {
  const donutSrc = useDonutImageSrc();

  if (!visible) return null;

  const content = (
    <>
      <div className="attract-screen-glow" aria-hidden />

      {donutSrc &&
        FLOATING_DONUTS.map((donut, index) => (
          <img
            key={index}
            src={donutSrc}
            alt=""
            aria-hidden
            className="attract-floating-donut"
            style={{
              left: donut.left,
              top: donut.top,
              width: donut.size,
              height: donut.size,
              animationDuration: `${donut.duration}s`,
              animationDelay: `${donut.delay}s`,
              ['--donut-tilt' as string]: `${donut.rotate}deg`,
              ['--donut-drift' as string]: String(donut.drift),
            }}
          />
        ))}

      <div className="attract-content">
        <p className="attract-eyebrow">{ATTRACT_EYEBROW}</p>
        <h1 className="attract-headline">{ATTRACT_HEADLINE}</h1>
        <p className="attract-subtext">
          {subtext ?? (waveMode ? ATTRACT_SUBTEXT_WAVE : ATTRACT_SUBTEXT)}
        </p>
      </div>

      <div className="attract-qr">
        <QRCodePanel compact />
      </div>
    </>
  );

  if (waveMode) {
    return (
      <div className="attract-screen attract-screen--wave" aria-label="Wave to begin">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="attract-screen"
      onClick={onStart}
      aria-label="Begin the desire mirror experience"
    >
      {content}
    </button>
  );
}
