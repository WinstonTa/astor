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
  describe('Hotel Booker (has specific prompt)', () => {
    it('uses the detailed Hotel Booker system prompt', async () => {
      (getAgentBySlug as any).mockResolvedValue({
        slug: 'hotel-booker',
        name: 'Hotel Booker',
        purpose: 'Books hotels',
        tool_manifest: { tools: ['browser_search', 'browser_book'] },
      });

      const ctx = await compileContext({
        userId: 'user-1',
        agentId: 'agent-1',
        agentSlug: 'hotel-booker',
        userPrompt: 'Book a hotel in Seattle',
      });

      // Should use the detailed prompt, not the generic one
      expect(ctx.systemPrompt).toContain('You are Hotel Booker');
      expect(ctx.systemPrompt).toContain('meticulous travel assistant');
      expect(ctx.systemPrompt).toContain('search_hotels');
      expect(ctx.systemPrompt).toContain('book_hotel');
      expect(ctx.systemPrompt).toContain('NEVER complete a booking');
      expect(ctx.systemPrompt).toContain('Information Commons');
      expect(ctx.userPrompt).toBe('Book a hotel in Seattle');
    });

    it('includes Hotel Booker behavioral instructions', async () => {
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
        userPrompt: 'Find me a hotel',
      });

      expect(ctx.systemPrompt).toContain('Clarify');
      expect(ctx.systemPrompt).toContain('Search');
      expect(ctx.systemPrompt).toContain('Present');
      expect(ctx.systemPrompt).toContain('Recommend');
      expect(ctx.systemPrompt).toContain('Book');
      expect(ctx.systemPrompt).toContain('STOP');
    });
  });

  describe('Unknown agent (falls back to generic)', () => {
    it('falls back to generic prompt for unknown agent with DB metadata', async () => {
      (getAgentBySlug as any).mockResolvedValue({
        slug: 'unknown-agent',
        name: 'Test Agent',
        purpose: 'Does things',
        tool_manifest: { tools: ['tool_a'] },
      });

      const ctx = await compileContext({
        userId: 'user-1',
        agentId: 'agent-1',
        agentSlug: 'unknown-agent',
        userPrompt: 'Do something',
      });

      expect(ctx.systemPrompt).toContain('Test Agent');
      expect(ctx.systemPrompt).toContain('Does things');
      expect(ctx.systemPrompt).toContain('tool_a');
      // Should NOT contain Hotel Booker specific content
      expect(ctx.systemPrompt).not.toContain('meticulous travel assistant');
    });

    it('falls back to completely generic prompt when no DB entry', async () => {
      (getAgentBySlug as any).mockResolvedValue(null);

      const ctx = await compileContext({
        userId: 'user-1',
        agentId: 'agent-1',
        agentSlug: 'nonexistent',
        userPrompt: 'Help me',
      });

      expect(ctx.systemPrompt).toContain('helpful AI assistant');
    });
  });

  describe('Information Commons integration', () => {
    it('appends Commons facts when embedding is provided', async () => {
      (getAgentBySlug as any).mockResolvedValue({
        slug: 'hotel-booker',
        name: 'Hotel Booker',
        purpose: 'Books hotels',
        tool_manifest: {},
      });
      (searchCommonsFacts as any).mockResolvedValue([
        { fact: 'Hilton Honors Gold member', category: 'loyalty' },
        { fact: 'Prefers King bed', category: 'preferences' },
      ]);

      const ctx = await compileContext({
        userId: 'user-1',
        agentId: 'agent-1',
        agentSlug: 'hotel-booker',
        userPrompt: 'Book a hotel',
        queryEmbedding: new Array(1536).fill(0.1),
      });

      expect(ctx.systemPrompt).toContain('Hilton Honors Gold member');
      expect(ctx.systemPrompt).toContain('Prefers King bed');
      expect(ctx.systemPrompt).toContain('Information Commons');
    });

    it('omits Commons section when no facts found', async () => {
      (getAgentBySlug as any).mockResolvedValue({
        slug: 'hotel-booker',
        name: 'Hotel Booker',
        purpose: 'Books hotels',
        tool_manifest: {},
      });
      (searchCommonsFacts as any).mockResolvedValue([]);

      const ctx = await compileContext({
        userId: 'user-1',
        agentId: 'agent-1',
        agentSlug: 'hotel-booker',
        userPrompt: 'Book a hotel',
        queryEmbedding: new Array(1536).fill(0.1),
      });

      // The base prompt mentions "Information Commons" in its rules, so check for the appended section header
      expect(ctx.systemPrompt).not.toContain('## User Preferences (Information Commons)');
    });
  });

  describe('Episodic memory integration', () => {
    it('appends episodic memories when embedding is provided', async () => {
      (getAgentBySlug as any).mockResolvedValue({
        slug: 'hotel-booker',
        name: 'Hotel Booker',
        purpose: 'Books hotels',
        tool_manifest: {},
      });
      (searchEpisodicMemories as any).mockResolvedValue([
        { summary: 'Previously booked Hilton Seattle for $180 — user was satisfied' },
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
  });

  describe('No embedding (no semantic recall)', () => {
    it('skips Commons and episodic sections without embedding', async () => {
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

      // Should still have the base prompt
      expect(ctx.systemPrompt).toContain('Hotel Booker');
      // But no appended Commons or episodic sections
      expect(ctx.systemPrompt).not.toContain('## User Preferences (Information Commons)');
      expect(ctx.systemPrompt).not.toContain('## Relevant Past Experiences');
    });
  });
});
