import { Module } from '@nestjs/common';
import { AuctionsModule } from './auctions/auctions.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma.module.js';
import { PlayersModule } from './players/players.module.js';

@Module({
  imports: [PrismaModule, AuctionsModule, PlayersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
