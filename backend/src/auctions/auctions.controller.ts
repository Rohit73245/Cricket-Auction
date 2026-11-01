import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { AuctionsService } from './auctions.service.js';
import { CreateAuctionDto } from './dto/create-auction.dto.js';

@Controller('api/v1/auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  // Create a new auction draft.
  @Post()
  create(@Body() dto: CreateAuctionDto) {
    return this.auctionsService.create(dto);
  }

  // Get all auction drafts.
  @Get()
  findAll() {
    return this.auctionsService.findAll();
  }

  // Get one auction with its rules.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionsService.findOne(id);
  }

  // Save participating teams.
  @Patch(':id/league-selection')
  updateLeagueSelection(
    @Param('id') id: string,
    @Body()
    body: {
      leagueId: string;
      season: string;
      selectedTeams: string[];
    },
  ) {
    return this.auctionsService.updateLeagueSelection(id, body);
  }

  // Attach verified league rules.
  @Post(':id/attach-league-rules')
  attachLeagueRules(@Param('id') id: string) {
    return this.auctionsService.attachLeagueRules(id);
  }

  // Start auction after backend validation.
  @Post(':id/start')
  startAuction(@Param('id') id: string) {
    return this.auctionsService.startAuction(id);
  }

  // Initialize participating teams and their purses.
  @Post(':id/initialize-teams')
  initializeTeams(@Param('id') id: string) {
    return this.auctionsService.initializeTeams(id);
  }

  // Add a player to the auction queue.
  @Post(':id/players')
  addPlayerToAuction(
    @Param('id') id: string,
    @Body() body: { playerId: string },
  ) {
    return this.auctionsService.addPlayerToAuction(
      id,
      body.playerId,
    );
  }

  // Get auction players in queue order.
  @Get(':id/players')
  getAuctionPlayers(@Param('id') id: string) {
    return this.auctionsService.getAuctionPlayers(id);
  }
}