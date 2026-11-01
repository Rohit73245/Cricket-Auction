
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new player
  async create(data: {
    name: string;
    role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
    nationality: string;
    basePrice: number;
    photoUrl?: string;
    statistics?: Record<string, unknown>;
  }) {
    return this.prisma.player.create({
      data: {
        name: data.name,
        role: data.role,
        nationality: data.nationality,
        basePrice: data.basePrice,
        photoUrl: data.photoUrl,
        statistics: data.statistics as any,
      },
    });
  }

  // Get all players
  async findAll() {
    return this.prisma.player.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Get one player
  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return player;
  }

  // Save statistics for a particular player and season
  async saveSeasonStats(data: {
    playerId: string;
    season: string;
    sourceType: 'IPL' | 'DOMESTIC_T20';
    asOfDate?: string;
    statistics: Record<string, unknown>;
    sourceName?: string;
    sourceUrl?: string;
    verified?: boolean;
  }) {
    const player = await this.prisma.player.findUnique({
      where: { id: data.playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (!data.season?.trim()) {
      throw new BadRequestException('Season is required');
    }

    if (
      data.asOfDate &&
      Number.isNaN(Date.parse(data.asOfDate))
    ) {
      throw new BadRequestException('Invalid asOfDate');
    }

    return this.prisma.playerSeasonStats.upsert({
      where: {
        playerId_season_sourceType: {
          playerId: data.playerId,
          season: data.season,
          sourceType: data.sourceType,
        },
      },
      update: {
        asOfDate: data.asOfDate
          ? new Date(data.asOfDate)
          : null,
        statistics: data.statistics as any,
        sourceName: data.sourceName,
        sourceUrl: data.sourceUrl,
        verified: data.verified ?? false,
      },
      create: {
        playerId: data.playerId,
        season: data.season,
        sourceType: data.sourceType,
        asOfDate: data.asOfDate
          ? new Date(data.asOfDate)
          : null,
        statistics: data.statistics as any,
        sourceName: data.sourceName,
        sourceUrl: data.sourceUrl,
        verified: data.verified ?? false,
      },
    });
  }

  // Get statistics for a particular season
  async getSeasonStats(playerId: string, season: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const stats = await this.prisma.playerSeasonStats.findMany({
      where: {
        playerId,
        season,
      },
    });

    const iplStats = stats.find(
      (item) => item.sourceType === 'IPL',
    );

    const domesticStats = stats.find(
      (item) => item.sourceType === 'DOMESTIC_T20',
    );

    const selectedStats = iplStats || domesticStats;

    return {
      playerId,
      playerName: player.name,
      season,
      sourceType: selectedStats?.sourceType ?? null,
      asOfDate: selectedStats?.asOfDate ?? null,
      statistics: selectedStats?.statistics ?? null,
      sourceName: selectedStats?.sourceName ?? null,
      sourceUrl: selectedStats?.sourceUrl ?? null,
      verified: selectedStats?.verified ?? false,
      displayStatus: selectedStats ? 'AVAILABLE' : 'N/A',
    };
  }
}
