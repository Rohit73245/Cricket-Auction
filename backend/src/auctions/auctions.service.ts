

import {

  Injectable,

  NotFoundException,

  BadRequestException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import { CreateAuctionDto } from './dto/create-auction.dto.js';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionsGateway } from './auctions.gateway.js';

@Injectable()

export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auctionsGateway: AuctionsGateway,
  ) {}

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

    const startedAuction = await this.prisma.$transaction(async (tx) => {

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

    this.auctionsGateway.emitAuctionStatus(id, {
      status: startedAuction.status,
      auction: startedAuction,
    });
    return startedAuction;

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

    const livePlayer = await this.prisma.$transaction(async (tx) => {

      await tx.$queryRaw`
       SELECT "id"
       FROM "Auction"
       WHERE "id" = ${id}
       FOR UPDATE
`       ;

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

      const biddingEndsAt = new Date(now.getTime() + 15_000);

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

    if (livePlayer) {
      this.auctionsGateway.emitPlayerLive(id, {
        player: livePlayer,
        biddingEndsAt: livePlayer.biddingEndsAt,
      });
    }
    return livePlayer;

  }

  // Restart the timer for the current LIVE player.

async restartBiddingTimer(auctionId: string) {

  const livePlayer = await this.prisma.$transaction(async (tx) => {

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

    const biddingEndsAt = new Date(now.getTime() + 15_000);

    return tx.auctionPlayer.update({

      where: { id: livePlayer.id },

      data: { biddingEndsAt },

      include: {

        player: true,

        team: true,

      },

    });

  });

  this.auctionsGateway.emitPlayerLive(auctionId, {
    player: livePlayer,
    biddingEndsAt: livePlayer.biddingEndsAt,
  });
  return livePlayer;

}

// Place a valid bid on the currently LIVE player.

async placeBid(

  auctionId: string,

  data: {

    teamId: string;

    amount: number;

  },

) {

  const result = await this.prisma.$transaction(async (tx) => {

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

    // Find the currently LIVE player.

    const initialLivePlayer = await tx.auctionPlayer.findFirst({

      where: {

        auctionId,

        status: 'LIVE',

      },

    });

    if (!initialLivePlayer) {

      throw new BadRequestException('There is no LIVE player.');

    }

    // Lock this AuctionPlayer row.

    // Concurrent bid transactions for this player must wait

    // until the previous transaction finishes.

    await tx.$queryRaw`

      SELECT "id"

      FROM "AuctionPlayer"

      WHERE "id" = ${initialLivePlayer.id}

      FOR UPDATE

    `;

    // Re-fetch the LIVE player after acquiring the lock.

    // This ensures we read the latest committed bidding state.

    const livePlayer = await tx.auctionPlayer.findFirst({

      where: {

        id: initialLivePlayer.id,

        auctionId,

        status: 'LIVE',

      },

      include: { player: true },

    });

    if (!livePlayer) {

      throw new BadRequestException(

        'The LIVE player is no longer available.',

      );

    }

    if (

      !livePlayer.biddingEndsAt ||

      livePlayer.biddingEndsAt <= new Date()

    ) {

      throw new BadRequestException(

        'The bidding timer has expired.',

      );

    }

    if (!Number.isFinite(data.amount) || data.amount <= 0) {

      throw new BadRequestException(

        'Enter a valid bid amount.',

      );

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

    // Find the latest valid bid after acquiring the lock.

    const previousBid = await tx.bid.findFirst({

      where: {

        auctionId,

        auctionPlayerId: livePlayer.id,

        status: 'VALID',

      },

      orderBy: [

        { createdAt: 'desc' },

        { id: 'desc' },

      ],

    });

    // Prevent the same team from bidding consecutively.

    if (previousBid && previousBid.teamId === team.id) {

      throw new BadRequestException(

        'Your team must wait for another team to place a valid bid.',

      );

    }

    // Determine the current bid amount.

    const currentBid = previousBid

      ? Number(previousBid.amount)

      : Number(

          livePlayer.basePrice ?? livePlayer.player.basePrice,

        );

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

    // Check whether the team has enough remaining purse.

    if (Number(team.remainingPurse) < data.amount) {

      throw new BadRequestException(

        'The team does not have enough remaining purse.',

      );

    }

    // Reset the timer only after a valid bid is accepted.

    const now = new Date();

    const biddingEndsAt = new Date(now.getTime() + 15_000);

    // Save the valid bid.

    const bid = await tx.bid.create({
      data: {
        auctionId,
        auctionPlayerId: livePlayer.id,
        teamId: team.id,
        amount: data.amount,
        status: 'VALID',
      },
      include: { team: true },
    });

    // Update the bidding timer.

    await tx.auctionPlayer.update({

      where: { id: livePlayer.id },

      data: { biddingEndsAt },

    });

    return {

      message: 'Bid placed successfully.',
      bid,
      player: livePlayer.player,
      biddingEndsAt,
    };

  });

  this.auctionsGateway.emitBid(auctionId, {
    amount: Number(result.bid.amount),
    team: result.bid.team,
    player: result.player,
    biddingEndsAt: result.biddingEndsAt,
  });
  return result;

}

// Sell the current LIVE player to the highest bidder.

async sellPlayer(auctionId: string) {

  const soldPlayer = await this.prisma.$transaction(async (tx) => {

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

    const initialLivePlayer = await tx.auctionPlayer.findFirst({

      where: {

        auctionId,

        status: 'LIVE',

      },

    });

    if (!initialLivePlayer) {

      throw new BadRequestException('There is no LIVE player to sell.');

    }

    // Lock the LIVE player row.

    // This uses the same lock as placeBid().

    await tx.$queryRaw`

      SELECT "id"

      FROM "AuctionPlayer"

      WHERE "id" = ${initialLivePlayer.id}

      FOR UPDATE

    `;

    // Re-fetch the player after acquiring the lock.

    const livePlayer = await tx.auctionPlayer.findFirst({

      where: {

        id: initialLivePlayer.id,

        auctionId,

        status: 'LIVE',

      },

      include: {

        player: true,

      },

    });

    if (!livePlayer) {

      throw new BadRequestException(

        'The player is no longer available for sale.',

      );

    }

    // Find the highest valid bid after acquiring the lock.

    const highestBid = await tx.bid.findFirst({

      where: {

        auctionId,

        auctionPlayerId: livePlayer.id,

        status: 'VALID',

      },

      orderBy: [

        { amount: 'desc' },

        { createdAt: 'asc' },

        { id: 'asc' },

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

    // Return the updated player and valid bid history.

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

          orderBy: [

            { createdAt: 'desc' },

            { id: 'desc' },

          ],

          include: {

            team: true,

          },

        },

      },

    });

  });

  if (soldPlayer?.team) {
    this.auctionsGateway.emitPlayerSold(auctionId, {
      player: soldPlayer.player,
      team: soldPlayer.team,
      soldPrice: soldPlayer.soldPrice,
    });
    this.auctionsGateway.emitTeamUpdated(auctionId, {
      teamName: soldPlayer.team.teamName,
      remainingPurse: soldPlayer.team.remainingPurse,
      team: soldPlayer.team,
    });
  }
  return soldPlayer;

}

// Mark the current LIVE player as UNSOLD.

async markPlayerUnsold(auctionId: string) {

  const unsoldPlayer = await this.prisma.$transaction(async (tx) => {

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

    const initialLivePlayer = await tx.auctionPlayer.findFirst({

      where: {

        auctionId,

        status: 'LIVE',

      },

    });

    if (!initialLivePlayer) {

      throw new BadRequestException('There is no LIVE player.');

    }

    // Lock the LIVE player row.

    // Uses the same lock as placeBid() and sellPlayer().

    await tx.$queryRaw`

      SELECT "id"

      FROM "AuctionPlayer"

      WHERE "id" = ${initialLivePlayer.id}

      FOR UPDATE

    `;

    // Re-fetch the player after acquiring the lock.

    const livePlayer = await tx.auctionPlayer.findFirst({

      where: {

        id: initialLivePlayer.id,

        auctionId,

        status: 'LIVE',

      },

    });

    if (!livePlayer) {

      throw new BadRequestException(

        'The player status changed. Please try again.',

      );

    }

    // Check for valid bids after acquiring the lock.

    const validBid = await tx.bid.findFirst({

      where: {

        auctionId,

        auctionPlayerId: livePlayer.id,

        status: 'VALID',

      },

    });

    // A player with a valid bid must be sold.

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

    // Return updated player information.

    return tx.auctionPlayer.findUnique({

      where: {

        id: livePlayer.id,

      },

      include: {

        player: true,

        team: true,

        bids: {

          orderBy: [

            { createdAt: 'desc' },

            { id: 'desc' },

          ],

          include: {

            team: true,

          },

        },

      },

    });

  });

  if (unsoldPlayer) {
    this.auctionsGateway.emitPlayerUnsold(auctionId, {
      player: unsoldPlayer,
    });
  }
  return unsoldPlayer;

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


  // Automatically settle LIVE players when their bidding timer expires.

  // Automatically settle expired players and activate the next queued player.
  @Cron(CronExpression.EVERY_SECOND)
  async processExpiredBiddingTimers(): Promise<void> {
    const now = new Date();

    const expiredPlayers = await this.prisma.auctionPlayer.findMany({
      where: {
        status: 'LIVE',
        biddingEndsAt: {
          lte: now,
        },
        auction: {
          status: 'ACTIVE',
        },
      },
      select: {
        id: true,
        auctionId: true,
      },
    });

    for (const candidate of expiredPlayers) {
      try {
        const outcome = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Auction"
            WHERE "id" = ${candidate.auctionId}
            FOR UPDATE
          `;

          const auction = await tx.auction.findUnique({
            where: { id: candidate.auctionId },
            select: { status: true },
          });
          if (!auction || auction.status !== 'ACTIVE') {
            return null;
          }

          await tx.$queryRaw`
            SELECT "id"
            FROM "AuctionPlayer"
            WHERE "id" = ${candidate.id}
            FOR UPDATE
          `;

          const livePlayer = await tx.auctionPlayer.findFirst({
            where: {
              id: candidate.id,
              auctionId: candidate.auctionId,
              status: 'LIVE',
              biddingEndsAt: { lte: new Date() },
            },
          });
          if (!livePlayer) {
            return null;
          }

          const highestBid = await tx.bid.findFirst({
            where: {
              auctionId: candidate.auctionId,
              auctionPlayerId: livePlayer.id,
              status: 'VALID',
            },
            orderBy: [
              { amount: 'desc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          });

          let winningTeam = null;
          if (!highestBid) {
            const unsoldUpdate = await tx.auctionPlayer.updateMany({
              where: {
                id: livePlayer.id,
                auctionId: candidate.auctionId,
                status: 'LIVE',
              },
              data: {
                status: 'UNSOLD',
                teamId: null,
                soldPrice: null,
              },
            });
            if (unsoldUpdate.count !== 1) {
              throw new BadRequestException(
                'Could not automatically mark the expired player as UNSOLD.',
              );
            }
          } else {
            const purseUpdate = await tx.auctionTeam.updateMany({
              where: {
                id: highestBid.teamId,
                auctionId: candidate.auctionId,
                remainingPurse: { gte: highestBid.amount },
              },
              data: { remainingPurse: { decrement: highestBid.amount } },
            });
            if (purseUpdate.count !== 1) {
              throw new BadRequestException(
                'The winning team does not have enough remaining purse.',
              );
            }

            const soldUpdate = await tx.auctionPlayer.updateMany({
              where: {
                id: livePlayer.id,
                auctionId: candidate.auctionId,
                status: 'LIVE',
              },
              data: {
                status: 'SOLD',
                teamId: highestBid.teamId,
                soldPrice: highestBid.amount,
              },
            });
            if (soldUpdate.count !== 1) {
              throw new BadRequestException(
                'Could not automatically sell the expired player.',
              );
            }

            winningTeam = await tx.auctionTeam.findUnique({
              where: { id: highestBid.teamId },
            });
          }

          const settledPlayer = await tx.auctionPlayer.findUnique({
            where: { id: livePlayer.id },
            include: { player: true, team: true },
          });
          if (!settledPlayer) {
            throw new BadRequestException(
              'Could not load the automatically settled player.',
            );
          }

          const existingLivePlayer = await tx.auctionPlayer.findFirst({
            where: {
              auctionId: candidate.auctionId,
              status: 'LIVE',
            },
          });
          if (existingLivePlayer) {
            return {
              settledPlayer,
              winningTeam,
              nextPlayer: null,
              auctionCompleted: false,
            };
          }

          const nextPlayer = await tx.auctionPlayer.findFirst({
            where: {
              auctionId: candidate.auctionId,
              status: 'QUEUED',
            },
            orderBy: { queueOrder: 'asc' },
          });

          if (!nextPlayer) {
            const remainingPlayers = await tx.auctionPlayer.count({
              where: {
                auctionId: candidate.auctionId,
                status: { in: ['QUEUED', 'LIVE'] },
              },
            });
            const completion =
              remainingPlayers === 0
                ? await tx.auction.updateMany({
                    where: {
                      id: candidate.auctionId,
                      status: 'ACTIVE',
                    },
                    data: { status: 'COMPLETED' },
                  })
                : { count: 0 };

            return {
              settledPlayer,
              winningTeam,
              nextPlayer: null,
              auctionCompleted: completion.count === 1,
            };
          }

          const nextStartTime = new Date();
          const nextEndTime = new Date(nextStartTime.getTime() + 15_000);
          const nextPlayerUpdate = await tx.auctionPlayer.updateMany({
            where: {
              id: nextPlayer.id,
              auctionId: candidate.auctionId,
              status: 'QUEUED',
            },
            data: {
              status: 'LIVE',
              biddingStartedAt: nextStartTime,
              biddingEndsAt: nextEndTime,
            },
          });
          if (nextPlayerUpdate.count !== 1) {
            throw new BadRequestException(
              'Could not automatically start the next queued player.',
            );
          }

          const activatedPlayer = await tx.auctionPlayer.findUnique({
            where: { id: nextPlayer.id },
            include: { player: true, team: true },
          });

          return {
            settledPlayer,
            winningTeam,
            nextPlayer: activatedPlayer,
            auctionCompleted: false,
          };
        });

        if (!outcome) {
          continue;
        }

        if (outcome.settledPlayer.status === 'SOLD' && outcome.winningTeam) {
          this.auctionsGateway.emitPlayerSold(candidate.auctionId, {
            player: outcome.settledPlayer.player,
            team: outcome.winningTeam,
            soldPrice: outcome.settledPlayer.soldPrice,
          });
          this.auctionsGateway.emitTeamUpdated(candidate.auctionId, {
            teamName: outcome.winningTeam.teamName,
            remainingPurse: outcome.winningTeam.remainingPurse,
            team: outcome.winningTeam,
          });
        } else {
          this.auctionsGateway.emitPlayerUnsold(candidate.auctionId, {
            player: outcome.settledPlayer,
          });
        }

        if (outcome.nextPlayer) {
          this.auctionsGateway.emitPlayerLive(candidate.auctionId, {
            player: outcome.nextPlayer,
            biddingEndsAt: outcome.nextPlayer.biddingEndsAt,
          });
        }

        if (outcome.auctionCompleted) {
          this.auctionsGateway.emitAuctionStatus(candidate.auctionId, {
            status: 'COMPLETED',
            auction: {
              id: candidate.auctionId,
              status: 'COMPLETED',
            },
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.stack ?? error.message
            : String(error);

        this.logger.error(
          `Automatic expiry failed for auction player ${candidate.id}: ${message}`,
        );
      }
    }
  }


}
