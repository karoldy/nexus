import { describe, expect, it } from 'vitest';
import { bearerToken, looksLikeJwt } from './access-jwt';

describe('looksLikeJwt', () => {
  it('accepts three-segment tokens', () => {
    expect(looksLikeJwt('aaa.bbb.ccc')).toBe(true);
  });

  it('rejects opaque session tokens', () => {
    expect(looksLikeJwt('opaque-session-token')).toBe(false);
  });
});

describe('bearerToken', () => {
  it('reads the Bearer credential', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('ignores missing or non-bearer headers', () => {
    expect(bearerToken(undefined)).toBeUndefined();
    expect(bearerToken('Basic abc')).toBeUndefined();
  });
});
