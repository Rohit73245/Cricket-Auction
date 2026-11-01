import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { AuctionDetails } from './pages/auction-details/auction-details';
import { LeagueSelection } from './pages/league-selection/league-selection';
import { TeamSetup } from './pages/team-setup/team-setup';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'auctions/:id/league', component: LeagueSelection },
  { path: 'auctions/:id/team-setup', component: TeamSetup },
  { path: 'auctions/:id', component: AuctionDetails },
  { path: '**', redirectTo: '' },
];