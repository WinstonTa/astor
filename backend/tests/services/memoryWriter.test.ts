import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/services/database.js', () => ({
  insertEpisodicMemory: vi.fn().mockResolvedValue({
    id: 'mem-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    summary: 'test summary',
  }),
}));

// Mock OpenAI SDK (used via DigitalOcean Inference)
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'User booked Grand Hyatt Seattle for $180/night.' } }],
  });
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

const { writeMemory } = await import('../../src/services/memoryWriter.js');
const { insertEpisodicMemory } = await import('../../src/services/database.js');

describe('memoryWriter', () => {
  it('summarizes and stores episodic memory', async () => {
    await writeMemory({
      userId: 'user-1',
      agentId: 'agent-1',
      runId: 'run-1',
      userPrompt: 'Book a hotel in Seattle under $200',
      assistantResponse: 'I booked the Grand Hyatt Seattle for $180/night.',
    });

    expect(insertEpisodicMemory).toHaveBeenCalledWith(
      'user-1',
      'agent-1',
      expect.stringContaining('Grand Hyatt Seattle'), // summarized text
      expect.any(Array), // embedding vector
      'run-1',
    );
  });

  it('generates a 1536-dimensional embedding', async () => {
    let capturedEmbedding: number[] | undefined;

    (insertEpisodicMemory as any).mockImplementationOnce(
      (_userId: string, _agentId: string, _summary: string, embedding: number[]) => {
        capturedEmbedding = embedding;
        return Promise.resolve({ id: 'mem-1' });
      },
    );

    await writeMemory({
      userId: 'user-1',
      agentId: 'agent-1',
      runId: 'run-2',
      userPrompt: 'Test prompt',
      assistantResponse: 'Test response',
    });

    expect(capturedEmbedding).toBeDefined();
    expect(capturedEmbedding!.length).toBe(1536);

    // Should be a unit vector (normalized)
    const norm = Math.sqrt(capturedEmbedding!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('passes runId to episodic memory insert', async () => {
    await writeMemory({
      userId: 'user-1',
      agentId: 'agent-1',
      runId: 'run-42',
      userPrompt: 'Test',
      assistantResponse: 'Response',
    });

    expect(insertEpisodicMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Array),
      'run-42',
    );
  });
});
