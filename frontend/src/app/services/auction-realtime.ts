import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { Auction, AuctionPlayer, AuctionTeam } from './auction';

export interface AuctionRealtimeState {
  auction: Pick<Auction, 'id' | 'name' | 'status' | 'mode' | 'visibility'>;
  currentPlayer: AuctionPlayer | null;
  biddingEndsAt: string | null;
  players: AuctionPlayer[];
  teams: AuctionTeam[];
}

export interface AuctionBidEvent {
  amount: number | string;
  team: AuctionTeam;
  player: AuctionPlayer['player'];
  biddingEndsAt: string;
}

export interface AuctionPlayerLiveEvent {
  player: AuctionPlayer;
  biddingEndsAt: string | null;
}

export interface AuctionPlayerSoldEvent {
  player: AuctionPlayer['player'];
  team: AuctionTeam;
  soldPrice: number | string;
}

export interface AuctionPlayerUnsoldEvent {
  player: AuctionPlayer;
}

export interface AuctionTeamUpdatedEvent {
  teamName: string;
  remainingPurse: number | string;
  team?: AuctionTeam;
}

export interface AuctionStatusEvent {
  status: string;
  auction?: Partial<Auction>;
}

@Injectable({ providedIn: 'root' })
export class AuctionRealtimeService {
  private socket: Socket | null = null;
  private activeAuctionId: string | null = null;

  private readonly connectionSubject = new BehaviorSubject(false);
  private readonly stateSubject = new Subject<AuctionRealtimeState>();
  private readonly bidSubject = new Subject<AuctionBidEvent>();
  private readonly playerLiveSubject = new Subject<AuctionPlayerLiveEvent>();
  private readonly playerSoldSubject = new Subject<AuctionPlayerSoldEvent>();
  private readonly playerUnsoldSubject = new Subject<AuctionPlayerUnsoldEvent>();
  private readonly teamUpdatedSubject = new Subject<AuctionTeamUpdatedEvent>();
  private readonly statusSubject = new Subject<AuctionStatusEvent>();
  private readonly errorSubject = new Subject<string>();

  readonly connection$ = this.connectionSubject.asObservable();
  readonly state$ = this.stateSubject.asObservable();
  readonly bid$ = this.bidSubject.asObservable();
  readonly playerLive$ = this.playerLiveSubject.asObservable();
  readonly playerSold$ = this.playerSoldSubject.asObservable();
  readonly playerUnsold$ = this.playerUnsoldSubject.asObservable();
  readonly teamUpdated$ = this.teamUpdatedSubject.asObservable();
  readonly status$ = this.statusSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  connectToAuction(auctionId: string): void {
    if (this.activeAuctionId === auctionId && this.socket) {
      return;
    }

    this.leaveAuction();
    this.activeAuctionId = auctionId;
    const socket = io('http://localhost:3000', { autoConnect: false });
    this.socket = socket;

    socket.on('connect', () => {
      this.connectionSubject.next(true);
      socket.emit('auction:join', { auctionId });
    });
    socket.on('disconnect', () => this.connectionSubject.next(false));
    socket.on('connect_error', () => this.connectionSubject.next(false));
    socket.on('auction:error', (event: { message?: string }) => {
      this.errorSubject.next(event.message ?? 'Could not join this auction.');
    });
    socket.on('auction:state', (event: AuctionRealtimeState) =>
      this.stateSubject.next(event),
    );
    socket.on('auction:bid', (event: AuctionBidEvent) =>
      this.bidSubject.next(event),
    );
    socket.on('auction:player-live', (event: AuctionPlayerLiveEvent) =>
      this.playerLiveSubject.next(event),
    );
    socket.on('auction:player-sold', (event: AuctionPlayerSoldEvent) =>
      this.playerSoldSubject.next(event),
    );
    socket.on('auction:player-unsold', (event: AuctionPlayerUnsoldEvent) =>
      this.playerUnsoldSubject.next(event),
    );
    socket.on('auction:team-updated', (event: AuctionTeamUpdatedEvent) =>
      this.teamUpdatedSubject.next(event),
    );
    socket.on('auction:status', (event: AuctionStatusEvent) =>
      this.statusSubject.next(event),
    );

    socket.connect();
  }

  leaveAuction(): void {
    if (this.socket && this.activeAuctionId) {
      this.socket.emit('auction:leave', { auctionId: this.activeAuctionId });
      this.socket.disconnect();
    }
    this.socket = null;
    this.activeAuctionId = null;
    this.connectionSubject.next(false);
  }
}
