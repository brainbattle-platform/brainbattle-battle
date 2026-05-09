import {
  BattleQuestion,
  BattleQuestionMedia,
  BattleQuestionOption,
  QuestionMediaType,
  QuestionSkill,
  QuestionType,
} from '@prisma/client';

export type QuestionForValidation = BattleQuestion & {
  options: BattleQuestionOption[];
  media: BattleQuestionMedia[];
};

export interface QuestionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBattleQuestion(
  question: QuestionForValidation,
): QuestionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasPrompt = Boolean(question.promptText?.trim());
  const hasMedia = question.media.length > 0;

  if (!hasPrompt && !hasMedia) {
    errors.push('Question must have promptText or at least one media item.');
  }

  if (question.maxTimeSec <= 0) {
    errors.push('maxTimeSec must be greater than 0.');
  }

  if (question.baseScore <= 0) {
    errors.push('baseScore must be greater than 0.');
  }

  if (question.speedBonus < 0) {
    errors.push('speedBonus must be greater than or equal to 0.');
  }

  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    validateMultipleChoice(question, errors, warnings);
  }

  if (question.type === QuestionType.FILL_BLANK) {
    validateFillBlank(question, errors, warnings);
  }

  if (question.skill === QuestionSkill.LISTENING) {
    validateListening(question, errors, warnings);
  }

  validateBattleTiming(question, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateMultipleChoice(
  question: QuestionForValidation,
  errors: string[],
  warnings: string[],
) {
  if (question.options.length < 2) {
    errors.push('Multiple choice question must have at least 2 options.');
  }

  if (question.options.length > 6) {
    errors.push('Multiple choice question must have at most 6 options.');
  }

  const keys = question.options.map((option) => option.key.trim().toUpperCase());
  const uniqueKeys = new Set(keys);

  if (keys.length !== uniqueKeys.size) {
    errors.push('Option keys must be unique.');
  }

  if (!question.correctOptionKey) {
    errors.push('Multiple choice question requires correctOptionKey.');
    return;
  }

  const correctKey = question.correctOptionKey.trim().toUpperCase();

  if (!uniqueKeys.has(correctKey)) {
    errors.push('correctOptionKey must exist in options.');
  }

  const emptyOptions = question.options.filter(
    (option) => !option.text?.trim() && !option.mediaUrl,
  );

  if (emptyOptions.length > 0) {
    errors.push('Every option must have text or mediaUrl.');
  }

  if (question.options.length < 4) {
    warnings.push('Battle MCQ usually works better with 4 options.');
  }
}

function validateFillBlank(
  question: QuestionForValidation,
  errors: string[],
  warnings: string[],
) {
  if (!question.promptText?.includes('{{blank}}')) {
    errors.push('Fill blank question promptText must include {{blank}}.');
  }

  const answers = question.acceptedAnswers
    .map((answer) => answer.trim())
    .filter(Boolean);

  if (answers.length === 0) {
    errors.push('Fill blank question requires at least one accepted answer.');
  }

  if (question.options.length > 0) {
    warnings.push('Fill blank question should not need options.');
  }
}

function validateListening(
  question: QuestionForValidation,
  errors: string[],
  warnings: string[],
) {
  const playableMedia = question.media.filter(
    (item) =>
      item.type === QuestionMediaType.AUDIO ||
      item.type === QuestionMediaType.VIDEO,
  );

  if (playableMedia.length === 0) {
    errors.push('Listening question requires AUDIO or VIDEO media.');
    return;
  }

  for (const media of playableMedia) {
    if (!media.durationSec || media.durationSec <= 0) {
      errors.push('Listening AUDIO/VIDEO media requires durationSec.');
    }

    if (media.durationSec && media.durationSec > 25) {
      warnings.push('Listening media is long for realtime battle.');
    }

    if (media.durationSec && question.maxTimeSec < media.durationSec) {
      errors.push('maxTimeSec must be greater than or equal to media durationSec.');
    }
  }
}

function validateBattleTiming(
  question: QuestionForValidation,
  errors: string[],
  warnings: string[],
) {
  if (question.type === QuestionType.MULTIPLE_CHOICE && question.maxTimeSec > 25) {
    warnings.push('MCQ maxTimeSec is high for realtime battle.');
  }

  if (question.type === QuestionType.FILL_BLANK && question.maxTimeSec < 10) {
    warnings.push('Fill blank usually needs at least 10 seconds.');
  }

  if (question.maxTimeSec > 35) {
    errors.push('maxTimeSec must not exceed 35 seconds for battle.');
  }
}