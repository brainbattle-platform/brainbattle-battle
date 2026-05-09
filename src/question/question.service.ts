import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BattleQuestion,
  QuestionSource,
  QuestionStatus,
  QuestionType,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQuestionDto,
  ListQuestionsDto,
  UpdateQuestionDto,
} from './dto';
import { toQuestionResponse } from './question.mapper';
import { validateBattleQuestion } from './question.validator';

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(userId: string, dto: CreateQuestionDto) {
    const questionGroupId = randomUUID();
    const normalized = this.normalizeCreateDto(dto);

    const question = await this.prisma.$transaction(async (tx) => {
      const created = await tx.battleQuestion.create({
        data: {
          questionGroupId,
          version: 1,

          source: normalized.source,
          externalSource: normalized.externalSource,
          externalQuestionId: normalized.externalQuestionId,
          sourceVersion: normalized.sourceVersion,

          status: QuestionStatus.DRAFT,

          skill: normalized.skill,
          difficulty: normalized.difficulty,
          type: normalized.type,

          promptText: normalized.promptText,
          explanation: normalized.explanation,

          correctOptionKey: normalized.correctOptionKey,
          acceptedAnswers: normalized.acceptedAnswers,

          maxTimeSec: normalized.maxTimeSec,
          baseScore: normalized.baseScore,
          speedBonus: normalized.speedBonus,

          createdBy: userId,
          contentHash: this.computeContentHash(normalized),
        },
      });

      await this.replaceQuestionChildren(tx, created.id, normalized);

      await tx.questionReviewLog.create({
        data: {
          questionId: created.id,
          action: 'CREATED_DRAFT',
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: created.id },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(question),
      validation: validateBattleQuestion(question),
    };
  }

  async listQuestions(query: ListQuestionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BattleQuestionWhereInput = {
      status: query.status,
      source: query.source,
      skill: query.skill,
      difficulty: query.difficulty,
      type: query.type,
      externalQuestionId: query.externalQuestionId,
      OR: query.q
        ? [
            { promptText: { contains: query.q, mode: 'insensitive' } },
            { explanation: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, questions] = await this.prisma.$transaction([
      this.prisma.battleQuestion.count({ where }),
      this.prisma.battleQuestion.findMany({
        where,
        include: {
          options: true,
          media: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: questions.map(toQuestionResponse),
    };
  }

  async getQuestion(questionId: string) {
    const question = await this.getQuestionOrThrow(questionId, true);

    return {
      question: toQuestionResponse(question),
      validation: validateBattleQuestion(question),
    };
  }

  async updateDraft(userId: string, questionId: string, dto: UpdateQuestionDto) {
    const existing = await this.getQuestionOrThrow(questionId, false);

    this.assertEditable(existing);

    const merged = this.normalizeUpdateDto(existing, dto);

    const question = await this.prisma.$transaction(async (tx) => {
      await tx.battleQuestion.update({
        where: { id: questionId },
        data: {
          skill: merged.skill,
          difficulty: merged.difficulty,
          type: merged.type,

          promptText: merged.promptText,
          explanation: merged.explanation,

          correctOptionKey: merged.correctOptionKey,
          acceptedAnswers: merged.acceptedAnswers,

          maxTimeSec: merged.maxTimeSec,
          baseScore: merged.baseScore,
          speedBonus: merged.speedBonus,

          updatedBy: userId,
          status: QuestionStatus.DRAFT,
          rejectedBy: null,
          rejectedAt: null,
          rejectedReason: null,
          contentHash: this.computeContentHash(merged),
        },
      });

      await this.replaceQuestionChildren(tx, questionId, merged);

      await tx.questionReviewLog.create({
        data: {
          questionId,
          action: 'UPDATED_DRAFT',
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(question),
      validation: validateBattleQuestion(question),
    };
  }

  async validateQuestion(questionId: string) {
    const question = await this.getQuestionOrThrow(questionId, false);

    return {
      questionId,
      validation: validateBattleQuestion(question),
    };
  }

  async submitForReview(userId: string, questionId: string) {
    const question = await this.getQuestionOrThrow(questionId, false);

    this.assertEditable(question);

    const validation = validateBattleQuestion(question);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Question is not valid for review',
        validation,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.battleQuestion.update({
        where: { id: questionId },
        data: {
          status: QuestionStatus.PENDING_REVIEW,
          submittedBy: userId,
          submittedAt: new Date(),
        },
      });

      await tx.questionReviewLog.create({
        data: {
          questionId,
          action: 'SUBMITTED_FOR_REVIEW',
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(updated),
      validation,
    };
  }

  async approveQuestion(userId: string, questionId: string) {
    const question = await this.getQuestionOrThrow(questionId, false);

    if (question.status !== QuestionStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only PENDING_REVIEW question can be approved');
    }

    const validation = validateBattleQuestion(question);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Question is not valid for approval',
        validation,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.battleQuestion.update({
        where: { id: questionId },
        data: {
          status: QuestionStatus.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          rejectedReason: null,
        },
      });

      await tx.questionReviewLog.create({
        data: {
          questionId,
          action: 'APPROVED',
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(updated),
      validation,
    };
  }

  async rejectQuestion(userId: string, questionId: string, reason: string) {
    const question = await this.getQuestionOrThrow(questionId, false);

    if (question.status !== QuestionStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only PENDING_REVIEW question can be rejected');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.battleQuestion.update({
        where: { id: questionId },
        data: {
          status: QuestionStatus.REJECTED,
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectedReason: reason,
        },
      });

      await tx.questionReviewLog.create({
        data: {
          questionId,
          action: 'REJECTED',
          actorUserId: userId,
          note: reason,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(updated),
      validation: validateBattleQuestion(updated),
    };
  }

  async archiveQuestion(userId: string, questionId: string) {
    const question = await this.getQuestionOrThrow(questionId, false);

    if (question.status === QuestionStatus.ARCHIVED) {
      return {
        question: toQuestionResponse(question),
        validation: validateBattleQuestion(question),
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.battleQuestion.update({
        where: { id: questionId },
        data: {
          status: QuestionStatus.ARCHIVED,
          archivedBy: userId,
          archivedAt: new Date(),
        },
      });

      await tx.questionReviewLog.create({
        data: {
          questionId,
          action: 'ARCHIVED',
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(updated),
      validation: validateBattleQuestion(updated),
    };
  }

  async createNewVersion(userId: string, questionId: string) {
    const sourceQuestion = await this.getQuestionOrThrow(questionId, false);

    if (
      sourceQuestion.status !== QuestionStatus.APPROVED &&
      sourceQuestion.status !== QuestionStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Can only create new version from APPROVED or ARCHIVED question',
      );
    }

    const latest = await this.prisma.battleQuestion.findFirst({
      where: { questionGroupId: sourceQuestion.questionGroupId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? sourceQuestion.version) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const newQuestion = await tx.battleQuestion.create({
        data: {
          questionGroupId: sourceQuestion.questionGroupId,
          version: nextVersion,

          source: sourceQuestion.source,
          externalSource: sourceQuestion.externalSource,
          externalQuestionId: sourceQuestion.externalQuestionId,
          sourceVersion: sourceQuestion.sourceVersion,

          status: QuestionStatus.DRAFT,

          skill: sourceQuestion.skill,
          difficulty: sourceQuestion.difficulty,
          type: sourceQuestion.type,

          promptText: sourceQuestion.promptText,
          explanation: sourceQuestion.explanation,

          correctOptionKey: sourceQuestion.correctOptionKey,
          acceptedAnswers: sourceQuestion.acceptedAnswers,

          maxTimeSec: sourceQuestion.maxTimeSec,
          baseScore: sourceQuestion.baseScore,
          speedBonus: sourceQuestion.speedBonus,

          createdBy: userId,
          contentHash: sourceQuestion.contentHash,
        },
      });

      await tx.battleQuestionOption.createMany({
        data: sourceQuestion.options.map((option) => ({
          questionId: newQuestion.id,
          key: option.key,
          text: option.text,
          mediaUrl: option.mediaUrl,
          orderIndex: option.orderIndex,
        })),
      });

      await tx.battleQuestionMedia.createMany({
        data: sourceQuestion.media.map((media) => ({
          questionId: newQuestion.id,
          type: media.type,
          url: media.url,
          durationSec: media.durationSec,
          mimeType: media.mimeType,
          orderIndex: media.orderIndex,
        })),
      });

      await tx.questionReviewLog.create({
        data: {
          questionId: newQuestion.id,
          action: `CREATED_VERSION_FROM:${sourceQuestion.id}`,
          actorUserId: userId,
        },
      });

      return tx.battleQuestion.findUniqueOrThrow({
        where: { id: newQuestion.id },
        include: this.fullInclude(),
      });
    });

    return {
      question: toQuestionResponse(created),
      validation: validateBattleQuestion(created),
    };
  }

  private normalizeCreateDto(dto: CreateQuestionDto) {
    return {
      source: dto.source ?? QuestionSource.ADMIN_CREATED,
      externalSource: dto.externalSource,
      externalQuestionId: dto.externalQuestionId,
      sourceVersion: dto.sourceVersion,

      skill: dto.skill,
      difficulty: dto.difficulty,
      type: dto.type,

      promptText: dto.promptText?.trim() || null,
      explanation: dto.explanation?.trim() || null,

      correctOptionKey: dto.correctOptionKey?.trim().toUpperCase() || null,
      acceptedAnswers: this.normalizeAnswers(dto.acceptedAnswers),

      maxTimeSec: dto.maxTimeSec,
      baseScore: dto.baseScore ?? 100,
      speedBonus: dto.speedBonus ?? 50,

      media: dto.media ?? [],
      options: this.normalizeOptions(dto.options ?? []),
    };
  }

  private normalizeUpdateDto(existing: BattleQuestion, dto: UpdateQuestionDto) {
    const normalized = {
      skill: dto.skill ?? existing.skill,
      difficulty: dto.difficulty ?? existing.difficulty,
      type: dto.type ?? existing.type,

      promptText:
        dto.promptText !== undefined
          ? dto.promptText.trim() || null
          : existing.promptText,

      explanation:
        dto.explanation !== undefined
          ? dto.explanation.trim() || null
          : existing.explanation,

      correctOptionKey:
        dto.correctOptionKey !== undefined
          ? dto.correctOptionKey.trim().toUpperCase() || null
          : existing.correctOptionKey,

      acceptedAnswers:
        dto.acceptedAnswers !== undefined
          ? this.normalizeAnswers(dto.acceptedAnswers)
          : existing.acceptedAnswers,

      maxTimeSec: dto.maxTimeSec ?? existing.maxTimeSec,
      baseScore: dto.baseScore ?? existing.baseScore,
      speedBonus: dto.speedBonus ?? existing.speedBonus,

      media: dto.media,
      options: dto.options ? this.normalizeOptions(dto.options) : undefined,
    };

    return normalized;
  }

  private normalizeOptions(options: Array<{ key: string; text?: string; mediaUrl?: string; orderIndex?: number }>) {
    return options.map((option, index) => ({
      key: option.key.trim().toUpperCase(),
      text: option.text?.trim() || null,
      mediaUrl: option.mediaUrl || null,
      orderIndex: option.orderIndex ?? index,
    }));
  }

  private normalizeAnswers(answers?: string[]) {
    return (answers ?? [])
      .map((answer) => answer.trim())
      .filter(Boolean);
  }

  private async replaceQuestionChildren(
    tx: Prisma.TransactionClient,
    questionId: string,
    payload: {
      media?: Array<{
        type: any;
        url: string;
        durationSec?: number;
        mimeType?: string;
        orderIndex?: number;
      }>;
      options?: Array<{
        key: string;
        text?: string | null;
        mediaUrl?: string | null;
        orderIndex?: number;
      }>;
    },
  ) {
    if (payload.options !== undefined) {
      await tx.battleQuestionOption.deleteMany({ where: { questionId } });

      if (payload.options.length > 0) {
        await tx.battleQuestionOption.createMany({
          data: payload.options.map((option, index) => ({
            questionId,
            key: option.key,
            text: option.text ?? null,
            mediaUrl: option.mediaUrl ?? null,
            orderIndex: option.orderIndex ?? index,
          })),
        });
      }
    }

    if (payload.media !== undefined) {
      await tx.battleQuestionMedia.deleteMany({ where: { questionId } });

      if (payload.media.length > 0) {
        await tx.battleQuestionMedia.createMany({
          data: payload.media.map((media, index) => ({
            questionId,
            type: media.type,
            url: media.url,
            durationSec: media.durationSec ?? null,
            mimeType: media.mimeType ?? null,
            orderIndex: media.orderIndex ?? index,
          })),
        });
      }
    }
  }

  private assertEditable(question: BattleQuestion) {
    if (
      question.status === QuestionStatus.APPROVED ||
      question.status === QuestionStatus.ARCHIVED
    ) {
      throw new ForbiddenException(
        'APPROVED or ARCHIVED question cannot be edited directly. Create a new version instead.',
      );
    }

    if (question.status === QuestionStatus.PENDING_REVIEW) {
      throw new ForbiddenException(
        'PENDING_REVIEW question cannot be edited. Reject it first or create a new draft.',
      );
    }
  }

  private async getQuestionOrThrow(questionId: string, includeLogs: boolean) {
    const question = await this.prisma.battleQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: true,
        media: true,
        reviewLogs: includeLogs
          ? {
              orderBy: { createdAt: 'desc' },
            }
          : false,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  private fullInclude() {
    return {
      options: true,
      media: true,
      reviewLogs: {
        orderBy: {
          createdAt: 'desc' as const,
        },
      },
    };
  }

  private computeContentHash(payload: unknown) {
    const stablePayload = JSON.stringify(payload, Object.keys(payload as object).sort());
    return createHash('sha256').update(stablePayload).digest('hex');
  }
}