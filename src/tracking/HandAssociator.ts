import {
  distance,
  expandBox,
  pointInBox,
  type Point2,
} from './math';
import type {
  ActiveSubject,
  HandObservation,
  PoseLandmarksNorm,
  TrackingConfig,
} from './types';

export interface HandAssociationResult {
  left: HandObservation | null;
  right: HandObservation | null;
  controlling: HandObservation | null;
  associated: HandObservation[];
}

/**
 * Associates detected hands only with the active subject.
 * Hands belonging to other people are ignored for control.
 */
export class HandAssociator {
  private readonly config: TrackingConfig;

  constructor(config: TrackingConfig) {
    this.config = config;
  }

  associate(
    subject: ActiveSubject,
    hands: HandObservation[],
  ): HandAssociationResult {
    const matches = hands.filter((hand) => this.belongsToSubject(subject, hand));

    let left: HandObservation | null = subject.leftHand;
    let right: HandObservation | null = subject.rightHand;

    // Prefer pose wrist proximity to label left/right when available.
    for (const hand of matches) {
      const side = this.guessSide(subject.poseLandmarks, hand);
      if (side === 'left') left = hand;
      else if (side === 'right') right = hand;
      else if (!left) left = hand;
      else if (!right && hand.id !== left.id) right = hand;
    }

    // Drop stale associations if no longer in matches.
    if (left && !matches.some((h) => h.id === left!.id || this.near(h.wrist, left!.wrist))) {
      const still = matches.find((h) => this.near(h.wrist, left!.wrist));
      left = still ?? null;
    }
    if (right && !matches.some((h) => h.id === right!.id || this.near(h.wrist, right!.wrist))) {
      const still = matches.find((h) => this.near(h.wrist, right!.wrist));
      right = still ?? null;
    }

    const associated = matches;
    const controlling =
      this.pickControlling(subject, associated, left, right) ?? null;

    return { left, right, controlling, associated };
  }

  belongsToSubject(subject: ActiveSubject, hand: HandObservation): boolean {
    const pose = subject.poseLandmarks;
    if (pose) {
      const anchors: Point2[] = [
        pose.leftWrist,
        pose.rightWrist,
        pose.leftElbow,
        pose.rightElbow,
        pose.leftShoulder,
        pose.rightShoulder,
      ].filter((p): p is Point2 => !!p);

      for (const anchor of anchors) {
        if (distance(hand.wrist, anchor) <= this.config.handLandmarkProximity) {
          return true;
        }
      }
    }

    const expanded = expandBox(
      subject.smoothedBox,
      this.config.handBoxPaddingX,
      this.config.handBoxPaddingY,
    );
    if (pointInBox(hand.wrist, expanded) || pointInBox(hand.center, expanded)) {
      return true;
    }

    // Face-only lock (no pose): allow a raised/held hand in front of the guest.
    const face = subject.faceCenter;
    if (face) {
      const dx = Math.abs(hand.wrist.x - face.x);
      const dy = hand.wrist.y - face.y;
      if (dx <= 0.28 && dy >= -0.08 && dy <= 0.55) {
        return true;
      }
      if (distance(hand.wrist, face) <= 0.42) {
        return true;
      }
    }

    const torso = subject.torsoCenter;
    if (torso && distance(hand.wrist, torso) <= 0.38) {
      return true;
    }

    // Match previously associated hand position.
    for (const prev of [subject.leftHand, subject.rightHand]) {
      if (prev && distance(hand.wrist, prev.wrist) <= this.config.handMatchProximity) {
        return true;
      }
    }

    return false;
  }

  private guessSide(
    pose: PoseLandmarksNorm | null,
    hand: HandObservation,
  ): 'left' | 'right' | null {
    if (!pose?.leftWrist && !pose?.rightWrist) return null;
    const dL = pose.leftWrist ? distance(hand.wrist, pose.leftWrist) : Infinity;
    const dR = pose.rightWrist ? distance(hand.wrist, pose.rightWrist) : Infinity;
    if (dL === Infinity && dR === Infinity) return null;
    return dL <= dR ? 'left' : 'right';
  }

  private near(a: Point2, b: Point2): boolean {
    return distance(a, b) <= this.config.handMatchProximity;
  }

  private pickControlling(
    subject: ActiveSubject,
    associated: HandObservation[],
    left: HandObservation | null,
    right: HandObservation | null,
  ): HandObservation | null {
    if (associated.length === 0) return null;

    // Prefer the hand that was controlling previously if still associated.
    const prev = subject.leftHand ?? subject.rightHand;
    if (prev) {
      const keep = associated.find(
        (h) => h.id === prev.id || this.near(h.wrist, prev.wrist),
      );
      if (keep) return keep;
    }

    // Prefer the higher hand (raised) — typical café “wave / hold donut” pose.
    return [...associated].sort((a, b) => a.center.y - b.center.y)[0]
      ?? left
      ?? right
      ?? null;
  }
}
