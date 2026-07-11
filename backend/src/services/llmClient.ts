// PERSON A — Anthropic API tool-calling client
import Anthropic from '@anthropic-ai/sdk';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool definitions for the LLM ──────────────────────────────────────────
const BROWSER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_hotels',
    description: 'Search for hotels using the browser. Navigates to a travel site and scrapes results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'City or area to search' },
        maxBudget: { type: 'number', description: 'Maximum nightly rate in USD' },
        preferences: {
          type: 'array',
          items: { type: 'string' },
          description: 'User preferences like "King bed", "pool", "Hilton Honors"',
        },
      },
      required: ['location', 'maxBudget'],
    },
  },
  {
    name: 'book_hotel',
    description: 'Book a specific hotel. Requires user confirmation before finalizing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hotelName: { type: 'string' },
        price: { type: 'string' },
        checkIn: { type: 'string' },
        checkOut: { type: 'string' },
      },
      required: ['hotelName', 'price'],
    },
  },
];

// ── Types for the tool-calling loop ───────────────────────────────────────
export interface LLMDecision {
  type: 'text' | 'tool_call';
  text?: string;
  toolInvocation?: IBrowserToolInvocation;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

/**
 * Run one turn of the Anthropic tool-calling loop.
 * Returns either a text response or a tool call that the orchestrator must execute.
 */
export async function think(params: {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
}): Promise<LLMDecision> {
  const { systemPrompt, messages } = params;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: BROWSER_TOOLS,
    messages,
  });

  // Check for tool use blocks
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    return {
      type: 'tool_call',
      toolName: toolBlock.name,
      toolInput: toolBlock.input as Record<string, unknown>,
    };
  }

  // Otherwise return text
  const textBlock = response.content.find((b) => b.type === 'text');
  return {
    type: 'text',
    text: textBlock && textBlock.type === 'text' ? textBlock.text : '',
  };
}

/**
 * Feed a tool result back to the LLM and get the next decision.
 */
export async function continueWithToolResult(params: {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolResult: IToolExecutionResult;
}): Promise<LLMDecision> {
  const { systemPrompt, messages, toolName, toolResult } = params;

  const resultText = toolResult.status === 'SUCCESS' && toolResult.scrapedData
    ? `Tool ${toolName} completed successfully.\n\nResults:\n- Hotel: ${toolResult.scrapedData.entityName}\n- Price: ${toolResult.scrapedData.priceDisplay}\n- Details: ${toolResult.scrapedData.summaryDetails}`
    : toolResult.status === 'GUARDRAIL_TRIGGERED'
      ? `Tool ${toolName} requires user confirmation before proceeding. Awaiting authorization.`
      : `Tool ${toolName} failed: ${toolResult.errorMessage ?? 'Unknown error'}`;

  const updatedMessages: Anthropic.MessageParam[] = [
    ...messages,
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tool_result', name: toolName, input: {} }],
    },
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tool_result', content: resultText }],
    },
  ];

  return think({ systemPrompt, messages: updatedMessages });
}

export { BROWSER_TOOLS };
