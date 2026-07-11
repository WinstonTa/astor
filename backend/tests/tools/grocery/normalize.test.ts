import { describe, it, expect } from 'vitest';
import { parsePriceCents, formatCents } from '../../../src/tools/grocery/normalize.js';

describe('normalize', () => {
  describe('parsePriceCents', () => {
    it('parses a simple dollar price', () => {
      expect(parsePriceCents('$4.99')).toBe(499);
    });

    it('parses a price without a dollar sign', () => {
      expect(parsePriceCents('12.50')).toBe(1250);
    });

    it('parses a price with thousands separators', () => {
      expect(parsePriceCents('$1,299.00')).toBe(129900);
    });

    it('parses a whole-dollar price', () => {
      expect(parsePriceCents('$12')).toBe(1200);
    });

    it('returns null for unparseable input', () => {
      expect(parsePriceCents('out of stock')).toBeNull();
    });
  });

  describe('formatCents', () => {
    it('formats cents back to a dollar string', () => {
      expect(formatCents(499)).toBe('$4.99');
      expect(formatCents(0)).toBe('$0.00');
      expect(formatCents(129900)).toBe('$1299.00');
    });
  });
});
