import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateQuestionDto,
  ListQuestionsDto,
  RejectQuestionDto,
  UpdateQuestionDto,
} from './dto';
import { QuestionService } from './question.service';

@ApiTags('admin/questions')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/questions')
export class AdminQuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @ApiOperation({ summary: 'Admin create battle question draft' })
  createDraft(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionDto) {
    this.assertAdmin(user);
    return this.questionService.createDraft(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Admin list battle questions' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListQuestionsDto) {
    this.assertAdmin(user);
    return this.questionService.listQuestions(query);
  }

  @Get(':questionId')
  @ApiOperation({ summary: 'Admin get battle question detail' })
  @ApiParam({ name: 'questionId' })
  getDetail(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    this.assertAdmin(user);
    return this.questionService.getQuestion(questionId);
  }

  @Patch(':questionId')
  @ApiOperation({
    summary: 'Admin update editable question draft',
    description:
      'Only DRAFT or REJECTED question can be edited. APPROVED requires new version.',
  })
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    this.assertAdmin(user);
    return this.questionService.updateDraft(user.id, questionId, dto);
  }

  @Post(':questionId/validate')
  @ApiOperation({ summary: 'Validate question battle-readiness' })
  validate(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    this.assertAdmin(user);
    return this.questionService.validateQuestion(questionId);
  }

  @Post(':questionId/submit-review')
  @ApiOperation({ summary: 'Submit draft question for admin review' })
  submitReview(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
  ) {
    this.assertAdmin(user);
    return this.questionService.submitForReview(user.id, questionId);
  }

  @Post(':questionId/approve')
  @ApiOperation({ summary: 'Approve question for battle use' })
  approve(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    this.assertAdmin(user);
    return this.questionService.approveQuestion(user.id, questionId);
  }

  @Post(':questionId/reject')
  @ApiOperation({ summary: 'Reject question from review' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() dto: RejectQuestionDto,
  ) {
    this.assertAdmin(user);
    return this.questionService.rejectQuestion(user.id, questionId, dto.reason);
  }

  @Post(':questionId/archive')
  @ApiOperation({ summary: 'Archive question so it cannot be used in new battles' })
  archive(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    this.assertAdmin(user);
    return this.questionService.archiveQuestion(user.id, questionId);
  }

  @Post(':questionId/new-version')
  @ApiOperation({
    summary: 'Create new editable version from approved/archived question',
  })
  createNewVersion(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
  ) {
    this.assertAdmin(user);
    return this.questionService.createNewVersion(user.id, questionId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('ADMIN');

    if (!isAdmin) {
      throw new ForbiddenException('Admin role required');
    }
  }
}