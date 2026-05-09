import { Module } from '@nestjs/common';
import { AdminQuestionController } from './admin-question.controller';
import { QuestionService } from './question.service';

@Module({
  controllers: [AdminQuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}