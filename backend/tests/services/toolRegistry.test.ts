import { describe, it, expect } from 'vitest';
import {
  getToolsForAgent,
  isValidToolForAgent,
  getRegisteredSlugs,
  getAllToolNames,
} from '../../src/services/toolRegistry.js';

describe('toolRegistry', () => {
  describe('getToolsForAgent', () => {
    it('returns Hotel Booker tools for hotel-booker slug', () => {
      const tools = getToolsForAgent('hotel-booker');
      expect(tools.length).toBe(2);
      expect(tools.map((t) => t.name)).toContain('search_hotels');
      expect(tools.map((t) => t.name)).toContain('book_hotel');
    });

    it('returns empty array for unregistered agent', () => {
      const tools = getToolsForAgent('unknown-agent');
      expect(tools).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const tools = getToolsForAgent('');
      expect(tools).toEqual([]);
    });

    it('Hotel Booker search_hotels has required fields', () => {
      const tools = getToolsForAgent('hotel-booker');
      const search = tools.find((t) => t.name === 'search_hotels')!;

      expect(search.description).toBeTruthy();
      expect(search.input_schema).toBeDefined();
      expect(search.input_schema.type).toBe('object');
      expect(search.input_schema.properties).toHaveProperty('location');
      expect(search.input_schema.properties).toHaveProperty('maxBudget');
      expect(search.input_schema.required).toContain('location');
      expect(search.input_schema.required).toContain('maxBudget');
    });

    it('Hotel Booker book_hotel has required fields', () => {
      const tools = getToolsForAgent('hotel-booker');
      const book = tools.find((t) => t.name === 'book_hotel')!;

      expect(book.description).toBeTruthy();
      expect(book.description).toContain('confirmation');
      expect(book.input_schema.properties).toHaveProperty('hotelName');
      expect(book.input_schema.properties).toHaveProperty('price');
      expect(book.input_schema.required).toContain('hotelName');
      expect(book.input_schema.required).toContain('price');
    });

    it('search_hotels has optional preference and date fields', () => {
      const tools = getToolsForAgent('hotel-booker');
      const search = tools.find((t) => t.name === 'search_hotels')!;
      const props = search.input_schema.properties as Record<string, any>;

      expect(props).toHaveProperty('preferences');
      expect(props.preferences.type).toBe('array');
      expect(props).toHaveProperty('checkIn');
      expect(props).toHaveProperty('checkOut');
    });
  });

  describe('isValidToolForAgent', () => {
    it('returns true for valid tool', () => {
      expect(isValidToolForAgent('hotel-booker', 'search_hotels')).toBe(true);
      expect(isValidToolForAgent('hotel-booker', 'book_hotel')).toBe(true);
    });

    it('returns false for invalid tool', () => {
      expect(isValidToolForAgent('hotel-booker', 'send_email')).toBe(false);
    });

    it('returns false for unknown agent', () => {
      expect(isValidToolForAgent('unknown', 'search_hotels')).toBe(false);
    });
  });

  describe('getRegisteredSlugs', () => {
    it('includes hotel-booker', () => {
      const slugs = getRegisteredSlugs();
      expect(slugs).toContain('hotel-booker');
    });

    it('returns an array of strings', () => {
      const slugs = getRegisteredSlugs();
      expect(Array.isArray(slugs)).toBe(true);
      slugs.forEach((s) => expect(typeof s).toBe('string'));
    });
  });

  describe('getAllToolNames', () => {
    it('includes Hotel Booker tool names', () => {
      const names = getAllToolNames();
      expect(names).toContain('search_hotels');
      expect(names).toContain('book_hotel');
    });

    it('returns unique names', () => {
      const names = getAllToolNames();
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
