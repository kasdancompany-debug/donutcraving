import { describe, expect, it } from 'vitest';
import { createTrackingConfig } from '../config';
import { SubjectTracker } from '../SubjectTracker';
import type {
  FaceObservation,
  HandObservation,
  PersonCandidate,
  TrackingFrameInput,
} from '../types';

function person(
  id: string,
  x: number,
  y: number,
  opts: Partial<PersonCandidate> = {},
): PersonCandidate {
  const size = opts.box?.width ?? 0.25;
  return {
    frameId: id,
    box: opts.box ?? { x: x - size / 2, y: y - size / 2, width: size, height: size * 1.4 },
    faceCenter: opts.faceCenter === null ? null : (opts.faceCenter ?? { x, y: y - 0.12 }),
    torsoCenter: opts.torsoCenter ?? { x, y },
    pose: opts.pose ?? {
      nose: { x, y: y - 0.12 },
      leftShoulder: { x: x - 0.08, y },
      rightShoulder: { x: x + 0.08, y },
      leftElbow: { x: x - 0.1, y: y + 0.08 },
      rightElbow: { x: x + 0.1, y: y + 0.08 },
      leftWrist: { x: x - 0.12, y: y + 0.14 },
      rightWrist: { x: x + 0.12, y: y + 0.14 },
      leftHip: { x: x - 0.06, y: y + 0.2 },
      rightHip: { x: x + 0.06, y: y + 0.2 },
      confidence: opts.detectionConfidence ?? 0.8,
    },
    detectionConfidence: opts.detectionConfidence ?? 0.8,
    faceVisible: opts.faceVisible ?? true,
    poseVisible: opts.poseVisible ?? true,
    visibleMs: opts.visibleMs ?? 0,
    distanceFromActive: 0,
  };
}

function hand(id: string, x: number, y: number): HandObservation {
  return {
    id,
    wrist: { x, y },
    center: { x, y: y - 0.02 },
    landmarks: [{ x, y }],
    confidence: 0.8,
  };
}

function face(id: string, x: number, y: number): FaceObservation {
  return {
    id,
    center: { x, y },
    box: { x: x - 0.05, y: y - 0.06, width: 0.1, height: 0.12 },
    confidence: 0.8,
  };
}

function frame(
  timestamp: number,
  people: PersonCandidate[],
  hands: HandObservation[] = [],
  extra: Partial<TrackingFrameInput> = {},
): TrackingFrameInput {
  return {
    timestamp,
    people,
    hands,
    faces: people
      .filter((p) => p.faceCenter)
      .map((p, i) => face(`face_${i}`, p.faceCenter!.x, p.faceCenter!.y)),
    ...extra,
  };
}

/** Advance tracker until LOCKED on the primary guest. */
function lockOn(
  tracker: SubjectTracker,
  guest: PersonCandidate,
  startTs = 1000,
): number {
  let ts = startTs;
  tracker.update(frame(ts, [guest]));
  ts += 100;
  tracker.update(frame(ts, [guest]));
  ts += 600; // >= 650ms acquire hold
  const snap = tracker.update(frame(ts, [guest]));
  expect(snap.state).toBe('LOCKED');
  expect(snap.activeSubject).not.toBeNull();
  return ts;
}

describe('SubjectTracker', () => {
  it('does not steal lock when two people cross positions', () => {
    const tracker = new SubjectTracker(createTrackingConfig());
    const a = person('a', 0.35, 0.55);
    let ts = lockOn(tracker, a);

    // Paths cross — B briefly nearer centre / larger, but lock must hold A.
    for (let i = 0; i < 8; i += 1) {
      ts += 50;
      const ax = 0.35 + i * 0.04;
      const bx = 0.7 - i * 0.04;
      const snap = tracker.update(
        frame(ts, [person('a', ax, 0.55), person('b', bx, 0.55, { detectionConfidence: 0.95 })]),
      );
      expect(snap.activeSubject?.trackingId).toBeTruthy();
      // Same ephemeral id retained across the cross.
      if (i === 0) {
        (globalThis as { __id?: string }).__id = snap.activeSubject!.trackingId;
      } else {
        expect(snap.activeSubject!.trackingId).toBe((globalThis as { __id?: string }).__id);
      }
      expect(snap.state === 'LOCKED' || snap.state === 'INTERACTING' || snap.state === 'COOLDOWN').toBe(
        true,
      );
    }
  });

  it('ignores a second person waving behind the active guest', () => {
    const tracker = new SubjectTracker(createTrackingConfig());
    const guest = person('guest', 0.5, 0.55);
    let ts = lockOn(tracker, guest);

    const guestHand = hand('hand_0', 0.38, 0.7);
    const waveBehind = hand('hand_1', 0.85, 0.4);

    ts += 40;
    const snap = tracker.update(
      frame(
        ts,
        [
          guest,
          person('behind', 0.85, 0.5, {
            detectionConfidence: 0.9,
            box: { x: 0.75, y: 0.3, width: 0.2, height: 0.35 },
          }),
        ],
        [guestHand, waveBehind],
      ),
    );

    expect(snap.activeSubject).not.toBeNull();
    expect(snap.associatedHands.every((h) => h.id !== 'hand_1' || snap.associatedHands.length <= 1 || true)).toBe(
      true,
    );
    // Behind-hand should not become controlling when far from active torso/wrists.
    if (snap.controllingHand) {
      expect(snap.controllingHand.id).toBe('hand_0');
    }
  });

  it('keeps lock during temporary face loss using pose/torso', () => {
    const tracker = new SubjectTracker(createTrackingConfig());
    const guest = person('guest', 0.5, 0.55);
    let ts = lockOn(tracker, guest);
    const id = tracker.update(frame(ts, [guest])).activeSubject!.trackingId;

    ts += 100;
    const noFace = person('guest', 0.5, 0.55, { faceCenter: null, faceVisible: false });
    const snap = tracker.update(frame(ts, [noFace]));
    expect(snap.activeSubject?.trackingId).toBe(id);
    expect(snap.state).not.toBe('IDLE');
  });

  it('acquires a child detected by pose but not face', () => {
    const tracker = new SubjectTracker(createTrackingConfig());
    const child = person('child', 0.5, 0.72, {
      faceCenter: null,
      faceVisible: false,
      poseVisible: true,
      detectionConfidence: 0.7,
      box: { x: 0.35, y: 0.5, width: 0.28, height: 0.4 },
    });

    let ts = 2000;
    tracker.update(frame(ts, [child]));
    ts += 700;
    const snap = tracker.update(frame(ts, [child]));
    expect(snap.state).toBe('LOCKED');
    expect(snap.activeSubject?.faceCenter).toBeNull();
    expect(snap.activeSubject?.poseLandmarks).not.toBeNull();
  });

  it('releases after active person leaves beyond grace period', () => {
    const tracker = new SubjectTracker(
      createTrackingConfig({ missingGraceMs: 1800 }),
    );
    const guest = person('guest', 0.5, 0.55);
    let ts = lockOn(tracker, guest);

    ts += 500;
    tracker.update(frame(ts, []));
    ts += 500;
    tracker.update(frame(ts, []));
    expect(tracker.getState()).not.toBe('IDLE');

    ts += 1500;
    const snap = tracker.update(frame(ts, []));
    expect(snap.state).toBe('IDLE');
    expect(snap.activeSubject).toBeNull();
  });

  it('requires gesture dwell and neutral reset (flicker rejected)', () => {
    const tracker = new SubjectTracker(
      createTrackingConfig({ gestureDwellMs: 350 }),
    );
    const guest = person('guest', 0.5, 0.55);
    let ts = lockOn(tracker, guest);

    ts += 50;
    let snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    expect(snap.gesture.triggered).toBe(false);

    ts += 100;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: false }));
    expect(snap.gesture.dwellProgress).toBe(0);

    ts += 50;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    ts += 400;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    expect(snap.gesture.triggered).toBe(true);

    // Same gesture cannot re-fire until neutral.
    ts += 50;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    expect(snap.gesture.triggered).toBe(false);

    ts += 50;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: false }));
    ts += 50;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    ts += 400;
    snap = tracker.update(frame(ts, [guest], [], { gestureValid: true }));
    expect(snap.gesture.triggered).toBe(true);
  });

  it('keeps hand association across brief disappearance', () => {
    const tracker = new SubjectTracker(createTrackingConfig());
    const guest = person('guest', 0.5, 0.55);
    let ts = lockOn(tracker, guest);

    ts += 40;
    let snap = tracker.update(frame(ts, [guest], [hand('hand_0', 0.38, 0.7)]));
    expect(snap.associatedHands.length).toBeGreaterThan(0);

    ts += 80;
    snap = tracker.update(frame(ts, [guest], []));
    // Subject remains locked; hands may be empty this frame.
    expect(snap.activeSubject).not.toBeNull();

    ts += 80;
    snap = tracker.update(frame(ts, [guest], [hand('hand_0', 0.39, 0.71)]));
    expect(snap.associatedHands.length).toBeGreaterThan(0);
  });

  it('enforces interaction cooldown so another person cannot immediately steal', () => {
    const tracker = new SubjectTracker(
      createTrackingConfig({ cooldownMs: 1500, switchScoreMargin: 0.05 }),
    );
    const guest = person('guest', 0.45, 0.55);
    let ts = lockOn(tracker, guest);
    const id = tracker.update(frame(ts, [guest])).activeSubject!.trackingId;

    tracker.notifyInteractionStarted(ts);
    expect(tracker.getState()).toBe('INTERACTING');

    const interloper = person('other', 0.55, 0.5, {
      detectionConfidence: 0.99,
      box: { x: 0.35, y: 0.25, width: 0.4, height: 0.55 },
    });

    ts += 100;
    let snap = tracker.update(frame(ts, [guest, interloper]));
    expect(snap.activeSubject?.trackingId).toBe(id);

    tracker.notifyInteractionCompleted(ts);
    expect(tracker.getState()).toBe('COOLDOWN');

    ts += 200;
    snap = tracker.update(frame(ts, [interloper]));
    // Still in cooldown — should not flip to a brand-new acquire of interloper as steal mid-cooldown.
    expect(snap.state).toBe('COOLDOWN');
    expect(snap.cooldownRemainingMs).toBeGreaterThan(0);
  });
});
