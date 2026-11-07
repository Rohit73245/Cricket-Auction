import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuctionsModule } from './auctions/auctions.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma.module.js';
import { PlayersModule } from './players/players.module.js';
import { SeasonConfigModule } from './season-config/season-config.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuctionsModule,
    PlayersModule,
    SeasonConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}