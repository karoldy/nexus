import type { QuestionType } from '../question/question-payload';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export function isAnswerCorrect(
  type: string,
  answerSnapshot: unknown,
  submittedAnswer: unknown,
): boolean {
  const expected = asRecord(answerSnapshot);
  const submitted = asRecord(submittedAnswer);
  if (!expected || !submitted) {
    return false;
  }

  switch (type as QuestionType) {
    case 'SINGLE_CHOICE':
      return (
        typeof expected.optionId === 'string' &&
        typeof submitted.optionId === 'string' &&
        expected.optionId === submitted.optionId
      );
    case 'MULTIPLE_CHOICE': {
      const expectedIds = expected.optionIds;
      const submittedIds = submitted.optionIds;
      return (
        Array.isArray(expectedIds) &&
        Array.isArray(submittedIds) &&
        expectedIds.every((id) => typeof id === 'string') &&
        submittedIds.every((id) => typeof id === 'string') &&
        sameStringSet(expectedIds as string[], submittedIds as string[])
      );
    }
    case 'TRUE_FALSE':
      return typeof expected.value === 'boolean' && expected.value === submitted.value;
    case 'SHORT_ANSWER':
      return (
        typeof expected.text === 'string' &&
        typeof submitted.text === 'string' &&
        expected.text.trim() === submitted.text.trim()
      );
    case 'FILL_BLANK': {
      const expectedBlanks = expected.blanks;
      const submittedBlanks = submitted.blanks;
      if (!Array.isArray(expectedBlanks) || !Array.isArray(submittedBlanks)) {
        return false;
      }
      if (expectedBlanks.length !== submittedBlanks.length) {
        return false;
      }
      return expectedBlanks.every(
        (blank, index) =>
          typeof blank === 'string' &&
          typeof submittedBlanks[index] === 'string' &&
          blank.trim() === submittedBlanks[index].trim(),
      );
    }
    default:
      return false;
  }
}

export function toScoreNumber(value: string | number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
