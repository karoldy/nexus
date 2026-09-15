export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'FILL_BLANK',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionOptionInput = { id?: string; text: string };
export type NormalizedOption = { id: string; text: string };

export type NormalizedQuestionBody = {
  type: QuestionType;
  stem: string;
  options: NormalizedOption[] | null;
  answer: Record<string, unknown>;
  explanation: string | null;
  difficulty: number;
};

const CHOICE_TYPES: readonly QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
const NO_OPTION_TYPES: readonly QuestionType[] = ['TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function normalizeStem(stem: string): string {
  const trimmed = stem.trim();
  if (!trimmed) {
    throw new Error('stem must not be empty');
  }
  return trimmed;
}

function normalizeDifficulty(difficulty?: number): number {
  const value = difficulty ?? 3;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('difficulty must be an integer between 1 and 5');
  }
  return value;
}

function normalizeExplanation(explanation?: string | null): string | null {
  if (explanation == null) {
    return null;
  }
  const trimmed = explanation.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeChoiceOptions(
  options: QuestionOptionInput[] | null | undefined,
): NormalizedOption[] {
  if (!options || options.length < 2) {
    throw new Error('choice questions require at least 2 options');
  }

  return options.map((option) => {
    const text = option.text.trim();
    if (!text) {
      throw new Error('option text must not be empty');
    }

    if (option.id !== undefined) {
      if (!isValidUuid(option.id)) {
        throw new Error('option id must be a valid UUID');
      }
      return { id: option.id, text };
    }

    return { id: crypto.randomUUID(), text };
  });
}

function assertNoOptions(options: QuestionOptionInput[] | null | undefined): void {
  if (options != null && options.length > 0) {
    throw new Error('this question type must not have options');
  }
}

function normalizeSingleChoiceAnswer(
  answer: unknown,
  options: NormalizedOption[],
): Record<string, unknown> {
  if (typeof answer !== 'object' || answer === null || !('optionId' in answer)) {
    throw new Error('single choice answer must include optionId');
  }

  const optionId = (answer as { optionId: unknown }).optionId;
  if (typeof optionId !== 'string') {
    throw new Error('single choice answer must include optionId');
  }

  const optionIds = new Set(options.map((option) => option.id));
  if (!optionIds.has(optionId)) {
    throw new Error('single choice answer optionId must match an option');
  }

  return { optionId };
}

function normalizeMultipleChoiceAnswer(
  answer: unknown,
  options: NormalizedOption[],
): Record<string, unknown> {
  if (typeof answer !== 'object' || answer === null || !('optionIds' in answer)) {
    throw new Error('multiple choice answer must include optionIds');
  }

  const optionIdsInput = (answer as { optionIds: unknown }).optionIds;
  if (!Array.isArray(optionIdsInput) || optionIdsInput.length === 0) {
    throw new Error('multiple choice answer must include non-empty optionIds');
  }

  const validOptionIds = new Set(options.map((option) => option.id));
  const normalizedIds: string[] = [];

  for (const id of optionIdsInput) {
    if (typeof id !== 'string') {
      throw new Error('multiple choice optionIds must be strings');
    }
    if (!validOptionIds.has(id)) {
      throw new Error('multiple choice optionIds must match options');
    }
    if (normalizedIds.includes(id)) {
      throw new Error('multiple choice optionIds must be unique');
    }
    normalizedIds.push(id);
  }

  return { optionIds: normalizedIds };
}

function normalizeTrueFalseAnswer(answer: unknown): Record<string, unknown> {
  if (typeof answer !== 'object' || answer === null || !('value' in answer)) {
    throw new Error('true/false answer must include value');
  }

  const value = (answer as { value: unknown }).value;
  if (typeof value !== 'boolean') {
    throw new Error('true/false answer value must be boolean');
  }

  return { value };
}

function normalizeShortAnswer(answer: unknown): Record<string, unknown> {
  if (typeof answer !== 'object' || answer === null || !('text' in answer)) {
    throw new Error('short answer must include text');
  }

  const text = (answer as { text: unknown }).text;
  if (typeof text !== 'string') {
    throw new Error('short answer must include text');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('short answer text must not be empty');
  }

  return { text: trimmed };
}

function normalizeFillBlankAnswer(answer: unknown): Record<string, unknown> {
  if (typeof answer !== 'object' || answer === null || !('blanks' in answer)) {
    throw new Error('fill blank answer must include blanks');
  }

  const blanks = (answer as { blanks: unknown }).blanks;
  if (!Array.isArray(blanks) || blanks.length === 0) {
    throw new Error('fill blank answer must include at least one blank');
  }

  const normalizedBlanks: string[] = [];
  for (const blank of blanks) {
    if (typeof blank !== 'string') {
      throw new Error('fill blank entries must be strings');
    }
    const trimmed = blank.trim();
    if (!trimmed) {
      throw new Error('fill blank entries must not be empty');
    }
    normalizedBlanks.push(trimmed);
  }

  return { blanks: normalizedBlanks };
}

export function normalizeQuestionPayload(input: {
  type: string;
  stem: string;
  options?: QuestionOptionInput[] | null;
  answer: unknown;
  explanation?: string | null;
  difficulty?: number;
}): NormalizedQuestionBody {
  if (!isQuestionType(input.type)) {
    throw new Error(`unknown question type: ${input.type}`);
  }

  const type = input.type;
  const stem = normalizeStem(input.stem);
  const difficulty = normalizeDifficulty(input.difficulty);
  const explanation = normalizeExplanation(input.explanation);

  if (CHOICE_TYPES.includes(type)) {
    const options = normalizeChoiceOptions(input.options);
    const answer =
      type === 'SINGLE_CHOICE'
        ? normalizeSingleChoiceAnswer(input.answer, options)
        : normalizeMultipleChoiceAnswer(input.answer, options);

    return { type, stem, options, answer, explanation, difficulty };
  }

  if (NO_OPTION_TYPES.includes(type)) {
    assertNoOptions(input.options);

    const answer =
      type === 'TRUE_FALSE'
        ? normalizeTrueFalseAnswer(input.answer)
        : type === 'SHORT_ANSWER'
          ? normalizeShortAnswer(input.answer)
          : normalizeFillBlankAnswer(input.answer);

    return { type, stem, options: null, answer, explanation, difficulty };
  }

  throw new Error(`unknown question type: ${input.type}`);
}
