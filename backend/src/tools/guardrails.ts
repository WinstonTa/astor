// PERSON B — The Guardrail Interlock Engine
// Pauses execution before any state-changing transaction and holds an unresolved
// promise until an external caller (eventually Person A's confirmRoutes.ts) resolves it.
import type { IGuardrailBridge, GuardrailDecision } from '../contracts/guardrailContract.js';
import type { IRunHooks } from '../contracts/runHooks.js';

const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000;

interface PendingAuthorization {
  resolve: (decision: GuardrailDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingAuthorization>();

export interface GuardrailPayload {
  title: string;
  cost: string;
}

/** Called by expediaMacro.ts right before the final purchase click. */
export function requestAuthorization(
  runId: string,
  payload: GuardrailPayload,
  hooks: IRunHooks,
): Promise<GuardrailDecision> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(runId);
      hooks.onFrame({
        type: 'action_required',
        message: 'Guardrail timed out after 10 minutes with no response — auto-cancelled.',
        timestamp: new Date().toISOString(),
      });
      resolve('cancel');
    }, AUTHORIZATION_TIMEOUT_MS);

    pending.set(runId, { resolve, timeout });

    hooks.onFrame({
      type: 'action_required',
      message: `Awaiting purchase confirmation for ${payload.title} (${payload.cost})`,
      timestamp: new Date().toISOString(),
      payload: { confirmationCardData: { title: payload.title, cost: payload.cost } },
    });
  });
}

/**
 * Frozen contract implementation — this is the only entrypoint Person A's
 * confirmRoutes.ts is allowed to call into Person B's tools/ directory.
 */
export const guardrailBridge: IGuardrailBridge = {
  resolveAuthorization(runId: string, decision: GuardrailDecision): boolean {
    const entry = pending.get(runId);
    if (!entry) return false;
    clearTimeout(entry.timeout);
    pending.delete(runId);
    const mark = decision === 'authorize' ? '\x1b[32m✓ AUTHORIZED\x1b[0m' : '\x1b[31m✖ CANCELLED\x1b[0m';
    console.log(`\x1b[36m[agent ${runId.slice(0, 8)}]\x1b[0m 🔒 guardrail → ${mark}`);
    entry.resolve(decision);
    return true;
  },
};
