// FROZEN — Day 0 contract. Changes require dual-approval PR.
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
  };
}
