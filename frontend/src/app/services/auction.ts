
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeagueRules {
  id: string;
  leagueId: string;
  rulesSourceSeason: string;
  currency: string;
  teamPurse: number | string;
  minimumSquadSize: number;
  maximumSquadSize: number | null;
  maximumOverseasPlayers: number | null;
  maximumOverseasInXI: number | null;
  minimumLocalPlayers: number | null;
  minimumUnder22Players: number | null;
  rulesSource: string | null;
  verified: boolean;
}

export interface Auction {
  id: string;
  name: string;
  mode: 'EXISTING_LEAGUE' | 'CUSTOM';
  status: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  leagueId?: string | null;
  season?: string | null;
  selectedTeams?: string[] | null;
  leagueRulesId?: string | null;
  leagueRules?: LeagueRules | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuctionRequest {
  name: string;
  mode: 'EXISTING_LEAGUE' | 'CUSTOM';
  visibility: 'PRIVATE' | 'PUBLIC';
  leagueId?: string;
  season?: string;
}

export interface LeagueSelectionRequest {
  leagueId: string;
  season: string;
  selectedTeams: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuctionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/v1/auctions';

  getAuctions(): Observable<Auction[]> {
    return this.http.get<Auction[]>(this.apiUrl);
  }

  getAuction(id: string): Observable<Auction> {
    return this.http.get<Auction>(`${this.apiUrl}/${id}`);
  }

  createAuction(data: CreateAuctionRequest): Observable<Auction> {
    return this.http.post<Auction>(this.apiUrl, data);
  }

  saveLeagueSelection(
    id: string,
    data: LeagueSelectionRequest
  ): Observable<Auction> {
    return this.http.patch<Auction>(
      `${this.apiUrl}/${id}/league-selection`,
      data
    );
  }

  startAuction(id: string): Observable<Auction> {
    return this.http.post<Auction>(
      `${this.apiUrl}/${id}/start`,
      {}
    );
  }
}
