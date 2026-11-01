import { Module } from '@nestjs/common';
import { SeasonConfigController } from './season-config.controller.js';
import { SeasonConfigService } from './season-config.service.js';

@Module({
  controllers: [SeasonConfigController],
  providers: [SeasonConfigService],
})
export class SeasonConfigModule {}