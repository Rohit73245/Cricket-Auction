import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new auction draft.
  // Automatically attach verified rules for Existing League auctions.
  async create(dto: CreateAuctionDto) {
    if (dto.mode === 'CUSTOM') {
      return this.prisma.auction.create({
        data: {
          name: dto.name.trim(),
          mode: dto.mode,
          visibility: dto.visibility,
        },
      });
    }

    const rules = await this.prisma.leagueRules.findUnique({
      where: {
        leagueId: dto.leagueId!,
      },
    });

    return this.prisma.auction.create({
      data: {
        name: dto.name.trim(),
        mode: dto.mode,
        visibility: dto.visibility,
        leagueId: dto.leagueId,
        season: dto.season,
        ...(rules?.verified
          ? { leagueRulesId: rules.id }
          : {}),
      },
      include: {
        leagueRules: true,
      },
    });
  }

  // Get all auction drafts.
  findAll() {
    return this.prisma.auction.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get one auction draft with its attached league rules.
  async findOne(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        leagueRules: true,
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    return auction;
  }

  // Save participating teams without allowing league or season changes.
  async updateLeagueSelection(
    id: string,
    data: {
      leagueId: string;
      season: string;
      selectedTeams: string[];
    },
  ) {
    const auction = await this.findOne(id);

    if (auction.mode !== 'EXISTING_LEAGUE') {
      throw new BadRequestException(
        'League selection is only available for Existing League auctions.',
      );
    }

    if (!auction.leagueId || !auction.season) {
      throw new BadRequestException(
        'League and season must be selected when creating the auction.',
      );
    }

    if (
      data.leagueId !== auction.leagueId ||
      data.season !== auction.season
    ) {
      throw new BadRequestException(
        'League and season cannot be changed after auction creation.',
      );
    }

    if (
      !Array.isArray(data.selectedTeams) ||
      data.selectedTeams.length < 2
    ) {
      throw new BadRequestException(
        'Please select at least two participating teams.',
      );
    }

    if (
      new Set(data.selectedTeams).size !== data.selectedTeams.length
    ) {
      throw new BadRequestException(
        'Duplicate teams are not allowed.',
      );
    }

    return this.prisma.auction.update({
      where: { id },
      data: {
        selectedTeams: data.selectedTeams,
      },
      include: {
        leagueRules: true,
      },
    });
  }

  // Attach verified official rules to an Existing League auction.
  async attachLeagueRules(id: string) {
    const auction = await this.findOne(id);

    if (auction.mode !== 'EXISTING_LEAGUE') {
      throw new BadRequestException(
        'League rules are only available for Existing League auctions.',
      );
    }

    if (!auction.leagueId) {
      throw new BadRequestException(
        'Please complete league selection first.',
      );
    }

    const rules = await this.prisma.leagueRules.findUnique({
      where: {
        leagueId: auction.leagueId,
      },
    });

    if (!rules || !rules.verified) {
      throw new NotFoundException(
        'Verified rules are not available for this league yet.',
      );
    }

    return this.prisma.auction.update({
      where: { id },
      data: {
        leagueRulesId: rules.id,
      },
      include: {
        leagueRules: true,
      },
    });
  }

  // Start an auction only after all required checks pass.
  async startAuction(id: string) {
    const auction = await this.findOne(id);

    if (auction.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft auctions can be started.',
      );
    }

    if (auction.mode === 'EXISTING_LEAGUE') {
      if (!auction.leagueId || !auction.season) {
        throw new BadRequestException(
          'League and season selection is incomplete.',
        );
      }

      if (
        !auction.leagueRules ||
        !auction.leagueRules.verified ||
        auction.leagueRules.leagueId !== auction.leagueId
      ) {
        throw new BadRequestException(
          'Verified official league rules must be attached before starting the auction.',
        );
      }
    }

    if (
      !Array.isArray(auction.selectedTeams) ||
      auction.selectedTeams.length < 2
    ) {
      throw new BadRequestException(
        'At least two participating teams must be selected before starting.',
      );
    }

    return this.prisma.auction.update({
      where: {
        id,
        status: 'DRAFT',
      },
      data: {
        status: 'ACTIVE',
      },
      include: {
        leagueRules: true,
      },
    });
  }

  // Initialize participating teams and their purses.
  // Safe to call for an already ACTIVE auction.
  async initializeTeams(id: string) {
    const auction = await this.findOne(id);

    if (auction.mode !== 'EXISTING_LEAGUE') {
      throw new BadRequestException(
        'This initialization method is only for Existing League auctions.',
      );
    }

    if (
      !auction.leagueRules ||
      !auction.leagueRules.verified ||
      auction.leagueRules.leagueId !== auction.leagueId
    ) {
      throw new BadRequestException(
        'Verified league rules must be attached.',
      );
    }

    if (
      !Array.isArray(auction.selectedTeams) ||
      auction.selectedTeams.length < 2
    ) {
      throw new BadRequestException(
        'At least two teams must be selected.',
      );
    }

    const existingTeams = await this.prisma.auctionTeam.findMany({
      where: { auctionId: id },
    });

    if (existingTeams.length > 0) {
      throw new BadRequestException(
        'Auction teams have already been initialized.',
      );
    }

    const purse = auction.leagueRules.teamPurse;

    await this.prisma.auctionTeam.createMany({
      data: (auction.selectedTeams as string[]).map((teamCode) => ({
        auctionId: id,
        teamCode,
        teamName: teamCode,
        totalPurse: purse,
        remainingPurse: purse,
      })),
    });

    return this.prisma.auctionTeam.findMany({
      where: { auctionId: id },
      orderBy: { teamCode: 'asc' },
    });
  }

  // Add an existing player to an auction queue.
  async addPlayerToAuction(id: string, playerId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const existingPlayer =
      await this.prisma.auctionPlayer.findUnique({
        where: {
          auctionId_playerId: {
            auctionId: id,
            playerId,
          },
        },
      });

    if (existingPlayer) {
      throw new BadRequestException(
        'Player is already added to this auction.',
      );
    }

    const lastPlayer =
      await this.prisma.auctionPlayer.aggregate({
        where: { auctionId: id },
        _max: {
          queueOrder: true,
        },
      });

    const nextQueueOrder =
      (lastPlayer._max.queueOrder ?? 0) + 1;

    return this.prisma.auctionPlayer.create({
      data: {
        auctionId: id,
        playerId,
        queueOrder: nextQueueOrder,
        status: 'QUEUED',
      },
      include: {
        player: true,
      },
    });
  }

  // Get all players in an auction, ordered by queue position.
  async getAuctionPlayers(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    return this.prisma.auctionPlayer.findMany({
      where: {
        auctionId: id,
      },
      include: {
        player: true,
        team: true,
      },
      orderBy: {
        queueOrder: 'asc',
      },
    });
  }
}