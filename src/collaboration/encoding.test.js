import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from './encoding.js';

describe('encoding', () => {
  describe('toBase64', () => {
    it('encodes an empty Uint8Array', () => {
      expect(toBase64(new Uint8Array([]))).toBe('');
    });

    it('encodes simple bytes', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(toBase64(bytes)).toBe(btoa('Hello'));
    });

    it('encodes binary data with high byte values', () => {
      const bytes = new Uint8Array([0, 128, 255]);
      const result = toBase64(bytes);
      expect(typeof result).toBe('string');
      // Verify round-trip
      const decoded = fromBase64(result);
      expect(decoded).toEqual(bytes);
    });

    it('encodes all 256 byte values correctly', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) bytes[i] = i;
      const b64 = toBase64(bytes);
      const roundTripped = fromBase64(b64);
      expect(roundTripped).toEqual(bytes);
    });
  });

  describe('fromBase64', () => {
    it('decodes an empty string', () => {
      expect(fromBase64('')).toEqual(new Uint8Array([]));
    });

    it('decodes a known base64 string', () => {
      const result = fromBase64(btoa('Hello'));
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('returns a Uint8Array', () => {
      const result = fromBase64(btoa('test'));
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('round-trip', () => {
    it('preserves data through encode/decode cycle', () => {
      const original = new Uint8Array([1, 2, 3, 100, 200, 255, 0]);
      expect(fromBase64(toBase64(original))).toEqual(original);
    });

    it('preserves large payloads', () => {
      const original = new Uint8Array(10000);
      for (let i = 0; i < original.length; i++) original[i] = i % 256;
      expect(fromBase64(toBase64(original))).toEqual(original);
    });
  });
});
