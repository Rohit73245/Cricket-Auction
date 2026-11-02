import { Component, OnInit, inject, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { PlayerService, Player, PlayerSeasonStats } from '../../services/player';

@Component({
  selector: 'app-player-stats',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './player-stats.html',
  styleUrl: './player-stats.css',
})
export class PlayerStats implements OnInit {
  private readonly playerService = inject(PlayerService);

  players = signal<Player[]>([]);
  selectedPlayerId = signal('');
  season = signal('2026');

  stats = signal<PlayerSeasonStats | null>(null);
  loading = signal(false);
  playersLoading = signal(true);
  error = signal('');

  ngOnInit(): void {
    this.playerService.getPlayers().subscribe({
      next: (result) => {
        this.players.set(result);
        this.playersLoading.set(false);

        if (result.length > 0) {
          this.selectedPlayerId.set(result[0].id);
          this.loadStats();
        }
      },
      error: () => {
        this.error.set('Could not load players. Check your backend.');
        this.playersLoading.set(false);
      },
    });
  }

  loadStats(): void {
    const playerId = this.selectedPlayerId();

    if (!playerId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.stats.set(null);

    this.playerService.getSeasonStats(playerId, this.season()).subscribe({
      next: (result) => {
        this.stats.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load player statistics.');
        this.loading.set(false);
      },
    });
  }

  onPlayerChange(playerId: string): void {
    this.selectedPlayerId.set(playerId);
    this.loadStats();
  }
}