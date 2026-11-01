
import {
  Component,
  computed,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HISTORICAL_TEAMS } from '../../data/historical-teams';
import { Auction, AuctionService } from '../../services/auction';

export interface Team {
  name: string;
  short: string;
  color: string;
}

interface League {
  id: string;
  name: string;
  short: string;
  description: string;
  startYear: number;
  crossYear: boolean;
}

@Component({
  selector: 'app-league-selection',
  imports: [FormsModule, RouterLink],
  templateUrl: './league-selection.html',
  styleUrl: './league-selection.css',
})
export class LeagueSelection implements OnInit {
  private readonly auctionService = inject(AuctionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  auctionId = '';

  auction = signal<Auction | null>(null);
  loading = signal(true);
  saving = signal(false);
  errorMessage = signal('');

  leagues: League[] = [
    {
      id: 'IPL',
      name: 'Indian Premier League',
      short: 'IPL',
      description: "India · Men's T20",
      startYear: 2008,
      crossYear: false,
    },
    {
      id: 'PSL',
      name: 'Pakistan Super League',
      short: 'PSL',
      description: "Pakistan · Men's T20",
      startYear: 2016,
      crossYear: false,
    },
    {
      id: 'BBL',
      name: 'Big Bash League',
      short: 'BBL',
      description: "Australia · Men's T20",
      startYear: 2011,
      crossYear: true,
    },
    {
      id: 'SA20',
      name: 'SA20',
      short: 'SA20',
      description: "South Africa · Men's T20",
      startYear: 2022,
      crossYear: true,
    },
    {
      id: 'HUNDRED_M',
      name: "The Hundred — Men's",
      short: '100M',
      description: "England and Wales · Men's 100-ball cricket",
      startYear: 2021,
      crossYear: false,
    },
    {
      id: 'HUNDRED_W',
      name: "The Hundred — Women's",
      short: '100W',
      description: "England and Wales · Women's 100-ball cricket",
      startYear: 2021,
      crossYear: false,
    },
    {
      id: 'ILT20',
      name: 'International League T20',
      short: 'ILT20',
      description: "United Arab Emirates · Men's T20",
      startYear: 2022,
      crossYear: true,
    },
    {
      id: 'MLC',
      name: 'Major League Cricket',
      short: 'MLC',
      description: "United States · Men's T20",
      startYear: 2023,
      crossYear: false,
    },
    {
      id: 'WPL',
      name: "Women's Premier League",
      short: 'WPL',
      description: "India · Women's T20",
      startYear: 2023,
      crossYear: false,
    },
  ];

  selectedLeagueId = signal('');
  season = signal('');
  selectedTeams = signal<string[]>([]);

  selectedLeague = computed(() =>
    this.leagues.find(
      league => league.id === this.selectedLeagueId()
    )
  );

  teams = computed<Team[]>(() =>
    HISTORICAL_TEAMS[this.selectedLeagueId()]?.[
      this.season()
    ] ?? []
  );

  ngOnInit(): void {
    this.auctionId =
      this.route.snapshot.paramMap.get('id') ?? '';

    if (!this.auctionId) {
      this.errorMessage.set('Auction ID is missing.');
      this.loading.set(false);
      return;
    }

    this.auctionService.getAuction(this.auctionId).subscribe({
      next: (data) => {
        this.auction.set(data);

        if (data.mode !== 'EXISTING_LEAGUE') {
          this.errorMessage.set(
            'League selection is only available for Existing League auctions.'
          );
          this.loading.set(false);
          return;
        }

        if (!data.leagueId || !data.season) {
          this.errorMessage.set(
            'League and season were not saved when this draft was created.'
          );
          this.loading.set(false);
          return;
        }

        this.selectedLeagueId.set(data.leagueId);
        this.season.set(data.season);

        this.selectedTeams.set(data.selectedTeams ?? []);

        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load auction details.');
        this.loading.set(false);
      },
    });
  }

  toggleTeam(short: string): void {
    this.selectedTeams.update(current =>
      current.includes(short)
        ? current.filter(team => team !== short)
        : [...current, short]
    );
  }

  isSelected(short: string): boolean {
    return this.selectedTeams().includes(short);
  }

  continueToTeamSetup(): void {
    if (this.selectedTeams().length < 2) {
      this.errorMessage.set('Please select at least two teams.');
      return;
    }

    if (!this.auctionId) {
      this.errorMessage.set('Auction ID is missing.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    this.auctionService.saveLeagueSelection(this.auctionId, {
      leagueId: this.selectedLeagueId(),
      season: this.season(),
      selectedTeams: this.selectedTeams(),
    }).subscribe({
      next: () => {
        this.saving.set(false);

        this.router.navigate([
          '/auctions',
          this.auctionId,
          'team-setup',
        ]);
      },
      error: (error) => {
        console.error('Error saving league selection:', error);
        this.saving.set(false);
        this.errorMessage.set(
          error.error?.message ??
          'Unable to save team selection. Please try again.'
        );
      },
    });
  }
}
