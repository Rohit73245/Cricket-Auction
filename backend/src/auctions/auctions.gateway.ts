import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service.js';

@WebSocketGateway({
  cors: {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  },
})
export class AuctionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(_client: Socket): void {}

  handleDisconnect(_client: Socket): void {}

  @SubscribeMessage('auction:join')
  async joinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId?: unknown },
  ): Promise<void> {
    const auctionId = payload?.auctionId;
    if (typeof auctionId !== 'string' || auctionId.length === 0) {
      client.emit('auction:error', { message: 'A valid auction ID is required.' });
      return;
    }

    const auctionExists = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true },
    });
    if (!auctionExists) {
      client.emit('auction:error', { message: 'Auction not found.' });
      return;
    }

    await client.join(this.roomName(auctionId));
    await this.emitAuctionState(auctionId, client.id);
  }

  @SubscribeMessage('auction:leave')
  async leaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId?: unknown },
  ): Promise<void> {
    if (typeof payload?.auctionId === 'string') {
      await client.leave(this.roomName(payload.auctionId));
    }
  }

  async emitAuctionState(auctionId: string, clientId?: string): Promise<void> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        leagueRules: true,
        auctionTeams: { orderBy: { teamCode: 'asc' } },
        auctionPlayers: {
          orderBy: { queueOrder: 'asc' },
          include: {
            player: true,
            team: true,
            bids: {
              where: { status: 'VALID' },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              include: { team: true },
            },
          },
        },
      },
    });

    if (!auction) {
      return;
    }

    const currentPlayer =
      auction.auctionPlayers.find((player) => player.status === 'LIVE') ?? null;
    const target = clientId ?? this.roomName(auctionId);

    this.server.to(target).emit('auction:state', {
      auction: {
        id: auction.id,
        name: auction.name,
        status: auction.status,
        mode: auction.mode,
        visibility: auction.visibility,
        leagueId: auction.leagueId,
        season: auction.season,
      },
      currentPlayer,
      biddingEndsAt: currentPlayer?.biddingEndsAt ?? null,
      players: auction.auctionPlayers,
      teams: auction.auctionTeams,
    });
  }

  emitAuctionStatus(
    auctionId: string,
    payload: { status: string; auction?: object },
  ): void {
    this.broadcast(auctionId, 'auction:status', payload);
  }

  emitBid(
    auctionId: string,
    payload: {
      amount: number;
      team: object;
      player: object;
      biddingEndsAt: Date;
    },
  ): void {
    this.broadcast(auctionId, 'auction:bid', payload);
  }

  emitPlayerLive(
    auctionId: string,
    payload: { player: object; biddingEndsAt: Date | null },
  ): void {
    this.broadcast(auctionId, 'auction:player-live', payload);
  }

  emitPlayerSold(
    auctionId: string,
    payload: {
      player: object;
      team: object;
      soldPrice: unknown;
    },
  ): void {
    this.broadcast(auctionId, 'auction:player-sold', payload);
  }

  emitPlayerUnsold(auctionId: string, payload: { player: object }): void {
    this.broadcast(auctionId, 'auction:player-unsold', payload);
  }

  emitTeamUpdated(
    auctionId: string,
    payload: {
      teamName: string;
      remainingPurse: unknown;
      team?: object;
    },
  ): void {
    this.broadcast(auctionId, 'auction:team-updated', payload);
  }

  private broadcast(
    auctionId: string,
    event: string,
    payload: object,
  ): void {
    this.server.to(this.roomName(auctionId)).emit(event, payload);
  }

  private roomName(auctionId: string): string {
    return `auction:${auctionId}`;
  }
}
