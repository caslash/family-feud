import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionEntity } from '@family-feud/types/entities';
import { QuestionService } from './question.service';

/**
 * Owns read-only access to the PostgreSQL question store. Exports
 * {@link QuestionService} so the game/gateway layer can pull questions before
 * feeding them into the machine.
 */
@Module({
  imports: [TypeOrmModule.forFeature([QuestionEntity])],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}
