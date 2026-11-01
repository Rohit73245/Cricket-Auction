
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';

import { PlayersService } from './players.service.js';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  create(@Body() body: {
    name: string;
    role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
    nationality: string;
    basePrice: number;
    photoUrl?: string;
    statistics?: Record<string, unknown>;
  }) {
    return this.playersService.create(body);
  }

  @Get()
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id/season-stats/:season')
  getSeasonStats(
    @Param('id') id: string,
    @Param('season') season: string,
  ) {
    return this.playersService.getSeasonStats(id, season);
  }

  @Post(':id/season-stats')
  saveSeasonStats(
    @Param('id') id: string,
    @Body() body: {
      season: string;
      sourceType: 'IPL' | 'DOMESTIC_T20';
      asOfDate?: string;
      statistics: Record<string, unknown>;
      sourceName?: string;
      sourceUrl?: string;
      verified?: boolean;
    },
  ) {
    return this.playersService.saveSeasonStats({
      ...body,
      playerId: id,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }
}
