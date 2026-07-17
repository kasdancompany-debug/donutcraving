import { CandidateScorer, candidateAnchor } from './CandidateScorer';
import { GestureStabilizer } from './GestureStabilizer';
import { HandAssociator } from './HandAssociator';
import {
  estimateVelocity,
  predictPoint,
  smoothBox,
  smoothPoint,
  type Point2,
} from './math';
import type {
  ActiveSubject,
  PersonCandidate,
  TrackingConfig,
  TrackingFrameInput,
  TrackingSnapshot,
  TrackingState,
} from './types';

interface ContinuityRecord {
  key: string;
  firstSeenAt: number;
  lastSeenAt: number;
  visibleMs: number;
  lastAnchor: Point2;
}

function makeTempId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Primary-subject tracking state machine:
 * IDLE → ACQUIRING → LOCKED → INTERACTING → COOLDOWN → IDLE
 */
export class TrackingStateMachine {
  private state: TrackingState = 'IDLE';
  private active: ActiveSubject | null = null;
  private acquiringKey: string | null = null;
  private acquiringSince: number | null = null;
  private cooldownUntil = 0;
  private lastTimestamp = 0;
  private continuity = new Map<string, ContinuityRecord>();
  private nextSubjectSerial = 1;

  private readonly config: TrackingConfig;
  private readonly scorer: CandidateScorer;
  private readonly hands: HandAssociator;
  private readonly gestures: GestureStabilizer;

  constructor(config: TrackingConfig) {
    this.config = config;
    this.scorer = new CandidateScorer(config);
    this.hands = new HandAssociator(config);
    this.gestures = new GestureStabilizer(config);
  }

  getState(): TrackingState {
    return this.state;
  }

  getActiveSubject(): ActiveSubject | null {
    return this.active;
  }

  reset(timestamp = 0): void {
    this.state = 'IDLE';
    this.active = null;
    this.acquiringKey = null;
    this.acquiringSince = null;
    this.cooldownUntil = 0;
    this.lastTimestamp = timestamp;
    this.continuity.clear();
    this.gestures.reset();
  }

  update(input: TrackingFrameInput): TrackingSnapshot {
    const dt = this.lastTimestamp > 0 ? input.timestamp - this.lastTimestamp : 0;
    this.lastTimestamp = input.timestamp;

    const previousActiveLoc = this.active
      ? this.active.faceCenter ?? this.active.torsoCenter
      : null;

    const enriched = this.enrichContinuity(input.people, input.timestamp);
    const ranked = this.scorer.rank(
      enriched,
      previousActiveLoc,
      this.state === 'IDLE' || this.state === 'ACQUIRING' || this.state === 'COOLDOWN',
    );

    const gesture = this.gestures.update(!!input.gestureValid, input.timestamp);

    switch (this.state) {
      case 'IDLE':
        this.stepIdle(ranked, input.timestamp);
        break;
      case 'ACQUIRING':
        this.stepAcquiring(ranked, input.timestamp);
        break;
      case 'LOCKED':
        this.stepLocked(ranked, input, dt);
        break;
      case 'INTERACTING':
        this.stepInteracting(ranked, input, dt);
        break;
      case 'COOLDOWN':
        this.stepCooldown(ranked, input, dt);
        break;
    }

    let associatedHands: TrackingSnapshot['associatedHands'] = [];
    let controllingHand: TrackingSnapshot['controllingHand'] = null;
    if (this.active) {
      const assoc = this.hands.associate(this.active, input.hands);
      this.active.leftHand = assoc.left;
      this.active.rightHand = assoc.right;
      associatedHands = assoc.associated;
      controllingHand = assoc.controlling;
    }

    return this.snapshot(ranked, gesture, input.timestamp, associatedHands, controllingHand);
  }

  /** Notify that an interaction began (donut control engaged). */
  notifyInteractionStarted(timestamp: number): void {
    if (this.state === 'LOCKED' || this.state === 'INTERACTING') {
      this.state = 'INTERACTING';
      this.cooldownUntil = Math.max(this.cooldownUntil, timestamp + this.config.cooldownMs);
    }
  }

  /** Notify that an interaction completed; enter cooldown before others can steal. */
  notifyInteractionCompleted(timestamp: number): void {
    this.cooldownUntil = timestamp + this.config.cooldownMs;
    this.state = 'COOLDOWN';
    this.gestures.reset();
  }

  private enrichContinuity(
    people: PersonCandidate[],
    timestamp: number,
  ): PersonCandidate[] {
    const matchedKeys = new Set<string>();

    const enriched = people.map((person) => {
      const anchor = candidateAnchor(person);
      let bestKey: string | null = null;
      let bestDist = 0.12;

      for (const [key, rec] of this.continuity) {
        const d = Math.hypot(rec.lastAnchor.x - anchor.x, rec.lastAnchor.y - anchor.y);
        if (d < bestDist) {
          bestDist = d;
          bestKey = key;
        }
      }

      const key = bestKey ?? person.frameId;
      matchedKeys.add(key);
      const existing = this.continuity.get(key);
      const visibleMs = existing
        ? existing.visibleMs + Math.max(0, timestamp - existing.lastSeenAt)
        : 0;

      this.continuity.set(key, {
        key,
        firstSeenAt: existing?.firstSeenAt ?? timestamp,
        lastSeenAt: timestamp,
        visibleMs,
        lastAnchor: anchor,
      });

      return {
        ...person,
        frameId: key,
        visibleMs,
      };
    });

    // Drop stale continuity records.
    for (const [key, rec] of this.continuity) {
      if (!matchedKeys.has(key) && timestamp - rec.lastSeenAt > this.config.missingGraceMs) {
        this.continuity.delete(key);
      }
    }

    return enriched;
  }

  private stepIdle(
    ranked: Array<PersonCandidate & { score: number }>,
    timestamp: number,
  ): void {
    this.active = null;
    const best = ranked[0];
    if (!best) {
      this.acquiringKey = null;
      this.acquiringSince = null;
      return;
    }
    this.acquiringKey = best.frameId;
    this.acquiringSince = timestamp;
    this.state = 'ACQUIRING';
  }

  private stepAcquiring(
    ranked: Array<PersonCandidate & { score: number }>,
    timestamp: number,
  ): void {
    const best = ranked[0];
    if (!best || best.frameId !== this.acquiringKey) {
      if (best) {
        this.acquiringKey = best.frameId;
        this.acquiringSince = timestamp;
      } else {
        this.acquiringKey = null;
        this.acquiringSince = null;
        this.state = 'IDLE';
      }
      return;
    }

    const elapsed = timestamp - (this.acquiringSince ?? timestamp);
    if (elapsed >= this.config.acquireHoldMs) {
      this.active = this.createSubject(best, timestamp);
      this.state = 'LOCKED';
      this.acquiringKey = null;
      this.acquiringSince = null;
    }
  }

  private stepLocked(
    ranked: Array<PersonCandidate & { score: number }>,
    input: TrackingFrameInput,
    dt: number,
  ): void {
    if (!this.refreshActive(ranked, input, dt)) return;

    if (input.interactionActive) {
      this.notifyInteractionStarted(input.timestamp);
    }
  }

  private stepInteracting(
    ranked: Array<PersonCandidate & { score: number }>,
    input: TrackingFrameInput,
    dt: number,
  ): void {
    if (!this.refreshActive(ranked, input, dt)) return;

    if (!input.interactionActive && this.active) {
      // Soft drop back to LOCKED while still tracking the same guest.
      if (input.timestamp >= this.cooldownUntil) {
        this.state = 'LOCKED';
      }
    }
  }

  private stepCooldown(
    ranked: Array<PersonCandidate & { score: number }>,
    input: TrackingFrameInput,
    dt: number,
  ): void {
    // Keep the same subject if still visible; never switch during cooldown.
    if (this.active) {
      this.refreshActive(ranked, input, dt, true);
    }

    if (input.timestamp >= this.cooldownUntil) {
      if (this.active && this.active.missingSince === null) {
        this.state = 'LOCKED';
      } else {
        this.active = null;
        this.state = 'IDLE';
      }
    }
  }

  /**
   * Update / coast active subject. Returns false if lock released.
   */
  private refreshActive(
    ranked: Array<PersonCandidate & { score: number }>,
    input: TrackingFrameInput,
    dt: number,
    freezeSwitch = false,
  ): boolean {
    if (!this.active) {
      this.state = 'IDLE';
      return false;
    }

    const match = this.findMatchingCandidate(ranked, this.active);

    // Hysteresis: do not switch merely because someone else scores higher.
    if (
      !freezeSwitch &&
      match &&
      ranked[0] &&
      ranked[0].frameId !== match.frameId &&
      ranked[0].score > match.score + this.config.switchScoreMargin &&
      input.timestamp >= this.cooldownUntil
    ) {
      // Only consider a switch after margin AND not in post-interaction cooldown.
      // Still require re-acquire path rather than instant steal.
      // Keep current lock — intentional anti-steal.
    }

    if (match && match.detectionConfidence >= this.config.keepConfidence) {
      this.applyObservation(this.active, match, input, dt);
      const assoc = this.hands.associate(this.active, input.hands);
      this.active.leftHand = assoc.left;
      this.active.rightHand = assoc.right;
      return true;
    }

    // Temporary loss — coast with velocity up to missingGraceMs.
    const missingSince = this.active.missingSince ?? input.timestamp;
    this.active.missingSince = missingSince;
    const missingFor = input.timestamp - missingSince;

    if (missingFor <= this.config.missingGraceMs) {
      const predicted = predictPoint(
        this.active.torsoCenter,
        this.active.velocity,
        Math.max(dt, 16),
      );
      this.active.torsoCenter = predicted;
      if (this.active.faceCenter) {
        this.active.faceCenter = predictPoint(
          this.active.faceCenter,
          this.active.velocity,
          Math.max(dt, 16),
        );
      }
      this.active.smoothedBox = {
        ...this.active.smoothedBox,
        x: this.active.smoothedBox.x + this.active.velocity.x * (Math.max(dt, 16) / 1000),
        y: this.active.smoothedBox.y + this.active.velocity.y * (Math.max(dt, 16) / 1000),
      };
      this.active.confidence = Math.max(
        this.config.keepConfidence * 0.5,
        this.active.confidence * 0.92,
      );

      // Still try to keep hands via previous positions.
      const assoc = this.hands.associate(this.active, input.hands);
      this.active.leftHand = assoc.left;
      this.active.rightHand = assoc.right;
      return true;
    }

    this.active = null;
    this.state = 'IDLE';
    this.gestures.reset();
    return false;
  }

  private findMatchingCandidate(
    ranked: Array<PersonCandidate & { score: number }>,
    active: ActiveSubject,
  ): (PersonCandidate & { score: number }) | null {
    const activeAnchor = active.faceCenter ?? active.torsoCenter;
    let best: (PersonCandidate & { score: number }) | null = null;
    let bestDist = 0.2;

    for (const c of ranked) {
      if (c.detectionConfidence < this.config.keepConfidence) continue;
      const anchor = candidateAnchor(c);
      const d = Math.hypot(anchor.x - activeAnchor.x, anchor.y - activeAnchor.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private createSubject(
    candidate: PersonCandidate & { score: number },
    timestamp: number,
  ): ActiveSubject {
    const id = `subj_${this.nextSubjectSerial++}`;
    return {
      trackingId: id,
      box: { ...candidate.box },
      smoothedBox: { ...candidate.box },
      faceCenter: candidate.faceCenter ? { ...candidate.faceCenter } : null,
      torsoCenter: { ...candidate.torsoCenter },
      poseLandmarks: candidate.pose ? { ...candidate.pose } : null,
      leftHand: null,
      rightHand: null,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      missingSince: null,
      confidence: candidate.detectionConfidence,
      velocity: { x: 0, y: 0 },
    };
  }

  private applyObservation(
    subject: ActiveSubject,
    candidate: PersonCandidate,
    input: TrackingFrameInput,
    dt: number,
  ): void {
    const alpha = this.config.smoothingAlpha;
    const prevTorso = subject.torsoCenter;
    subject.box = { ...candidate.box };
    subject.smoothedBox = smoothBox(subject.smoothedBox, candidate.box, alpha);
    subject.torsoCenter = smoothPoint(subject.torsoCenter, candidate.torsoCenter, alpha);
    subject.faceCenter = candidate.faceCenter
      ? smoothPoint(subject.faceCenter, candidate.faceCenter, alpha)
      : subject.faceCenter
        ? smoothPoint(subject.faceCenter, subject.torsoCenter, alpha * 0.5)
        : null;
    subject.poseLandmarks = candidate.pose;
    subject.lastSeenAt = input.timestamp;
    subject.missingSince = null;
    subject.confidence = candidate.detectionConfidence;
    subject.velocity = estimateVelocity(prevTorso, subject.torsoCenter, Math.max(dt, 1));
  }

  private snapshot(
    ranked: Array<PersonCandidate & { score: number }>,
    gesture: TrackingSnapshot['gesture'],
    timestamp: number,
    associatedHands: TrackingSnapshot['associatedHands'],
    controllingHand: TrackingSnapshot['controllingHand'],
  ): TrackingSnapshot {
    return {
      state: this.state,
      activeSubject: this.active,
      candidates: ranked.map(({ score, frameId, box, faceCenter, torsoCenter, pose, detectionConfidence, faceVisible, poseVisible, visibleMs, distanceFromActive }) => ({
        frameId,
        box,
        faceCenter,
        torsoCenter,
        pose,
        detectionConfidence,
        faceVisible,
        poseVisible,
        visibleMs,
        distanceFromActive,
        score,
      })),
      associatedHands,
      acquisitionElapsedMs:
        this.state === 'ACQUIRING' && this.acquiringSince != null
          ? Math.max(0, timestamp - this.acquiringSince)
          : 0,
      missingGraceElapsedMs:
        this.active?.missingSince != null
          ? Math.max(0, timestamp - this.active.missingSince)
          : 0,
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - timestamp),
      gesture,
      controllingHand,
    };
  }
}

/** Facade used by the app — owns config and the state machine. */
export class SubjectTracker {
  private readonly machine: TrackingStateMachine;

  constructor(config: TrackingConfig) {
    this.machine = new TrackingStateMachine(config);
  }

  update(input: TrackingFrameInput): TrackingSnapshot {
    return this.machine.update(input);
  }

  reset(timestamp = 0): void {
    this.machine.reset(timestamp);
  }

  notifyInteractionStarted(timestamp: number): void {
    this.machine.notifyInteractionStarted(timestamp);
  }

  notifyInteractionCompleted(timestamp: number): void {
    this.machine.notifyInteractionCompleted(timestamp);
  }

  getState(): TrackingState {
    return this.machine.getState();
  }
}

// Avoid unused import warning if makeTempId unused — use in tests helpers later
export { makeTempId };
