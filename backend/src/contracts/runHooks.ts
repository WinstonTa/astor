// FROZEN — Day 0 contract. Changes require dual-approval PR.
import type { ITelemetryFrame } from './streamContract.js';

export interface IRunHooks {
  onFrame(frame: ITelemetryFrame): void;
}
