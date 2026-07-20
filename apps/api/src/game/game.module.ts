import { Module } from '@nestjs/common';
import { QuestionModule } from '../question/question.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [QuestionModule],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
