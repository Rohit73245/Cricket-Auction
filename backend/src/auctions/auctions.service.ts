
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

  // Get all auctions.
  findAll() {
    return this.prisma.auction.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get one auction with its attached league rules.
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

    if (auction.status !== 'DRAFT') {
      throw new BadRequestException(
        'Teams can only be selected before the auction starts.',
      );
    }

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

    if (auction.status !== 'DRAFT') {
      throw new BadRequestException(
        'Rules can only be attached before the auction starts.',
      );
    }

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

  // Start an auction and initialize its teams safely.
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

    return this.prisma.$transaction(async (tx) => {
      // Recheck auction status inside the transaction.
      const currentAuction = await tx.auction.findUnique({
        where: { id },
      });

      if (!currentAuction) {
        throw new NotFoundException('Auction not found.');
      }

      if (currentAuction.status !== 'DRAFT') {
        throw new BadRequestException(
          'Only draft auctions can be started.',
        );
      }

      // Initialize teams for Existing League auctions.
      if (currentAuction.mode === 'EXISTING_LEAGUE') {
        const selectedTeams =
          currentAuction.selectedTeams as string[];

        const existingTeams = await tx.auctionTeam.findMany({
          where: { auctionId: id },
        });

        if (existingTeams.length === 0) {
          const rules = await tx.leagueRules.findUnique({
            where: { id: currentAuction.leagueRulesId! },
          });

          if (!rules || !rules.verified) {
            throw new BadRequestException(
              'Verified league rules are required to initialize teams.',
            );
          }

          await tx.auctionTeam.createMany({
            data: selectedTeams.map((teamCode) => ({
              auctionId: id,
              teamCode,
              teamName: teamCode,
              totalPurse: rules.teamPurse,
              remainingPurse: rules.teamPurse,
            })),
          });
        } else {
          const existingCodes = existingTeams
            .map((team) => team.teamCode)
            .sort();

          const selectedCodes = [...selectedTeams].sort();

          if (
            existingTeams.length !== selectedTeams.length ||
            existingCodes.some(
              (code, index) => code !== selectedCodes[index],
            )
          ) {
            throw new BadRequestException(
              'Team initialization is incomplete or does not match the selected teams.',
            );
          }
        }
      }

      // Activate only after team initialization succeeds.
      return tx.auction.update({
        where: {
          id,
          status: 'DRAFT',
        },
        data: {
          status: 'ACTIVE',
        },
        include: {
          leagueRules: true,
          auctionTeams: true,
        },
      });
    });
  }

  // Initialize participating teams and their purses manually if needed.
  async initializeTeams(id: string) {
    const auction = await this.findOne(id);

    if (auction.status !== 'DRAFT') {
      throw new BadRequestException(
        'Teams can only be initialized before the auction starts.',
      );
    }

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

    // Players can only be added before the auction starts.
    if (auction.status !== 'DRAFT') {
      throw new BadRequestException(
        'Players can only be added before the auction starts.',
      );
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
  

  // Start bidding on the next queued player.
  async startBidding(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found.');
      }

      if (auction.status !== 'ACTIVE') {
        throw new BadRequestException(
          'The auction must be ACTIVE before bidding can start.',
        );
      }

      const livePlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId: id,
          status: 'LIVE',
        },
      });

      if (livePlayer) {
        throw new BadRequestException(
          'A player is already LIVE. Finish the current bidding first.',
        );
      }

      const nextPlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId: id,
          status: 'QUEUED',
        },
        orderBy: {
          queueOrder: 'asc',
        },
      });

      if (!nextPlayer) {
        throw new BadRequestException(
          'There are no queued players remaining.',
        );
      }

      const now = new Date();
      const biddingEndsAt = new Date(now.getTime() + 120_000);

      const updated = await tx.auctionPlayer.updateMany({
        where: {
          id: nextPlayer.id,
          status: 'QUEUED',
        },
        data: {
          status: 'LIVE',
          biddingStartedAt: now,
          biddingEndsAt,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'The player bidding state changed. Please try again.',
        );
      }

      return tx.auctionPlayer.findUnique({
        where: {
          id: nextPlayer.id,
        },
        include: {
          player: true,
          team: true,
        },
      });
    });
  }

  // Restart the timer for the current LIVE player.
async restartBiddingTimer(auctionId: string) {
  return this.prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found.');
    }

    if (auction.status !== 'ACTIVE') {
      throw new BadRequestException('Auction is not active.');
    }

    const livePlayer = await tx.auctionPlayer.findFirst({
      where: {
        auctionId,
        status: 'LIVE',
      },
    });

    if (!livePlayer) {
      throw new BadRequestException('There is no LIVE player.');
    }

    const now = new Date();
    const biddingEndsAt = new Date(now.getTime() + 120_000);

    return tx.auctionPlayer.update({
      where: { id: livePlayer.id },
      data: { biddingEndsAt },
      include: {
        player: true,
        team: true,
      },
    });
  });
}

  

  

    // Place a valid bid on the currently LIVE player.
  async placeBid(
    auctionId: string,
    data: {
      teamId: string;
      amount: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: { leagueRules: true },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found.');
      }

      if (auction.status !== 'ACTIVE') {
        throw new BadRequestException('Auction is not active.');
      }

      const livePlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId,
          status: 'LIVE',
        },
        include: { player: true },
      });

      if (!livePlayer) {
        throw new BadRequestException('There is no LIVE player.');
      }

      if (
        !livePlayer.biddingEndsAt ||
        livePlayer.biddingEndsAt <= new Date()
      ) {
        throw new BadRequestException('The bidding timer has expired.');
      }

      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new BadRequestException('Enter a valid bid amount.');
      }

      const team = await tx.auctionTeam.findFirst({
        where: {
          id: data.teamId,
          auctionId,
        },
      });

      if (!team) {
        throw new NotFoundException(
          'Team not found in this auction.',
        );
      }

      const previousBid = await tx.bid.findFirst({
        where: {
          auctionId,
          auctionPlayerId: livePlayer.id,
          status: 'VALID',
        },
        orderBy: { amount: 'desc' },
      });

      const currentBid = previousBid
        ? Number(previousBid.amount)
        : Number(livePlayer.basePrice ?? livePlayer.player.basePrice);

      const config = auction.leagueRules?.bidIncrements as {
        tiers?: {
          upTo: number;
          increment: number;
        }[];
        aboveLastTier?: {
          mode: string;
          minimumIncrement: number;
        };
      } | null;

      if (!config) {
        throw new BadRequestException(
          'Bidding increments are not configured for this league.',
        );
      }

      let minimumBid: number;

      if (!previousBid) {
        minimumBid = currentBid;
      } else {
        const tier = config.tiers?.find(
          (item) => currentBid <= item.upTo,
        );

        if (tier) {
          minimumBid = currentBid + tier.increment;
        } else if (
          config.aboveLastTier?.mode === 'AUCTIONEER_DISCRETION'
        ) {
          minimumBid =
            currentBid + config.aboveLastTier.minimumIncrement;
        } else {
          throw new BadRequestException(
            'No bidding increment is configured for this bid amount.',
          );
        }
      }

      if (data.amount < minimumBid) {
        throw new BadRequestException(
          `The minimum next bid is ${minimumBid}.`,
        );
      }

      if (
        previousBid &&
        config.aboveLastTier?.mode !== 'AUCTIONEER_DISCRETION'
      ) {
        const tier = config.tiers?.find(
          (item) => currentBid <= item.upTo,
        );

        if (
          tier &&
          (data.amount - currentBid) % tier.increment !== 0
        ) {
          throw new BadRequestException(
            `The bid must increase in increments of ${tier.increment}.`,
          );
        }
      }

      if (Number(team.remainingPurse) < data.amount) {
        throw new BadRequestException(
          'The team does not have enough remaining purse.',
        );
      }

      const now = new Date();
      const biddingEndsAt = new Date(now.getTime() + 15_000);

      const bid = await tx.bid.create({
        data: {
          auctionId,
          auctionPlayerId: livePlayer.id,
          teamId: team.id,
          amount: data.amount,
          status: 'VALID',
        },
      });

      await tx.auctionPlayer.update({
        where: { id: livePlayer.id },
        data: { biddingEndsAt },
      });

      return {
        message: 'Bid placed successfully.',
        bid,
        biddingEndsAt,
      };
    });
  }


  // Sell the current LIVE player to the highest bidder.
  async sellPlayer(auctionId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check auction.
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found.');
      }

      if (auction.status !== 'ACTIVE') {
        throw new BadRequestException('Auction is not active.');
      }

      // Find the current LIVE player.
      const livePlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId,
          status: 'LIVE',
        },
        include: {
          player: true,
        },
      });

      if (!livePlayer) {
        throw new BadRequestException('There is no LIVE player to sell.');
      }

      // Find the highest valid bid.
      const highestBid = await tx.bid.findFirst({
        where: {
          auctionId,
          auctionPlayerId: livePlayer.id,
          status: 'VALID',
        },
        orderBy: [
          { amount: 'desc' },
          { createdAt: 'asc' },
        ],
        include: {
          team: true,
        },
      });

      if (!highestBid) {
        throw new BadRequestException(
          'No valid bids found. The player cannot be sold.',
        );
      }

      // Deduct the winning bid from the team's purse.
      const purseUpdate = await tx.auctionTeam.updateMany({
        where: {
          id: highestBid.teamId,
          auctionId,
          remainingPurse: {
            gte: highestBid.amount,
          },
        },
        data: {
          remainingPurse: {
            decrement: highestBid.amount,
          },
        },
      });

      if (purseUpdate.count !== 1) {
        throw new BadRequestException(
          'The winning team does not have enough remaining purse.',
        );
      }

      // Mark the player as SOLD.
      const playerUpdate = await tx.auctionPlayer.updateMany({
        where: {
          id: livePlayer.id,
          auctionId,
          status: 'LIVE',
        },
        data: {
          status: 'SOLD',
          teamId: highestBid.teamId,
          soldPrice: highestBid.amount,
        },
      });

      if (playerUpdate.count !== 1) {
        throw new BadRequestException(
          'The player is no longer available for sale.',
        );
      }

      return tx.auctionPlayer.findUnique({
        where: {
          id: livePlayer.id,
        },
        include: {
          player: true,
          team: true,
          bids: {
            where: {
              status: 'VALID',
            },
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              team: true,
            },
          },
        },
      });
    });
  } // IMPORTANT: sellPlayer ends here.

  // Mark the current LIVE player as UNSOLD.
  async markPlayerUnsold(auctionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found.');
      }

      if (auction.status !== 'ACTIVE') {
        throw new BadRequestException('Auction is not active.');
      }

      const livePlayer = await tx.auctionPlayer.findFirst({
        where: {
          auctionId,
          status: 'LIVE',
        },
      });

      if (!livePlayer) {
        throw new BadRequestException('There is no LIVE player.');
      }

      // A player with a valid bid must be sold to the highest bidder.
      const validBid = await tx.bid.findFirst({
        where: {
          auctionId,
          auctionPlayerId: livePlayer.id,
          status: 'VALID',
        },
      });

      if (validBid) {
        throw new BadRequestException(
          'This player has a valid bid. Sell the player to the highest bidder instead.',
        );
      }

      // Change LIVE to UNSOLD.
      const updated = await tx.auctionPlayer.updateMany({
        where: {
          id: livePlayer.id,
          auctionId,
          status: 'LIVE',
        },
        data: {
          status: 'UNSOLD',
          teamId: null,
          soldPrice: null,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'The player status changed. Please try again.',
        );
      }

      return tx.auctionPlayer.findUnique({
        where: {
          id: livePlayer.id,
        },
        include: {
          player: true,
          team: true,
          bids: {
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              team: true,
            },
          },
        },
      });
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
        bids: {
          where: {
            status: 'VALID',
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            team: true,
          },
        },
      },
      orderBy: {
        queueOrder: 'asc',
      },
    });
  }

  // Get participating teams and their purse details.
  async getAuctionTeams(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found.');
    }

    return this.prisma.auctionTeam.findMany({
      where: {
        auctionId: id,
      },
      orderBy: {
        teamCode: 'asc',
      },
    });
  }
}


