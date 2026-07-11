// PERSON B — Standalone harness: run with `npm run tools:local`.
// Stands in for Person A's not-yet-built orchestrator.ts/confirmRoutes.ts so this
// tools/ slice can be proven end-to-end on its own.
import 'dotenv/config';
import type { IBrowserToolInvocation } from '../../contracts/toolContract.js';
import type { IRunHooks } from '../../contracts/runHooks.js';
import type { ITelemetryFrame } from '../../contracts/streamContract.js';
import { executeBrowserTask } from '../browserCore.js';
import { guardrailBridge } from '../guardrails.js';

const invocation: IBrowserToolInvocation = {
  runId: `local-${Date.now()}`,
  targetUrl: process.env.LOCAL_RUN_TARGET_URL ?? 'https://www.expedia.com/Hotel-Search?destination=Seattle%2C+WA',
  browserbaseContextId: '',
  searchParameters: {
    location: 'Seattle, WA',
    maxBudget: 200,
    preferences: ['free wifi', 'downtown'],
  },
};

const hooks: IRunHooks = {
  onFrame(frame: ITelemetryFrame) {
    // Truncate embedded screenshots so the console stream stays readable.
    const printable =
      frame.type === 'viewport_update' && frame.payload?.screenshotUrl
        ? { ...frame, payload: { ...frame.payload, screenshotUrl: '<data-uri omitted>' } }
        : frame;
    console.log(JSON.stringify(printable));

    if (frame.type === 'action_required') {
      // Default to 'cancel' — this harness has no real human reviewing the
      // guardrail card, so it must never auto-authorize a real purchase.
      // Pass LOCAL_RUN_DECISION=authorize only for a deliberate, watched test.
      const decision = process.env.LOCAL_RUN_DECISION === 'authorize' ? 'authorize' : 'cancel';
      console.log(`[localRun] simulating operator decision in 5s: ${decision}`);
      setTimeout(() => {
        guardrailBridge.resolveAuthorization(invocation.runId, decision);
      }, 5000);
    }
  },
};

async function main() {
  console.log(`[localRun] starting run ${invocation.runId} against ${invocation.targetUrl}`);
  const result = await executeBrowserTask(invocation, hooks);
  console.log('[localRun] final result:', JSON.stringify(result, null, 2));
  process.exit(result.status === 'SUCCESS' ? 0 : 1);
}

main().catch((err) => {
  console.error('[localRun] unhandled error:', err);
  process.exit(1);
});
