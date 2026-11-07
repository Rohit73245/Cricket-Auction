
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

export interface AuctionTeam {
  id: string;
  teamCode: string;
  teamName: string;
  totalPurse: number | string;
  remainingPurse: number | string;
}

export interface AuctionPlayer {
  id: string;
  status: 'QUEUED' | 'LIVE' | 'SOLD' | 'UNSOLD';
  queueOrder: number;
  biddingEndsAt: string | null;
  soldPrice: number | string | null;
  player: {
    id: string;
    name: string;
    role: string;
    nationality: string;
    basePrice: number | string;
  };
  team: AuctionTeam | null;
  bids?: {
    id: string;
    amount: number | string;
    team: AuctionTeam;
  }[];
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

  getAuctionTeams(id: string): Observable<AuctionTeam[]> {
    return this.http.get<AuctionTeam[]>(`${this.apiUrl}/${id}/teams`);
  }

  getAuctionPlayers(id: string): Observable<AuctionPlayer[]> {
    return this.http.get<AuctionPlayer[]>(`${this.apiUrl}/${id}/players`);
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
