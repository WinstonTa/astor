// FROZEN — Day 0 contract. Changes require dual-approval PR.
import type { IGroceryReport } from './toolContract.js';

export interface ITelemetryFrame {
  type: 'thinking' | 'tool_start' | 'viewport_update' | 'action_required' | 'complete' | 'agent_message';
  message: string;
  timestamp: string;
  payload?: {
    screenshotUrl?: string;
    // Browserbase Session Live View — interactive iframe URL for real-time
    // viewing/control of the cloud browser. Additive optional field.
    liveViewUrl?: string;
    confirmationCardData?: {
      title: string;
      cost: string;
    };
    // Grocery Runner's generated report — additive optional field, mirrors how
    // liveViewUrl was added for the hotel agent's live browser view.
    groceryReport?: IGroceryReport;
  };
}
