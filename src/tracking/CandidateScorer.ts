import { boxArea, boxCenter, clamp, distance, type Point2 } from './math';
import type { PersonCandidate, TrackingConfig } from './types';

export interface ScoreBreakdown {
  total: number;
  centerProximity: number;
  size: number;
  confidence: number;
  faceVisibility: number;
  poseVisibility: number;
  continuity: number;
  activeAffinity: number;
}

/**
 * Scores potential people for primary-subject selection.
 * Higher is better. Does not use biometric identity — only geometry + confidence.
 */
export class CandidateScorer {
  private readonly config: TrackingConfig;

  constructor(config: TrackingConfig) {
    this.config = config;
  }

  score(
    candidate: PersonCandidate,
    previousActiveLocation: Point2 | null,
  ): ScoreBreakdown {
    const center = candidate.faceCenter ?? candidate.torsoCenter;
    const zoneCenter: Point2 = {
      x: 0.5,
      y: this.config.interactionZoneCenterY,
    };

    // Prefer guests near the interaction zone centre.
    const distToCenter = distance(center, zoneCenter);
    const centerProximity = clamp(1 - distToCenter / 0.75, 0, 1);

    // Prefer larger bounding boxes (closer / more engaged), with room for children.
    const area = boxArea(candidate.box);
    const size = clamp(
      (area - this.config.minBodyArea * 0.5) / (0.35 - this.config.minBodyArea * 0.5),
      0,
      1,
    );

    const confidence = clamp(candidate.detectionConfidence, 0, 1);
    const faceVisibility = candidate.faceVisible ? 1 : 0.35;
    const poseVisibility = candidate.poseVisible ? 1 : 0.4;

    // Continuously visible candidates accumulate preference.
    const continuity = clamp(candidate.visibleMs / 2000, 0, 1);

    // Prefer staying near the previous active location (anti-steal).
    let activeAffinity = 0.5;
    if (previousActiveLocation) {
      const d = distance(center, previousActiveLocation);
      candidate.distanceFromActive = d;
      activeAffinity = clamp(1 - d / 0.55, 0, 1);
    } else {
      candidate.distanceFromActive = distance(center, zoneCenter);
    }

    // Children / short guests: torso lower in frame is OK — soft boost when
    // torso is below mid-frame but still inside the interaction zone.
    const childFriendly =
      center.y > 0.45 && center.y <= this.config.interactionZoneMaxY ? 0.08 : 0;

    const total =
      centerProximity * 0.22 +
      size * 0.18 +
      confidence * 0.16 +
      faceVisibility * 0.1 +
      poseVisibility * 0.12 +
      continuity * 0.1 +
      activeAffinity * 0.12 +
      childFriendly;

    return {
      total: clamp(total, 0, 1),
      centerProximity,
      size,
      confidence,
      faceVisibility,
      poseVisibility,
      continuity,
      activeAffinity,
    };
  }

  /** Reject candidates that are too small to be a real guest. */
  isViable(candidate: PersonCandidate, forAcquire: boolean): boolean {
    const area = boxArea(candidate.box);
    if (area < this.config.minBodyArea * (forAcquire ? 1 : 0.7)) return false;

    if (candidate.faceVisible) {
      // Face box approximated from body if no separate face area — use presence only.
    } else if (!candidate.poseVisible) {
      return false;
    }

    const center = candidate.faceCenter ?? candidate.torsoCenter;
    if (center.y > this.config.interactionZoneMaxY) return false;

    const minConf = forAcquire
      ? this.config.acquireConfidence
      : this.config.keepConfidence;
    return candidate.detectionConfidence >= minConf;
  }

  rank(
    candidates: PersonCandidate[],
    previousActiveLocation: Point2 | null,
    forAcquire: boolean,
  ): Array<PersonCandidate & { score: number; breakdown: ScoreBreakdown }> {
    return candidates
      .filter((c) => this.isViable(c, forAcquire))
      .map((c) => {
        const breakdown = this.score(c, previousActiveLocation);
        return { ...c, score: breakdown.total, breakdown };
      })
      .sort((a, b) => b.score - a.score);
  }
}

export function candidateAnchor(candidate: PersonCandidate): Point2 {
  return candidate.faceCenter ?? candidate.torsoCenter ?? boxCenter(candidate.box);
}
