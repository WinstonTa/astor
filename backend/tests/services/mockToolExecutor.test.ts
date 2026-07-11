import { describe, it, expect, vi } from 'vitest';
import type { IBrowserToolInvocation } from '../../src/contracts/toolContract.js';
import type { IRunHooks } from '../../src/contracts/runHooks.js';
import type { ITelemetryFrame } from '../../src/contracts/streamContract.js';

// Import directly — no mocks needed for the mock executor
const { executeBrowserTask } = await import('../../src/services/mockToolExecutor.js');

function createMockHooks(): IRunHooks & { frames: ITelemetryFrame[] } {
  return {
    frames: [],
    onFrame(frame: ITelemetryFrame) {
      this.frames.push(frame);
    },
  };
}

describe('mockToolExecutor', () => {
  it('returns SUCCESS with scraped hotel data', async () => {
    const hooks = createMockHooks();
    const invocation: IBrowserToolInvocation = {
      runId: 'run-test-1',
      targetUrl: 'https://www.expedia.com',
      browserbaseContextId: '',
      searchParameters: {
        location: 'Seattle',
        maxBudget: 200,
        preferences: ['King bed', 'Pool'],
      },
    };

    const result = await executeBrowserTask(invocation, hooks);

    expect(result.status).toBe('SUCCESS');
    expect(result.scrapedData).toBeDefined();
    expect(result.scrapedData!.entityName).toContain('Seattle');
    expect(result.scrapedData!.priceDisplay).toContain('$');
    expect(result.scrapedData!.summaryDetails).toContain('King bed');
    expect(result.scrapedData!.summaryDetails).toContain('Pool');
  });

  it('emits telemetry frames through hooks', async () => {
    const hooks = createMockHooks();
    const invocation: IBrowserToolInvocation = {
      runId: 'run-test-2',
      targetUrl: 'https://www.expedia.com',
      browserbaseContextId: '',
      searchParameters: {
        location: 'Portland',
        maxBudget: 150,
        preferences: [],
      },
    };

    await executeBrowserTask(invocation, hooks);

    expect(hooks.frames.length).toBeGreaterThanOrEqual(3);

    const types = hooks.frames.map((f) => f.type);
    expect(types).toContain('tool_start');
    expect(types).toContain('thinking');
    expect(types).toContain('viewport_update');
    expect(types).toContain('complete');
  });

  it('uses location and budget in responses', async () => {
    const hooks = createMockHooks();
    const invocation: IBrowserToolInvocation = {
      runId: 'run-test-3',
      targetUrl: 'https://www.expedia.com',
      browserbaseContextId: '',
      searchParameters: {
        location: 'Tokyo',
        maxBudget: 500,
        preferences: ['Near Shibuya'],
      },
    };

    const result = await executeBrowserTask(invocation, hooks);

    expect(result.status).toBe('SUCCESS');
    expect(result.scrapedData!.entityName).toContain('Tokyo');
    expect(result.scrapedData!.summaryDetails).toContain('Near Shibuya');

    // Price should be under budget
    const price = parseInt(result.scrapedData!.priceDisplay.replace(/\D/g, ''));
    expect(price).toBeLessThanOrEqual(500);
  });

  it('emits frames with timestamps', async () => {
    const hooks = createMockHooks();
    const invocation: IBrowserToolInvocation = {
      runId: 'run-test-4',
      targetUrl: 'https://www.expedia.com',
      browserbaseContextId: '',
      searchParameters: { location: 'LA', maxBudget: 300, preferences: [] },
    };

    await executeBrowserTask(invocation, hooks);

    for (const frame of hooks.frames) {
      expect(frame.timestamp).toBeTruthy();
      expect(new Date(frame.timestamp).getTime()).not.toBeNaN();
    }
  });

  it('completes within a reasonable time', async () => {
    const hooks = createMockHooks();
    const invocation: IBrowserToolInvocation = {
      runId: 'run-test-5',
      targetUrl: 'https://www.expedia.com',
      browserbaseContextId: '',
      searchParameters: { location: 'SF', maxBudget: 250, preferences: [] },
    };

    const start = Date.now();
    await executeBrowserTask(invocation, hooks);
    const elapsed = Date.now() - start;

    // Mock sleeps total ~3s, should finish within 5s
    expect(elapsed).toBeLessThan(5000);
    expect(elapsed).toBeGreaterThan(2000);
  });
});
