
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { HISTORICAL_TEAMS } from '../../data/historical-teams';

import {
  Auction,
  AuctionService,
  CreateAuctionRequest,
} from '../../services/auction';

interface LeagueOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly auctionService = inject(AuctionService);
  private readonly router = inject(Router);

  name = '';
  mode: CreateAuctionRequest['mode'] = 'EXISTING_LEAGUE';
  visibility: CreateAuctionRequest['visibility'] = 'PRIVATE';

  // Available leagues
  leagues: LeagueOption[] = [
    { id: 'IPL', name: 'Indian Premier League' },
    { id: 'PSL', name: 'Pakistan Super League' },
    { id: 'BBL', name: 'Big Bash League' },
    { id: 'SA20', name: 'SA20' },
    { id: 'HUNDRED_M', name: "The Hundred — Men's" },
    { id: 'HUNDRED_W', name: "The Hundred — Women's" },
    { id: 'ILT20', name: 'International League T20' },
    { id: 'MLC', name: 'Major League Cricket' },
    { id: 'WPL', name: "Women's Premier League" },
  ];

  selectedLeagueId = signal('IPL');
  selectedSeason = signal('');

  seasons = computed(() => {
    const seasonData =
      HISTORICAL_TEAMS[this.selectedLeagueId()] ?? {};

    return Object.keys(seasonData).sort((a, b) => {
      const yearA = Number(a.split('-')[0]);
      const yearB = Number(b.split('-')[0]);

      return yearB - yearA;
    });
  });

  auctions = signal<Auction[]>([]);
  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');

  constructor() {
    this.setLatestSeason();
  }

  ngOnInit(): void {
    this.loadAuctions();
  }

  setLatestSeason(): void {
    this.selectedSeason.set(this.seasons()[0] ?? '');
  }

  changeLeague(leagueId: string): void {
    this.selectedLeagueId.set(leagueId);
    this.setLatestSeason();
  }

  loadAuctions(): void {
    this.loading.set(true);
    this.error.set('');

    this.auctionService.getAuctions().subscribe({
      next: (auctions) => {
        this.auctions.set(auctions);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Could not load auctions. Check that your backend is running.',
        );
        this.loading.set(false);
      },
    });
  }

  createAuction(): void {
    const trimmedName = this.name.trim();

    if (!trimmedName) {
      this.error.set('Please enter an auction name.');
      return;
    }

    if (this.mode === 'EXISTING_LEAGUE') {
      if (!this.selectedLeagueId()) {
        this.error.set('Please select a league.');
        return;
      }

      if (!this.selectedSeason()) {
        this.error.set('Please select a season.');
        return;
      }
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const request: CreateAuctionRequest = {
      name: trimmedName,
      mode: this.mode,
      visibility: this.visibility,
      ...(this.mode === 'EXISTING_LEAGUE'
        ? {
            leagueId: this.selectedLeagueId(),
            season: this.selectedSeason(),
          }
        : {}),
    };

    this.auctionService.createAuction(request).subscribe({
      next: (auction) => {
        this.auctions.update((items) => [auction, ...items]);
        this.name = '';
        this.saving.set(false);

        this.router.navigate(['/auctions', auction.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(
          err.error?.message ||
            'Could not create auction. Please try again.',
        );
      },
    });
  }
}
