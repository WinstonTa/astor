import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ITelemetryFrame } from '../../src/contracts/streamContract.js';

// Mock all dependencies before importing orchestrator
vi.mock('../../src/services/database.js', () => ({
  getRunById: vi.fn(),
  getAgentById: vi.fn(),
  updateRunStatus: vi.fn().mockResolvedValue({}),
  insertRunEvent: vi.fn().mockImplementation((runId, type, message) =>
    Promise.resolve({ id: `ev-${Date.now()}`, run_id: runId, type, message, created_at: new Date(), payload: null })
  ),
}));

vi.mock('../../src/services/contextCompiler.js', () => ({
  compileContext: vi.fn().mockResolvedValue({
    systemPrompt: 'You are Hotel Booker.',
    userPrompt: 'Book a hotel in Seattle',
  }),
}));

vi.mock('../../src/services/llmClient.js', () => ({
  think: vi.fn(),
  continueWithToolResult: vi.fn(),
}));

vi.mock('../../src/services/memoryWriter.js', () => ({
  writeMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/sseManager.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../../src/tools/browserCore.js', () => ({
  executeBrowserTask: vi.fn().mockImplementation(async (_inv, hooks) => {
    hooks.onFrame({
      type: 'tool_start',
      message: 'Mock tool started',
      timestamp: new Date().toISOString(),
    });
    return {
      status: 'SUCCESS',
      scrapedData: {
        entityName: 'Grand Hyatt Seattle',
        priceDisplay: '$180/night',
        summaryDetails: 'Great hotel',
      },
    };
  }),
}));

const { startRun, cancelRun } = await import('../../src/services/orchestrator.js');
const { getRunById, getAgentById, updateRunStatus, insertRunEvent } = await import('../../src/services/database.js');
const { think, continueWithToolResult } = await import('../../src/services/llmClient.js');
const { writeMemory } = await import('../../src/services/memoryWriter.js');
const { broadcast } = await import('../../src/services/sseManager.js');

describe('orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a text-only run (no tool calls)', async () => {
    (getRunById as any).mockResolvedValue({
      id: 'run-1',
      user_id: 'user-1',
      agent_id: 'agent-1',
      prompt: 'Hello',
    });
    (getAgentById as any).mockResolvedValue({
      id: 'agent-1',
      slug: 'hotel-booker',
      name: 'Hotel Booker',
    });
    (think as any).mockResolvedValue({
      type: 'text',
      text: 'How can I help you today?',
    });

    await startRun('run-1');

    // Should have transitioned through states
    expect(updateRunStatus).toHaveBeenCalledWith('run-1', 'HYDRATING', undefined);
    expect(updateRunStatus).toHaveBeenCalledWith('run-1', 'THINKING', undefined);
    expect(updateRunStatus).toHaveBeenCalledWith('run-1', 'FINALIZING', undefined);
    expect(updateRunStatus).toHaveBeenCalledWith('run-1', 'COMPLETE', undefined);

    // Should have written episodic memory
    expect(writeMemory).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      agentId: 'agent-1',
      runId: 'run-1',
    }));

    // Should have broadcast frames
    expect(broadcast).toHaveBeenCalled();
  });

  it('handles a tool call then completes', async () => {
    (getRunById as any).mockResolvedValue({
      id: 'run-2',
      user_id: 'user-1',
      agent_id: 'agent-1',
      prompt: 'Book a hotel',
    });
    (getAgentById as any).mockResolvedValue({
      id: 'agent-1',
      slug: 'hotel-booker',
      name: 'Hotel Booker',
    });

    // First call: tool_use; second call: text response
    (think as any).mockResolvedValueOnce({
      type: 'tool_call',
      toolName: 'search_hotels',
      toolInput: { location: 'Seattle', maxBudget: 200, preferences: [] },
    });
    (continueWithToolResult as any).mockResolvedValueOnce({
      type: 'text',
      text: 'Found Grand Hyatt Seattle for $180/night.',
    });

    await startRun('run-2');

    expect(updateRunStatus).toHaveBeenCalledWith('run-2', 'EXECUTING_TOOL', undefined);
    expect(updateRunStatus).toHaveBeenCalledWith('run-2', 'COMPLETE', undefined);
    expect(writeMemory).toHaveBeenCalled();
  });

  it('handles run not found', async () => {
    (getRunById as any).mockResolvedValue(null);

    await startRun('run-nonexistent');

    // Should have entered FAILED state
    expect(updateRunStatus).toHaveBeenCalledWith('run-nonexistent', 'FAILED', undefined);
  });

  it('handles LLM error gracefully', async () => {
    (getRunById as any).mockResolvedValue({
      id: 'run-err',
      user_id: 'user-1',
      agent_id: 'agent-1',
      prompt: 'Test',
    });
    (getAgentById as any).mockResolvedValue({
      id: 'agent-1',
      slug: 'hotel-booker',
      name: 'Hotel Booker',
    });
    (think as any).mockRejectedValue(new Error('API rate limited'));

    await startRun('run-err');

    expect(updateRunStatus).toHaveBeenCalledWith('run-err', 'FAILED', undefined);
  });

  it('cancelRun returns false for unknown runId', () => {
    const result = cancelRun('nonexistent');
    expect(result).toBe(false);
  });
});
