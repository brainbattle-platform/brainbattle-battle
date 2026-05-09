import {
  BattleQuestion,
  BattleQuestionMedia,
  BattleQuestionOption,
  QuestionReviewLog,
} from '@prisma/client';

type QuestionFull = BattleQuestion & {
  options: BattleQuestionOption[];
  media: BattleQuestionMedia[];
  reviewLogs?: QuestionReviewLog[];
};

export function toQuestionResponse(question: QuestionFull) {
  return {
    id: question.id,
    questionGroupId: question.questionGroupId,
    version: question.version,

    source: question.source,
    externalSource: question.externalSource,
    externalQuestionId: question.externalQuestionId,
    sourceVersion: question.sourceVersion,
    contentHash: question.contentHash,

    status: question.status,

    skill: question.skill,
    difficulty: question.difficulty,
    type: question.type,

    promptText: question.promptText,
    explanation: question.explanation,

    correctOptionKey: question.correctOptionKey,
    acceptedAnswers: question.acceptedAnswers,

    maxTimeSec: question.maxTimeSec,
    baseScore: question.baseScore,
    speedBonus: question.speedBonus,

    createdBy: question.createdBy,
    updatedBy: question.updatedBy,
    submittedBy: question.submittedBy,
    submittedAt: question.submittedAt,
    approvedBy: question.approvedBy,
    approvedAt: question.approvedAt,
    rejectedBy: question.rejectedBy,
    rejectedAt: question.rejectedAt,
    rejectedReason: question.rejectedReason,
    archivedBy: question.archivedBy,
    archivedAt: question.archivedAt,

    createdAt: question.createdAt,
    updatedAt: question.updatedAt,

    media: question.media
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((item) => ({
        id: item.id,
        type: item.type,
        url: item.url,
        durationSec: item.durationSec,
        mimeType: item.mimeType,
        orderIndex: item.orderIndex,
      })),

    options: question.options
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        id: option.id,
        key: option.key,
        text: option.text,
        mediaUrl: option.mediaUrl,
        orderIndex: option.orderIndex,
      })),

    reviewLogs: question.reviewLogs?.map((log) => ({
      id: log.id,
      action: log.action,
      actorUserId: log.actorUserId,
      note: log.note,
      createdAt: log.createdAt,
    })),
  };
}