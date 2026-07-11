// FROZEN — Day 0 contract. Changes require dual-approval PR.
export type GuardrailDecision = 'authorize' | 'cancel';

export interface IGuardrailBridge {
  resolveAuthorization(runId: string, decision: GuardrailDecision): boolean;
}
