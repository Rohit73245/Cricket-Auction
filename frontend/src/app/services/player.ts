import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Player {
  id: string;
  name: string;
  role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
  nationality: string;
  photoUrl: string | null;
  basePrice: number | string;
}

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  season: string;
  sourceType: 'IPL' | 'DOMESTIC_T20' | null;
  asOfDate: string | null;
  statistics: Record<string, number> | null;
  sourceName: string | null;
  sourceUrl: string | null;
  verified: boolean;
  displayStatus: 'AVAILABLE' | 'DOMESTIC_T20' | 'N/A';
}

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/players';

  getPlayers(): Observable<Player[]> {
    return this.http.get<Player[]>(this.apiUrl);
  }

  getSeasonStats(
    playerId: string,
    season: string,
  ): Observable<PlayerSeasonStats> {
    return this.http.get<PlayerSeasonStats>(
      `${this.apiUrl}/${playerId}/season-stats/${season}`,
    );
  }
}