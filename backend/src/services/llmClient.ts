// PERSON A — Anthropic API tool-calling client
import Anthropic from '@anthropic-ai/sdk';
import type { IBrowserToolInvocation, IToolExecutionResult } from '../contracts/toolContract.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
 *
 * @param tools — the Anthropic tool definitions for this agent (from toolRegistry)
 */
export async function think(params: {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
}): Promise<LLMDecision> {
  const { systemPrompt, messages, tools = [] } = params;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: tools.length > 0 ? tools : undefined,
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
 *
 * @param tools — the Anthropic tool definitions for this agent (from toolRegistry)
 */
export async function continueWithToolResult(params: {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolResult: IToolExecutionResult;
  tools?: Anthropic.Tool[];
}): Promise<LLMDecision> {
  const { systemPrompt, messages, toolName, toolResult, tools = [] } = params;

  const resultText = formatToolResult(toolName, toolResult);

  const updatedMessages: Anthropic.MessageParam[] = [
    ...messages,
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id: `tool_${Date.now()}`, name: toolName, input: {} }],
    },
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: `tool_${Date.now()}`, content: resultText }],
    },
  ];

  return think({ systemPrompt, messages: updatedMessages, tools });
}

// ── Result formatter ──────────────────────────────────────────────────────
function formatToolResult(toolName: string, result: IToolExecutionResult): string {
  if (result.status === 'SUCCESS' && result.scrapedData) {
    return [
      `Tool "${toolName}" completed successfully.`,
      '',
      'Results:',
      `- Name: ${result.scrapedData.entityName}`,
      `- Price: ${result.scrapedData.priceDisplay}`,
      `- Details: ${result.scrapedData.summaryDetails}`,
    ].join('\n');
  }

  if (result.status === 'GUARDRAIL_TRIGGERED') {
    return `Tool "${toolName}" requires user confirmation before proceeding. Awaiting authorization.`;
  }

  return `Tool "${toolName}" failed: ${result.errorMessage ?? 'Unknown error'}`;
}
