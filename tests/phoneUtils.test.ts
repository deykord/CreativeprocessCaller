/**
 * Tests for phone number utilities
 */

import { describe, it, expect } from 'vitest';
import { standardizePhoneNumber, isValidE164, formatPhoneForDisplay } from '../utils/phoneUtils';

describe('phoneUtils', () => {
  describe('standardizePhoneNumber', () => {
    it('should convert (555) 123-4567 to E.164 format', () => {
      const result = standardizePhoneNumber('(555) 123-4567');
      expect(result).toBe('+15551234567');
    });

    it('should convert 555-123-4567 to E.164 format', () => {
      const result = standardizePhoneNumber('555-123-4567');
      expect(result).toBe('+15551234567');
    });

    it('should convert 555.123.4567 to E.164 format', () => {
      const result = standardizePhoneNumber('555.123.4567');
      expect(result).toBe('+15551234567');
    });

    it('should convert 5551234567 to E.164 format', () => {
      const result = standardizePhoneNumber('5551234567');
      expect(result).toBe('+15551234567');
    });

    it('should handle +1 (555) 123-4567 format', () => {
      const result = standardizePhoneNumber('+1 (555) 123-4567');
      expect(result).toBe('+15551234567');
    });

    it('should handle already E.164 format', () => {
      const result = standardizePhoneNumber('+15551234567');
      expect(result).toBe('+15551234567');
    });

    it('should add country code if missing', () => {
      const result = standardizePhoneNumber('5551234567');
      expect(result).toBe('+15551234567');
    });

    it('should handle 11 digit number with country code', () => {
      const result = standardizePhoneNumber('15551234567');
      expect(result).toBe('+15551234567');
    });

    it('should handle spaces and special characters', () => {
      const result = standardizePhoneNumber('+1 555 123 4567');
      expect(result).toBe('+15551234567');
    });

    it('should handle parentheses with dashes', () => {
      const result = standardizePhoneNumber('(555)123-4567');
      expect(result).toBe('+15551234567');
    });
  });

  describe('isValidE164', () => {
    it('should validate correct E.164 format', () => {
      expect(isValidE164('+15551234567')).toBe(true);
    });

    it('should reject format without +', () => {
      expect(isValidE164('15551234567')).toBe(false);
    });

    it('should reject format with special characters', () => {
      expect(isValidE164('+1 (555) 123-4567')).toBe(false);
    });

    it('should reject format starting with 0', () => {
      expect(isValidE164('+05551234567')).toBe(false);
    });

    it('should accept international numbers', () => {
      expect(isValidE164('+442012345678')).toBe(true); // UK
      expect(isValidE164('+33123456789')).toBe(true); // France
    });

    it('should reject too long numbers', () => {
      expect(isValidE164('+12345678901234567')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidE164('')).toBe(false);
    });
  });

  describe('formatPhoneForDisplay', () => {
    it('should format E.164 to US format', () => {
      const result = formatPhoneForDisplay('+15551234567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should format 10 digit number to US format', () => {
      const result = formatPhoneForDisplay('5551234567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should handle international numbers', () => {
      const result = formatPhoneForDisplay('+442012345678');
      expect(result).toBe('+442012345678'); // Keep as-is for non-US
    });

    it('should handle empty string', () => {
      const result = formatPhoneForDisplay('');
      expect(result).toBe('');
    });
  });
});
