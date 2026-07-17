import { useCallback, useMemo, useState } from 'react';
import { MirrorCanvas } from '../components/MirrorCanvas';
import { useFaceTracking } from '../hooks/useFaceTracking';
import { useHandTracking } from '../hooks/useHandTracking';
import { usePoseTracking } from '../hooks/usePoseTracking';
import {
  type ReplaySpeed,
  useReplayCamera,
} from '../hooks/useReplayCamera';
import {
  DEFAULT_TRACKING_CONFIG,
  exportTrackingConfigJson,
  summarizeTrackingSession,
  type PlaybackSummary,
  type TrackingConfig,
  type TrackingEvent,
} from '../tracking';
import './ReplayLab.css';

const SPEEDS: ReplaySpeed[] = [0.25, 0.5, 1, 2];

const TUNABLE: Array<{
  key: keyof TrackingConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'acquireHoldMs', label: 'Acquire hold (ms)', min: 100, max: 2000, step: 50 },
  { key: 'missingGraceMs', label: 'Missing grace (ms)', min: 200, max: 4000, step: 100 },
  { key: 'cooldownMs', label: 'Cooldown (ms)', min: 0, max: 4000, step: 100 },
  { key: 'gestureDwellMs', label: 'Gesture dwell (ms)', min: 50, max: 1500, step: 50 },
  { key: 'acquireConfidence', label: 'Acquire confidence', min: 0.1, max: 0.9, step: 0.01 },
  { key: 'keepConfidence', label: 'Keep confidence', min: 0.05, max: 0.8, step: 0.01 },
  { key: 'switchScoreMargin', label: 'Switch score margin', min: 0, max: 0.5, step: 0.01 },
  { key: 'smoothingAlpha', label: 'Smoothing alpha', min: 0.05, max: 0.9, step: 0.01 },
  { key: 'minBodyArea', label: 'Min body area', min: 0.005, max: 0.1, step: 0.001 },
  { key: 'handLandmarkProximity', label: 'Hand landmark proximity', min: 0.05, max: 0.3, step: 0.01 },
];

/**
 * Development-only recorded-session lab.
 * Never mounted in production builds (see main.tsx + isReplayLabEnabled).
 */
export function ReplayLab() {
  const replay = useReplayCamera();
  const { status: handStatus, detect, error: handError } = useHandTracking({ lite: true });
  const { status: faceStatus, detect: detectFace } = useFaceTracking({ enabled: true });
  const { status: poseStatus, detect: detectPose } = usePoseTracking({
    enabled: true,
    lite: true,
  });

  const [config, setConfig] = useState<TrackingConfig>({ ...DEFAULT_TRACKING_CONFIG });
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [inferenceSamples, setInferenceSamples] = useState<number[]>([]);
  const [summary, setSummary] = useState<PlaybackSummary | null>(null);
  const [recalibrateToken, setRecalibrateToken] = useState(0);
  const [mirrorFeed, setMirrorFeed] = useState(true);

  const modelsReady =
    handStatus === 'ready' &&
    (faceStatus === 'ready' || faceStatus === 'error') &&
    (poseStatus === 'ready' || poseStatus === 'error' || poseStatus === 'disabled');

  const performance = useMemo(
    () => ({
      lite: true,
      trackIntervalMs: 0,
      enableBite: false,
    }),
    [],
  );

  const onTrackingEvent = useCallback((event: TrackingEvent) => {
    setEvents((prev) => [...prev.slice(-400), event]);
  }, []);

  const onInferenceSample = useCallback((inferenceMs: number) => {
    setInferenceSamples((prev) => [...prev.slice(-500), inferenceMs]);
  }, []);

  const clearSession = useCallback(() => {
    setEvents([]);
    setInferenceSamples([]);
    setSummary(null);
    setRecalibrateToken((token) => token + 1);
    replay.restart();
  }, [replay]);

  const finishPlayback = useCallback(() => {
    setSummary(summarizeTrackingSession(events, inferenceSamples));
    replay.pause();
  }, [events, inferenceSamples, replay]);

  const exportConfig = useCallback(() => {
    const blob = new Blob([exportTrackingConfigJson(config)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'donut-tracking-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const onFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    clearSession();
    void replay.loadFile(file);
  };

  return (
    <div className="replay-lab">
      <video ref={replay.videoRef} className="hidden-video" playsInline muted />

      <div className="replay-stage">
        {replay.status === 'ready' && modelsReady ? (
          <MirrorCanvas
            videoRef={replay.videoRef}
            detect={detect}
            detectFace={detectFace}
            detectPose={detectPose}
            trackingReady={handStatus === 'ready'}
            faceReady={faceStatus === 'ready'}
            poseReady={poseStatus === 'ready' || poseStatus === 'disabled'}
            faceStatus={faceStatus}
            started
            debugMode
            forceDebugOverlay
            useVideoTimestamps
            trackingConfig={config}
            stepToken={replay.stepToken}
            mirrorFeed={mirrorFeed}
            recalibrateToken={recalibrateToken}
            performance={performance}
            camRotate={0}
            waveToStart={false}
            onTrackingEvent={onTrackingEvent}
            onInferenceSample={onInferenceSample}
          />
        ) : (
          <div className="replay-empty">
            <h1>Recording replay lab</h1>
            <p>DEV only — load an MP4/WebM café recording to test tracking edge cases.</p>
            {(replay.error || handError) && (
              <p className="replay-error">{replay.error ?? handError}</p>
            )}
          </div>
        )}
      </div>

      <aside className="replay-panel">
        <section>
          <h2>Source</h2>
          <label className="replay-file">
            <input
              type="file"
              accept="video/mp4,video/webm,video/*"
              onChange={(event) => onFile(event.target.files)}
            />
            {replay.fileName ?? 'Choose MP4 / WebM'}
          </label>
          <label className="replay-check">
            <input
              type="checkbox"
              checked={mirrorFeed}
              onChange={(event) => setMirrorFeed(event.target.checked)}
            />
            Mirror feed (selfie)
          </label>
        </section>

        <section>
          <h2>Playback</h2>
          <div className="replay-row">
            <button type="button" onClick={() => (replay.paused ? replay.play() : replay.pause())}>
              {replay.paused ? 'Play' : 'Pause'}
            </button>
            <button type="button" onClick={() => replay.stepFrame(-1)}>
              −1 frame
            </button>
            <button type="button" onClick={() => replay.stepFrame(1)}>
              +1 frame
            </button>
            <button type="button" onClick={clearSession}>
              Restart
            </button>
            <button type="button" onClick={finishPlayback}>
              Summarize
            </button>
          </div>
          <div className="replay-row">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={replay.speed === value ? 'is-active' : undefined}
                onClick={() => replay.setSpeed(value)}
              >
                {value}x
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={replay.duration || 0}
            step={0.01}
            value={replay.currentTime}
            onChange={(event) => replay.seek(Number(event.target.value))}
            disabled={replay.status !== 'ready'}
          />
          <p className="replay-meta">
            {replay.currentTime.toFixed(2)}s / {(replay.duration || 0).toFixed(2)}s · media{' '}
            {Math.round(replay.currentTime * 1000)}ms
          </p>
        </section>

        <section>
          <h2>Thresholds</h2>
          <div className="replay-row">
            <button type="button" onClick={exportConfig}>
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...DEFAULT_TRACKING_CONFIG })}
            >
              Reset defaults
            </button>
          </div>
          {TUNABLE.map((field) => (
            <label key={field.key} className="replay-slider">
              <span>
                {field.label}:{' '}
                <strong>
                  {Number(config[field.key]).toFixed(
                    field.step < 1 ? 2 : 0,
                  )}
                </strong>
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(config[field.key])}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    [field.key]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </section>

        <section>
          <h2>Event log</h2>
          <div className="replay-log">
            {events.length === 0 && <p className="replay-meta">No events yet.</p>}
            {[...events].reverse().map((event, index) => (
              <div key={`${event.timestamp}-${event.type}-${index}`} className="replay-log-line">
                <code>{event.timestamp}ms</code> {event.type}
                {event.subjectId ? ` · ${event.subjectId}` : ''}
                {event.detail ? ` · ${event.detail}` : ''}
              </div>
            ))}
          </div>
        </section>

        {summary && (
          <section>
            <h2>Playback summary</h2>
            <ul className="replay-summary">
              <li>Subject switches: {summary.subjectSwitches}</li>
              <li>False / cancelled gestures: {summary.falseTriggers}</li>
              <li>Lost locks (temporary missing): {summary.lostLocks}</li>
              <li>Reacquisitions: {summary.reacquisitions}</li>
              <li>Avg inference: {summary.averageInferenceMs.toFixed(1)} ms</li>
              <li>Events: {summary.totalEvents}</li>
              <li>Span: {summary.durationMs} ms</li>
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
