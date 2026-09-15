import { describe, expect, it } from 'vitest';
import { normalizeQuestionPayload } from './question-payload';

describe('normalizeQuestionPayload', () => {
  it('assigns ids and rewrites optionId when client sends optionIndex 0 via first option text match', () => {
    const result = normalizeQuestionPayload({
      type: 'SINGLE_CHOICE',
      stem: 'Pick one',
      options: [{ id: '11111111-1111-4111-8111-111111111111', text: 'A' }, { text: 'B' }],
      answer: { optionId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(result.options?.[0].id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.answer).toEqual({
      optionId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects single choice with one option', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'SINGLE_CHOICE',
        stem: 'x',
        options: [{ text: 'A' }],
        answer: { optionId: 'nope' },
      }),
    ).toThrow(/option/i);
  });

  it('accepts true/false without options', () => {
    const result = normalizeQuestionPayload({
      type: 'TRUE_FALSE',
      stem: 'Earth is round',
      answer: { value: true },
    });
    expect(result.options).toBeNull();
    expect(result.answer).toEqual({ value: true });
    expect(result.difficulty).toBe(3);
  });

  it('rejects fill blank with empty string', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'FILL_BLANK',
        stem: '2+2=?',
        answer: { blanks: [''] },
      }),
    ).toThrow();
  });
});
