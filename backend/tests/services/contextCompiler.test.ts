import { describe, it, expect, vi } from 'vitest';

// Mock database
vi.mock('../../src/services/database.js', () => ({
  getAgentBySlug: vi.fn(),
  searchCommonsFacts: vi.fn().mockResolvedValue([]),
  searchEpisodicMemories: vi.fn().mockResolvedValue([]),
}));

const { compileContext } = await import('../../src/services/contextCompiler.js');
const { getAgentBySlug, searchCommonsFacts, searchEpisodicMemories } = await import('../../src/services/database.js');

describe('contextCompiler', () => {
  it('builds system prompt from agent metadata', async () => {
    (getAgentBySlug as any).mockResolvedValue({
      slug: 'hotel-booker',
      name: 'Hotel Booker',
      purpose: 'Finds and reserves stays',
      tool_manifest: { tools: ['browser_search', 'browser_book'] },
    });

    const ctx = await compileContext({
      userId: 'user-1',
      agentId: 'agent-1',
      agentSlug: 'hotel-booker',
      userPrompt: 'Book a hotel',
    });

    expect(ctx.systemPrompt).toContain('Hotel Booker');
    expect(ctx.systemPrompt).toContain('Finds and reserves stays');
    expect(ctx.systemPrompt).toContain('browser_search');
    expect(ctx.systemPrompt).toContain('confirmation');
    expect(ctx.userPrompt).toBe('Book a hotel');
  });

  it('includes Commons facts when embedding is provided', async () => {
    (getAgentBySlug as any).mockResolvedValue(null);
    (searchCommonsFacts as any).mockResolvedValue([
      { fact: 'Hilton Honors member', category: 'loyalty' },
      { fact: 'Prefers King bed', category: 'preferences' },
    ]);

    const ctx = await compileContext({
      userId: 'user-1',
      agentId: 'agent-1',
      agentSlug: 'hotel-booker',
      userPrompt: 'Book a hotel',
      queryEmbedding: new Array(1536).fill(0.1),
    });

    expect(ctx.systemPrompt).toContain('Hilton Honors member');
    expect(ctx.systemPrompt).toContain('Prefers King bed');
    expect(ctx.systemPrompt).toContain('Information Commons');
  });

  it('includes episodic memories when embedding is provided', async () => {
    (getAgentBySlug as any).mockResolvedValue(null);
    (searchCommonsFacts as any).mockResolvedValue([]);
    (searchEpisodicMemories as any).mockResolvedValue([
      { summary: 'Previously booked Hilton Seattle for $180' },
    ]);

    const ctx = await compileContext({
      userId: 'user-1',
      agentId: 'agent-1',
      agentSlug: 'hotel-booker',
      userPrompt: 'Book a hotel',
      queryEmbedding: new Array(1536).fill(0.1),
    });

    expect(ctx.systemPrompt).toContain('Previously booked Hilton Seattle');
    expect(ctx.systemPrompt).toContain('Past Experiences');
  });

  it('works without embedding (no semantic recall)', async () => {
    (getAgentBySlug as any).mockResolvedValue({
      slug: 'hotel-booker',
      name: 'Hotel Booker',
      purpose: 'Books hotels',
      tool_manifest: {},
    });

    const ctx = await compileContext({
      userId: 'user-1',
      agentId: 'agent-1',
      agentSlug: 'hotel-booker',
      userPrompt: 'Book a hotel',
    });

    expect(ctx.systemPrompt).toContain('Hotel Booker');
    expect(ctx.systemPrompt).not.toContain('Information Commons');
    expect(ctx.systemPrompt).not.toContain('Past Experiences');
  });

  it('handles null agent gracefully', async () => {
    (getAgentBySlug as any).mockResolvedValue(null);

    const ctx = await compileContext({
      userId: 'user-1',
      agentId: 'agent-1',
      agentSlug: 'unknown-agent',
      userPrompt: 'Do something',
    });

    expect(ctx.systemPrompt).toContain('helpful AI assistant');
  });
});
