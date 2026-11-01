
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll() {
    return this.prisma.player.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    return player;
  }

  async saveSeasonStats(data: {
    playerId: string;
    season: string;
    sourceType: 'IPL' | 'DOMESTIC_T20';
    asOfDate?: string;
    statistics: Record<string, unknown>;
    sourceName?: string;
    sourceUrl?: string;
    verified?: boolean;
    iplCareerExists?: boolean;
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

    if (
      data.sourceType === 'DOMESTIC_T20' &&
      data.iplCareerExists === true
    ) {
      throw new BadRequestException(
        'Domestic T20 fallback is only for players with no IPL career',
      );
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
        iplCareerExists:
          data.sourceType === 'IPL'
            ? data.iplCareerExists ?? null
            : null,
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
        iplCareerExists:
          data.sourceType === 'IPL'
            ? data.iplCareerExists ?? null
            : null,
      },
    });
  }

  async getSeasonStats(playerId: string, season: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const records = await this.prisma.playerSeasonStats.findMany({
      where: {
        playerId,
        season,
      },
    });

    const iplStats = records.find(
      (record) => record.sourceType === 'IPL',
    );

    const domesticStats = records.find(
      (record) => record.sourceType === 'DOMESTIC_T20',
    );

    let selectedStats = null;
    let displayStatus = 'N/A';

    // Priority 1: Player has no IPL career.
    // Use domestic T20 statistics instead.
    if (iplStats?.iplCareerExists === false) {
      if (domesticStats?.verified) {
        selectedStats = domesticStats;
        displayStatus = 'DOMESTIC_T20';
      } else if (domesticStats) {
        selectedStats = domesticStats;
        displayStatus = 'UNVERIFIED';
      }
    }

    // Priority 2: Player has an IPL career.
    // Use IPL statistics only.
    else if (iplStats?.iplCareerExists === true) {
      if (iplStats.verified) {
        selectedStats = iplStats;
        displayStatus = 'AVAILABLE';
      } else {
        selectedStats = iplStats;
        displayStatus = 'UNVERIFIED';
      }
    }

    // Priority 3: IPL career information is missing.
    // Do not assume domestic fallback is allowed.

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
      displayStatus,
    };
  }
}
