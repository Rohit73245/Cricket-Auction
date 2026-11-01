import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class SeasonConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdate(data: {
    leagueId: string;
    season: string;
    iplStatsCutoffDate: string;
    domesticStatsCutoffDate: string;
  }) {
    const leagueId = data.leagueId?.trim();
    const season = data.season?.trim();

    if (!leagueId || !season) {
      throw new BadRequestException('leagueId and season are required.');
    }

    const iplCutoff = this.parseDate(
      data.iplStatsCutoffDate,
      'iplStatsCutoffDate',
    );

    const domesticCutoff = this.parseDate(
      data.domesticStatsCutoffDate,
      'domesticStatsCutoffDate',
    );

    if (domesticCutoff < iplCutoff) {
      throw new BadRequestException(
        'Domestic T20 cutoff must not be earlier than the IPL cutoff.',
      );
    }

    return this.prisma.auctionSeasonConfig.upsert({
      where: {
        leagueId_season: {
          leagueId,
          season,
        },
      },
      create: {
        leagueId,
        season,
        iplStatsCutoffDate: iplCutoff,
        domesticStatsCutoffDate: domesticCutoff,
      },
      update: {
        iplStatsCutoffDate: iplCutoff,
        domesticStatsCutoffDate: domesticCutoff,
      },
    });
  }

  async findOne(leagueId: string, season: string) {
    const config = await this.prisma.auctionSeasonConfig.findUnique({
      where: {
        leagueId_season: {
          leagueId,
          season,
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Season configuration not found.');
    }

    return config;
  }

  private parseDate(value: string, fieldName: string): Date {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `${fieldName} must use YYYY-MM-DD format.`,
      );
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`${fieldName} is not a valid date.`);
    }

    return date;
  }
}