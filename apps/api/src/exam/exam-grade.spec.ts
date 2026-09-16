import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from './exam-grade';

describe('isAnswerCorrect', () => {
  it('matches single choice by optionId', () => {
    expect(isAnswerCorrect('SINGLE_CHOICE', { optionId: 'a' }, { optionId: 'a' })).toBe(true);
    expect(isAnswerCorrect('SINGLE_CHOICE', { optionId: 'a' }, { optionId: 'b' })).toBe(false);
  });

  it('matches multiple choice as a set', () => {
    expect(
      isAnswerCorrect('MULTIPLE_CHOICE', { optionIds: ['a', 'b'] }, { optionIds: ['b', 'a'] }),
    ).toBe(true);
    expect(
      isAnswerCorrect('MULTIPLE_CHOICE', { optionIds: ['a', 'b'] }, { optionIds: ['a'] }),
    ).toBe(false);
  });

  it('trims short answers and blanks', () => {
    expect(isAnswerCorrect('SHORT_ANSWER', { text: 'Paris' }, { text: '  Paris ' })).toBe(true);
    expect(
      isAnswerCorrect('FILL_BLANK', { blanks: ['foo', 'bar'] }, { blanks: [' foo', 'bar '] }),
    ).toBe(true);
    expect(isAnswerCorrect('TRUE_FALSE', { value: true }, { value: false })).toBe(false);
    expect(isAnswerCorrect('SHORT_ANSWER', { text: 'Paris' }, null)).toBe(false);
  });
});
