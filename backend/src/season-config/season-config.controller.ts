import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { SeasonConfigService } from './season-config.service.js';

@Controller('api/v1/season-config')
export class SeasonConfigController {
  constructor(private readonly seasonConfigService: SeasonConfigService) {}

  @Post()
  createOrUpdate(
    @Body()
    body: {
      leagueId: string;
      season: string;
      iplStatsCutoffDate: string;
      domesticStatsCutoffDate: string;
    },
  ) {
    return this.seasonConfigService.createOrUpdate(body);
  }

  @Get(':leagueId/:season')
  findOne(
    @Param('leagueId') leagueId: string,
    @Param('season') season: string,
  ) {
    return this.seasonConfigService.findOne(leagueId, season);
  }
}