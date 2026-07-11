// PERSON B — Periodic viewport capture, streamed as telemetry frames.
// No blob storage exists yet in this project, so frames carry a data: URI directly;
// swapping in real object storage later only touches this file.
import type { Page } from '@browserbasehq/stagehand';
import type { IRunHooks } from '../contracts/runHooks.js';

const DEFAULT_INTERVAL_MS = 4000;

/** Starts a screenshot loop; returns a stop function to call in a `finally` block. */
export function startScreenshotLoop(
  page: Page,
  hooks: IRunHooks,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const buffer = await page.screenshot({ type: 'png' });
        hooks.onFrame({
          type: 'viewport_update',
          message: 'Viewport frame captured',
          timestamp: new Date().toISOString(),
          payload: { screenshotUrl: `data:image/png;base64,${buffer.toString('base64')}` },
        });
      } catch {
        // Page mid-navigation or already closed — skip this tick, not fatal.
      }
    })();
  }, intervalMs);

  return () => clearInterval(timer);
}
