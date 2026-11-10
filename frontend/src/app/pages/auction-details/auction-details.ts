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

type PlayerStat = {
  label: string;
  value: string;
};

type PlayerWithExtras = AuctionPlayer['player'] & {
  photoUrl?: string | null;
  statistics?: unknown;
};

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

  currentBid = signal<{
    amount: number | string;
    teamId: string;
    teamName: string;
  } | null>(null);

  bidHistory = signal<NonNullable<AuctionPlayer['bids']>>([]);

  selectedTeamId = signal('');
  bidSubmitting = signal(false);
  bidError = signal('');
  bidMessage = signal('');

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
          teamId: event.team.id,
          teamName: event.team.teamName,
        });

        this.bidError.set('');
        this.bidMessage.set('Bid accepted successfully.');

        this.activityMessage.set(
          `${event.team.teamName} bid ${this.formatBid(event.amount)}.`,
        );

        this.setBiddingEnd(event.biddingEndsAt);

        // Fetch the authoritative bid history after the accepted bid.
        this.refreshAuctionState(id);
      }),

      this.realtime.playerLive$.subscribe((event) => {
        this.livePlayer.set(event.player);
        this.bidHistory.set(event.player.bids ?? []);
        this.currentBid.set(null);
        this.bidError.set('');
        this.bidMessage.set('');

        this.activityMessage.set(
          `${event.player.player.name} is now live.`,
        );

        this.setBiddingEnd(event.biddingEndsAt);
      }),

      this.realtime.playerSold$.subscribe((event) => {
        this.livePlayer.set(null);
        this.bidHistory.set([]);
        this.currentBid.set(null);
        this.bidMessage.set('');
        this.bidError.set('');

        this.activityMessage.set(
          `${event.player.name} sold to ${event.team.teamName} for ${this.formatBid(event.soldPrice)}.`,
        );

        this.setBiddingEnd(null);
      }),

      this.realtime.playerUnsold$.subscribe((event) => {
        this.livePlayer.set(null);
        this.bidHistory.set([]);
        this.currentBid.set(null);
        this.bidMessage.set('');
        this.bidError.set('');

        this.activityMessage.set(
          `${event.player.player.name} marked unsold.`,
        );

        this.setBiddingEnd(null);
      }),

      this.realtime.teamUpdated$.subscribe((event) => {
        if (event.team) {
          const updatedTeam = event.team;

          this.teams.update((teams) =>
            teams.map((team) =>
              team.id === updatedTeam.id ? updatedTeam : team,
            ),
          );
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

      this.realtime.error$.subscribe((message) =>
        this.realtimeError.set(message),
      ),
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
    this.subscriptions.forEach((subscription) =>
      subscription.unsubscribe(),
    );

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

        if (
          !this.selectedTeamId() ||
          !teams.some((team) => team.id === this.selectedTeamId())
        ) {
          this.selectedTeamId.set(teams[0]?.id ?? '');
        }

        const livePlayer =
          players.find((player) => player.status === 'LIVE') ?? null;

        this.livePlayer.set(livePlayer);
        this.bidHistory.set(livePlayer?.bids ?? []);

        const latestBid = livePlayer?.bids?.[0];

        this.currentBid.set(
          latestBid
            ? {
                amount: latestBid.amount,
                teamId: latestBid.team.id,
                teamName: latestBid.team.teamName,
              }
            : null,
        );

        this.setBiddingEnd(livePlayer?.biddingEndsAt ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.realtimeError.set(
          'Could not refresh the auction after reconnecting.',
        );
      },
    });
  }

  private applyState(state: AuctionRealtimeState): void {
    this.auction.update((auction) =>
      auction ? { ...auction, status: state.auction.status } : auction,
    );

    this.teams.set(state.teams);

    if (
      !this.selectedTeamId() ||
      !state.teams.some((team) => team.id === this.selectedTeamId())
    ) {
      this.selectedTeamId.set(state.teams[0]?.id ?? '');
    }

    this.livePlayer.set(state.currentPlayer);
    this.bidHistory.set(state.currentPlayer?.bids ?? []);

    const latestBid = state.currentPlayer?.bids?.[0];

    this.currentBid.set(
      latestBid
        ? {
            amount: latestBid.amount,
            teamId: latestBid.team.id,
            teamName: latestBid.team.teamName,
          }
        : null,
    );

    this.setBiddingEnd(state.biddingEndsAt);
  }

  selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
    this.bidError.set('');
    this.bidMessage.set('');
  }

  selectedTeam(): AuctionTeam | null {
    return (
      this.teams().find((team) => team.id === this.selectedTeamId()) ?? null
    );
  }

  playerPhotoUrl(): string | null {
    const player = this.livePlayer()?.player as PlayerWithExtras | undefined;
    return player?.photoUrl || null;
  }

  playerInitials(): string {
    const name = this.livePlayer()?.player.name?.trim();

    if (!name) {
      return 'CR';
    }

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  playerStats(): PlayerStat[] {
    const player = this.livePlayer()?.player as PlayerWithExtras | undefined;
    const statistics = player?.statistics;

    if (!statistics || typeof statistics !== 'object') {
      return [];
    }

    const result: PlayerStat[] = [];

    const addValues = (
      source: Record<string, unknown>,
      prefix = '',
    ): void => {
      for (const [key, value] of Object.entries(source)) {
        if (result.length >= 4) {
          return;
        }

        const label = prefix
          ? `${prefix} ${this.formatStatLabel(key)}`
          : this.formatStatLabel(key);

        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          result.push({
            label,
            value: String(value),
          });
        } else if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          addValues(value as Record<string, unknown>, label);
        }
      }
    };

    if (!Array.isArray(statistics)) {
      addValues(statistics as Record<string, unknown>);
    }

    return result;
  }

  private formatStatLabel(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  nextBidAmount(): number | null {
    const player = this.livePlayer();

    if (!player) {
      return null;
    }

    const bid = this.currentBid();

    // Opening bid is the player's base price.
    if (!bid) {
      return Number(player.player.basePrice);
    }

    const currentAmount = Number(bid.amount);
    const rules = this.auction()?.leagueRules?.bidIncrements;

    if (!rules) {
      return null;
    }

    const tier = rules.tiers?.find(
      (item) => currentAmount <= Number(item.upTo),
    );

    if (tier) {
      return currentAmount + Number(tier.increment);
    }

    if (rules.aboveLastTier?.mode === 'AUCTIONEER_DISCRETION') {
      return currentAmount + Number(rules.aboveLastTier.minimumIncrement);
    }

    return null;
  }

  hasInsufficientPurse(): boolean {
    const team = this.selectedTeam();
    const amount = this.nextBidAmount();

    return (
      !!team &&
      amount !== null &&
      Number(team.remainingPurse) < amount
    );
  }

  canPlaceBid(): boolean {
    const team = this.selectedTeam();
    const amount = this.nextBidAmount();

    return !!(
      this.auction()?.status === 'ACTIVE' &&
      this.connected() &&
      this.livePlayer() &&
      team &&
      amount !== null &&
      Number(team.remainingPurse) >= amount &&
      this.currentBid()?.teamId !== team.id &&
      this.secondsRemaining() > 0 &&
      !this.bidSubmitting()
    );
  }

  placeBid(): void {
    if (!this.canPlaceBid()) {
      return;
    }

    const auctionId = this.auction()?.id;
    const teamId = this.selectedTeamId();
    const amount = this.nextBidAmount();

    if (!auctionId || !teamId || amount === null) {
      return;
    }

    this.bidSubmitting.set(true);
    this.bidError.set('');
    this.bidMessage.set('');

    this.auctionService
      .placeBid(auctionId, { teamId, amount })
      .subscribe({
        next: () => {
          this.bidMessage.set(
            'Bid submitted. Waiting for live confirmation.',
          );
          this.bidSubmitting.set(false);
        },
        error: (err: {
          error?: { message?: string | string[] };
          message?: string;
        }) => {
          const message = err.error?.message;

          this.bidError.set(
            Array.isArray(message)
              ? message.join(', ')
              : message || err.message || 'Unable to place bid.',
          );

          this.bidSubmitting.set(false);
        },
      });
  }

  formatPurse(amount: number | string): string {
    const crores = Number(amount) / 10000000;
    return `₹${crores.toFixed(2)} Cr`;
  }

  formatBid(amount: number | string): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(amount));
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
            Math.ceil(
              (Date.parse(this.biddingEndsAt) - Date.now()) / 1000,
            ),
          )
        : 0,
    );
  }
}
