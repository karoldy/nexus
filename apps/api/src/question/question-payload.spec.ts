import { describe, expect, it } from 'vitest';
import { normalizeQuestionPayload } from './question-payload';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('normalizeQuestionPayload', () => {
  it('keeps client option ids and optionId answers', () => {
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

  it('assigns ids and maps optionIndex to optionId for text-only options', () => {
    const result = normalizeQuestionPayload({
      type: 'SINGLE_CHOICE',
      stem: 'Pick one',
      options: [{ text: 'A' }, { text: 'B' }],
      answer: { optionIndex: 1 },
    });
    expect(result.options).toHaveLength(2);
    expect(result.options?.[0].id).toMatch(UUID_REGEX);
    expect(result.options?.[1].id).toMatch(UUID_REGEX);
    expect(result.answer).toEqual({ optionId: result.options?.[1].id });
  });

  it('assigns ids and maps optionIndexes to optionIds for text-only options', () => {
    const result = normalizeQuestionPayload({
      type: 'MULTIPLE_CHOICE',
      stem: 'Pick some',
      options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      answer: { optionIndexes: [0, 2] },
    });
    expect(result.options).toHaveLength(3);
    expect(result.answer).toEqual({
      optionIds: [result.options?.[0].id, result.options?.[2].id],
    });
  });

  it('keeps client optionIds when ids are provided', () => {
    const optionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const optionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const result = normalizeQuestionPayload({
      type: 'MULTIPLE_CHOICE',
      stem: 'Pick some',
      options: [
        { id: optionA, text: 'A' },
        { id: optionB, text: 'B' },
      ],
      answer: { optionIds: [optionA, optionB] },
    });
    expect(result.answer).toEqual({ optionIds: [optionA, optionB] });
  });

  it('rejects duplicate option ids', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'SINGLE_CHOICE',
        stem: 'Pick one',
        options: [
          { id: '11111111-1111-4111-8111-111111111111', text: 'A' },
          { id: '11111111-1111-4111-8111-111111111111', text: 'B' },
        ],
        answer: { optionId: '11111111-1111-4111-8111-111111111111' },
      }),
    ).toThrow(/duplicate/i);
  });

  it('rejects out-of-range optionIndex', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'SINGLE_CHOICE',
        stem: 'Pick one',
        options: [{ text: 'A' }, { text: 'B' }],
        answer: { optionIndex: 2 },
      }),
    ).toThrow(/optionIndex/i);
  });

  it('rejects duplicate optionIndexes', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'MULTIPLE_CHOICE',
        stem: 'Pick some',
        options: [{ text: 'A' }, { text: 'B' }],
        answer: { optionIndexes: [0, 0] },
      }),
    ).toThrow(/optionIndexes/i);
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
