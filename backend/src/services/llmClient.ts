// PERSON A — LLM client using DigitalOcean Inference Engine (OpenAI-compatible)
// Uses Sonnet via https://inference.do-ai.run/v1/ with the OpenAI SDK
import OpenAI from 'openai';
import type { IToolExecutionResult } from '../contracts/toolContract.js';

const client = new OpenAI({
  baseURL: 'https://inference.do-ai.run/v1/',
  apiKey: process.env.DIGITAL_OCEAN_MODEL_ACCESS_KEY ?? '',
});

// Main reasoning model — DeepSeek v4 Pro is a strong reasoning model, good for
// tool-calling decisions. This is separate from the Stagehand vision model.
const MODEL = process.env.LLM_MODEL ?? 'deepseek-v4-pro';

// GPT-5.x models on DigitalOcean's /v1/chat/completions 400 when function tools
// are combined with reasoning ("Function tools with reasoning_effort are not
// supported ... set reasoning_effort to 'none'"). Only these models need the
// override — sending it to deepseek/claude/etc. would be a no-op param they
// don't recognize, so gate it narrowly by model id prefix.
const NEEDS_REASONING_EFFORT_NONE = /^openai-gpt-5/.test(MODEL);

// ── Types for the tool-calling loop ───────────────────────────────────────
export interface LLMDecision {
  type: 'text' | 'tool_call';
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

// ── Convert Anthropic tool defs → OpenAI function format ─────────────────
interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function toOpenAITools(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema,
    },
  }));
}

// ── Build OpenAI messages from system + conversation ─────────────────────
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function buildMessages(systemPrompt: string, messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      result.push({
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: tc.function,
        })),
      });
    } else if (msg.role === 'tool' && msg.tool_call_id) {
      result.push({
        role: 'tool',
        content: msg.content ?? '',
        tool_call_id: msg.tool_call_id,
      });
    } else {
      result.push({
        role: msg.role as 'system' | 'user',
        content: msg.content ?? '',
      });
    }
  }
  return result;
}

/**
 * Run one turn of the tool-calling loop via DigitalOcean Inference.
 * Returns either a text response or a tool call that the orchestrator must execute.
 */
export async function think(params: {
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: AnthropicTool[];
}): Promise<LLMDecision> {
  const { systemPrompt, messages, tools = [] } = params;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096, // 1024 was too low for detailed hotel comparisons
    messages: buildMessages(systemPrompt, messages),
    tools: tools.length > 0 ? toOpenAITools(tools) : undefined,
    ...(NEEDS_REASONING_EFFORT_NONE ? { reasoning_effort: 'none' as const } : {}),
  });

  const choice = response.choices[0];
  if (!choice) return { type: 'text', text: '' };

  // Check for tool calls
  const toolCalls = choice.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    if (toolCalls.length > 1) {
      console.warn(`[llmClient] LLM returned ${toolCalls.length} tool calls; only the first will be executed. Others: ${toolCalls.slice(1).map(tc => 'function' in tc ? tc.function.name : '?').join(', ')}`);
    }
    const tc = toolCalls[0];
    if ('function' in tc) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch { /* empty args */ }
      return {
        type: 'tool_call',
        toolName: tc.function.name,
        toolInput: input,
      };
    }
  }

  return {
    type: 'text',
    text: choice.message?.content ?? '',
  };
}

/**
 * Feed a tool result back to the LLM and get the next decision.
 */
export async function continueWithToolResult(params: {
  systemPrompt: string;
  messages: ChatMessage[];
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolResult: IToolExecutionResult;
  tools?: AnthropicTool[];
}): Promise<LLMDecision> {
  const { systemPrompt, messages, toolName, toolInput, toolResult, tools = [] } = params;

  const resultText = formatToolResult(toolName, toolResult);
  const toolCallId = `call_${Date.now()}`;

  const updatedMessages: ChatMessage[] = [
    ...messages,
    {
      role: 'assistant',
      content: '',
      tool_calls: [{
        id: toolCallId,
        type: 'function',
        // Preserve the original arguments so the LLM can see what it called
        function: { name: toolName, arguments: JSON.stringify(toolInput ?? {}) },
      }],
    },
    {
      role: 'tool',
      content: resultText,
      tool_call_id: toolCallId,
    },
  ];

  return think({ systemPrompt, messages: updatedMessages, tools });
}

// ── Result formatter ──────────────────────────────────────────────────────
export function formatToolResult(toolName: string, result: IToolExecutionResult): string {
  // ── Grocery Runner ─────────────────────────────────────────────────────
  if (toolName === 'finalize_shopping_list') {
    return result.status === 'SUCCESS'
      ? 'Shopping list finalized and saved. Now call generate_grocery_report with your best price/size/image estimate for each item.'
      : `Tool "${toolName}" failed: ${result.errorMessage ?? 'Unknown error'}`;
  }

  if (result.status === 'SUCCESS' && result.groceryReport) {
    const { items, estimatedTotalDisplay, bestStores, relatedMeals, tripTheme } = result.groceryReport;
    const rows = items.map(
      (i) => `| ${i.itemName} | ${i.estimatedPriceDisplay} | ${i.sizeDisplay ?? '—'} |`,
    );
    return [
      `Tool "${toolName}" generated the grocery report${tripTheme ? ` for "${tripTheme}"` : ''}:`,
      '',
      '| Item | Est. Price | Size |',
      '|---|---|---|',
      ...rows,
      '',
      `Estimated total: ${estimatedTotalDisplay}`,
      `Best stores for this list: ${bestStores.join(', ')}`,
      `Related meals to explore: ${relatedMeals.join(', ')}`,
      '',
      'Present this table to the user, mention the estimated total, the best-store suggestion, and the related meal',
      'ideas. Tell them a visual report page has also been generated that they can view, save as an HTML file, or',
      'download as an image. This is the end of the run — do not ask "anything else?" or any other question.',
    ].join('\n');
  }

  // Search returned a ranked list — hand the whole list to the LLM so IT presents
  // the choices and recommends the single best, then calls book_hotel.
  if (result.status === 'SUCCESS' && result.options && result.options.length > 0) {
    const top = result.options.slice(0, 6);
    const lines = top.map(
      (o, i) => `${i + 1}. ${o.entityName} — ${o.priceDisplay} — ${o.summaryDetails}`,
    );
    return [
      `Tool "${toolName}" found ${result.options.length} hotels (showing top ${top.length}, best first):`,
      '',
      ...lines,
      '',
      'Present these options to the user, recommend the SINGLE best match for their',
      'budget and preferences with a one-line reason, then ask them to confirm.',
      '',
      'IMPORTANT: These results are now in your context — do NOT call search_hotels',
      'again. When the user confirms, call book_hotel with the exact hotelName and',
      'price from the list above.',
    ].join('\n');
  }

  if (result.status === 'SUCCESS' && result.scrapedData) {
    return [
      `Tool "${toolName}" completed successfully.`,
      '',
      'Booked:',
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
