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
  { left: '8%', top: '12%', size: 72, duration: 7, delay: 0, rotate: -12 },
  { left: '78%', top: '8%', size: 96, duration: 9, delay: 1.2, rotate: 18 },
  { left: '85%', top: '55%', size: 64, duration: 8, delay: 0.6, rotate: -8 },
  { left: '5%', top: '62%', size: 88, duration: 10, delay: 2, rotate: 14 },
  { left: '42%', top: '4%', size: 56, duration: 6.5, delay: 0.3, rotate: 6 },
  { left: '55%', top: '78%', size: 80, duration: 8.5, delay: 1.5, rotate: -16 },
  { left: '22%', top: '82%', size: 68, duration: 7.5, delay: 0.9, rotate: 10 },
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
              transform: `rotate(${donut.rotate}deg)`,
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
