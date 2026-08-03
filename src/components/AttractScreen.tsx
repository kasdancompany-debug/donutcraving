import {
  ATTRACT_EYEBROW,
  ATTRACT_HEADLINE,
  ATTRACT_SUBTEXT,
  ATTRACT_SUBTEXT_WAVE,
} from '../config/branding';
import { useAttractDonutSources } from '../hooks/useDonutImage';
import { QRCodePanel } from './QRCodePanel';

interface AttractScreenProps {
  visible: boolean;
  onStart: () => void;
  subtext?: string;
  waveMode?: boolean;
}

const FLOATING_DONUTS = [
  { left: '6%', top: '10%', size: 118, duration: 6.5, delay: 0, rotate: -14, drift: 1.15, variant: 'blueberry' },
  { left: '80%', top: '6%', size: 52, duration: 8.2, delay: 1.1, rotate: 22, drift: 0.85, variant: 'white' },
  { left: '88%', top: '48%', size: 96, duration: 7.4, delay: 0.4, rotate: -10, drift: 1, variant: 'blueberry' },
  { left: '3%', top: '58%', size: 74, duration: 9.1, delay: 1.8, rotate: 16, drift: 0.9, variant: 'white' },
  { left: '44%', top: '2%', size: 42, duration: 5.8, delay: 0.2, rotate: 8, drift: 1.2, variant: 'blueberry' },
  { left: '58%', top: '76%', size: 132, duration: 7.8, delay: 1.3, rotate: -18, drift: 1.05, variant: 'white' },
  { left: '18%', top: '80%', size: 58, duration: 6.9, delay: 0.7, rotate: 12, drift: 0.95, variant: 'blueberry' },
  { left: '72%', top: '28%', size: 38, duration: 8.6, delay: 2.1, rotate: -6, drift: 1.1, variant: 'white' },
] as const;

export function AttractScreen({ visible, onStart, subtext, waveMode = false }: AttractScreenProps) {
  const donutSources = useAttractDonutSources();

  if (!visible) return null;

  const content = (
    <>
      {FLOATING_DONUTS.map((donut, index) => {
        const src =
          donut.variant === 'blueberry'
            ? donutSources.blueberry
            : donutSources.white;
        if (!src) return null;
        return (
          <img
            key={index}
            src={src}
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
        );
      })}

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

  return (
    <button
      type="button"
      className={`attract-screen${waveMode ? ' attract-screen--wave' : ''}`}
      onClick={onStart}
      aria-label={
        waveMode
          ? 'Wave your hand or tap to begin'
          : 'Begin the desire mirror experience'
      }
    >
      {content}
    </button>
  );
}
