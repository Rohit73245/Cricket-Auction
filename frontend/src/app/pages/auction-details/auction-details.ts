import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import {
  Auction,
  AuctionPlayer,
  AuctionService,
  AuctionTeam,
} from '../../services/auction';
import {
  AuctionRealtimeService,
  AuctionRealtimeState,
} from '../../services/auction-realtime';

@Component({
  selector: 'app-auction-details',
  imports: [DatePipe, RouterLink],
  templateUrl: './auction-details.html',
  styleUrl: './auction-details.css',
})
export class AuctionDetails implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);
  private readonly realtime = inject(AuctionRealtimeService);

  auction = signal<Auction | null>(null);
  loading = signal(true);
  error = signal('');
  realtimeError = signal('');
  connected = signal(false);
  livePlayer = signal<AuctionPlayer | null>(null);
  teams = signal<AuctionTeam[]>([]);
  currentBid = signal<{ amount: number | string; teamName: string } | null>(null);
  secondsRemaining = signal(0);
  activityMessage = signal('');
  private readonly subscriptions: Subscription[] = [];
  private biddingEndsAt: string | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('Auction ID is missing.');
      this.loading.set(false);
      return;
    }

    this.subscriptions.push(
      this.realtime.connection$.subscribe((connected) => {
        this.connected.set(connected);
        if (connected) {
          this.refreshAuctionState(id);
        }
      }),
      this.realtime.state$.subscribe((state) => this.applyState(state)),
      this.realtime.bid$.subscribe((event) => {
        this.currentBid.set({
          amount: event.amount,
          teamName: event.team.teamName,
        });
        this.activityMessage.set(
          `${event.team.teamName} bid ${event.amount}.`,
        );
        this.setBiddingEnd(event.biddingEndsAt);
      }),
      this.realtime.playerLive$.subscribe((event) => {
        this.livePlayer.set(event.player);
        this.currentBid.set(null);
        this.activityMessage.set(`${event.player.player.name} is now live.`);
        this.setBiddingEnd(event.biddingEndsAt);
      }),
      this.realtime.playerSold$.subscribe((event) => {
        this.livePlayer.set(null);
        this.currentBid.set(null);
        this.activityMessage.set(
          `${event.player.name} sold to ${event.team.teamName} for ${event.soldPrice}.`,
        );
        this.setBiddingEnd(null);
      }),
      this.realtime.playerUnsold$.subscribe((event) => {
        this.livePlayer.set(null);
        this.currentBid.set(null);
        this.activityMessage.set(`${event.player.player.name} marked unsold.`);
        this.setBiddingEnd(null);
      }),
      this.realtime.teamUpdated$.subscribe((event) => {
        if (event.team) {
          const updatedTeam = event.team;
          this.teams.update((teams) => [
            ...teams.filter((team) => team.id !== updatedTeam.id),
            updatedTeam,
          ]);
        } else {
          this.teams.update((teams) =>
            teams.map((team) =>
              team.teamName === event.teamName
                ? { ...team, remainingPurse: event.remainingPurse }
                : team,
            ),
          );
        }
      }),
      this.realtime.status$.subscribe((event) => {
        this.auction.update((auction) =>
          auction ? { ...auction, status: event.status } : auction,
        );
      }),
      this.realtime.error$.subscribe((message) => this.realtimeError.set(message)),
    );

    this.realtime.connectToAuction(id);

    this.auctionService.getAuction(id).subscribe({
      next: (auction) => {
        this.auction.set(auction);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err.status === 404
            ? 'Auction not found.'
            : 'Could not load auction. Check that your backend is running.',
        );
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.realtime.leaveAuction();
  }

  private refreshAuctionState(id: string): void {
    forkJoin({
      auction: this.auctionService.getAuction(id),
      teams: this.auctionService.getAuctionTeams(id),
      players: this.auctionService.getAuctionPlayers(id),
    }).subscribe({
      next: ({ auction, teams, players }) => {
        this.auction.set(auction);
        this.teams.set(teams);
        const livePlayer = players.find((player) => player.status === 'LIVE') ?? null;
        this.livePlayer.set(livePlayer);
        const latestBid = livePlayer?.bids?.[0];
        this.currentBid.set(
          latestBid
            ? {
                amount: latestBid.amount,
                teamName: latestBid.team.teamName,
              }
            : null,
        );
        this.setBiddingEnd(livePlayer?.biddingEndsAt ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.realtimeError.set('Could not refresh the auction after reconnecting.');
      },
    });
  }

  private applyState(state: AuctionRealtimeState): void {
    this.auction.update((auction) =>
      auction ? { ...auction, status: state.auction.status } : auction,
    );
    this.teams.set(state.teams);
    this.livePlayer.set(state.currentPlayer);
    const latestBid = state.currentPlayer?.bids?.[0];
    this.currentBid.set(
      latestBid
        ? {
            amount: latestBid.amount,
            teamName: latestBid.team.teamName,
          }
        : null,
    );
    this.setBiddingEnd(state.biddingEndsAt);
  }

  private setBiddingEnd(biddingEndsAt: string | null): void {
    this.biddingEndsAt = biddingEndsAt;
    this.updateCountdown();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (biddingEndsAt) {
      this.countdownInterval = setInterval(
        () => this.updateCountdown(),
        1000,
      );
    }
  }

  private updateCountdown(): void {
    this.secondsRemaining.set(
      this.biddingEndsAt
        ? Math.max(
            0,
            Math.ceil((Date.parse(this.biddingEndsAt) - Date.now()) / 1000),
          )
        : 0,
    );
  }
}
