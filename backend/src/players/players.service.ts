
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

    if (data.asOfDate) {
      const parsedDate = new Date(`${data.asOfDate}T00:00:00.000Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== data.asOfDate
      ) {
        throw new BadRequestException(
          'asOfDate must be a valid YYYY-MM-DD date',
        );
      }
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
          ? new Date(`${data.asOfDate}T00:00:00.000Z`)
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
          ? new Date(`${data.asOfDate}T00:00:00.000Z`)
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

    const [records, config] = await Promise.all([
      this.prisma.playerSeasonStats.findMany({
        where: {
          playerId,
          season,
        },
      }),

      this.prisma.auctionSeasonConfig.findUnique({
        where: {
          leagueId_season: {
            leagueId: 'IPL',
            season,
          },
        },
      }),
    ]);

    const iplStats = records.find(
      (record) => record.sourceType === 'IPL',
    );

    const domesticStats = records.find(
      (record) => record.sourceType === 'DOMESTIC_T20',
    );

    // Check whether statistics fall within their source-specific cutoff.
    const isWithinCutoff = (
      record: (typeof records)[number] | undefined,
      cutoffDate: Date | undefined,
    ): boolean => {
      if (!record?.asOfDate || !cutoffDate) {
        return false;
      }

      const recordDate = record.asOfDate.toISOString().slice(0, 10);
      const cutoff = cutoffDate.toISOString().slice(0, 10);

      return recordDate <= cutoff;
    };

    const eligibleIplStats = isWithinCutoff(
      iplStats,
      config?.iplStatsCutoffDate,
    )
      ? iplStats
      : undefined;

    const eligibleDomesticStats = isWithinCutoff(
      domesticStats,
      config?.domesticStatsCutoffDate,
    )
      ? domesticStats
      : undefined;

    let selectedStats = null;
    let displayStatus: 'AVAILABLE' | 'DOMESTIC_T20' | 'N/A';

    // Case 1: Player has a confirmed IPL career.
    if (iplStats?.iplCareerExists === true) {
      if (eligibleIplStats?.verified) {
        selectedStats = eligibleIplStats;
        displayStatus = 'AVAILABLE';
      } else {
        displayStatus = 'N/A';
      }
    }

    // Case 2: Player has no IPL career.
    else if (iplStats?.iplCareerExists === false) {
      if (eligibleDomesticStats?.verified) {
        selectedStats = eligibleDomesticStats;
        displayStatus = 'DOMESTIC_T20';
      } else {
        displayStatus = 'N/A';
      }
    }

    // Case 3: IPL career information is missing.
    else {
      displayStatus = 'N/A';
    }

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
