import {
  BattleAnswerSubmission,
  BattlePlayer,
  BattleQuestionSnapshot,
  BattleSession,
} from '@prisma/client';

type BattleWithRelations = BattleSession & {
  players: BattlePlayer[];
  questions: BattleQuestionSnapshot[];
  submissions?: BattleAnswerSubmission[];
};

export function toBattleResponse(battle: BattleWithRelations) {
  return {
    id: battle.id,
    roomId: battle.roomId,
    format: battle.format,
    skill: battle.skill,
    isRanked: battle.isRanked,
    status: battle.status,
    questionCount: battle.questionCount,
    createdBy: battle.createdBy,
    createdAt: battle.createdAt,
    startedAt: battle.startedAt,
    finishedAt: battle.finishedAt,

    players: battle.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      team: player.team,
      role: player.role,
      score: player.score,
      correctCount: player.correctCount,
      totalResponseTimeMs: player.totalResponseTimeMs,
      result: player.result,
    })),

    questions: battle.questions
      .sort((a, b) => {
        if ((a.assignedRole ?? '') === (b.assignedRole ?? '')) {
          return a.questionIndex - b.questionIndex;
        }

        return String(a.assignedRole ?? '').localeCompare(
          String(b.assignedRole ?? ''),
        );
      })
      .map((question) => ({
        id: question.id,
        questionIndex: question.questionIndex,
        sourceQuestionId: question.sourceQuestionId,
        sourceQuestionVersion: question.sourceQuestionVersion,
        skill: question.skill,
        difficulty: question.difficulty,
        type: question.type,
        assignedRole: question.assignedRole,
        promptText: question.promptText,
        media: question.mediaJson,
        options: question.optionsJson,
        maxTimeSec: question.maxTimeSec,
        baseScore: question.baseScore,
        speedBonus: question.speedBonus,
      })),

    submissions: battle.submissions?.map((submission) => ({
      id: submission.id,
      questionSnapshotId: submission.questionSnapshotId,
      userId: submission.userId,
      selectedOptionKey: submission.selectedOptionKey,
      textAnswer: submission.textAnswer,
      responseTimeMs: submission.responseTimeMs,
      status: submission.status,
      isCorrect: submission.isCorrect,
      score: submission.score,
      submittedAt: submission.submittedAt,
    })),
  };
}