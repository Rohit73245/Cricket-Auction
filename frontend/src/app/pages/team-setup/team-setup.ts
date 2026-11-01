
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auction, AuctionService } from '../../services/auction';

@Component({
  imports: [RouterLink],
  selector: 'app-team-setup',
  styleUrl: './team-setup.css',
  templateUrl: './team-setup.html',
})
export class TeamSetup implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);

  auction = signal<Auction | null>(null);
  loading = signal(true);
  starting = signal(false);
  error = signal('');
  success = signal('');

  formatPurse(purse: number | string): number {
    return Number(purse) / 10000000;
  }

  ngOnInit(): void {
    const auctionId = this.route.snapshot.paramMap.get('id');

    if (!auctionId) {
      this.error.set('Auction ID not found.');
      this.loading.set(false);
      return;
    }

    this.loadAuction(auctionId);
  }

  loadAuction(auctionId: string): void {
    this.auctionService.getAuction(auctionId).subscribe({
      next: (data) => {
        this.auction.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load auction details.');
        this.loading.set(false);
      },
    });
  }

  startAuction(): void {
    const currentAuction = this.auction();

    if (!currentAuction || this.starting()) {
      return;
    }

    if (!confirm('Are you sure you want to start this auction?')) {
      return;
    }

    this.starting.set(true);
    this.error.set('');
    this.success.set('');

    this.auctionService.startAuction(currentAuction.id).subscribe({
      next: (updatedAuction) => {
        this.auction.set(updatedAuction);
        this.starting.set(false);
        this.success.set('Auction started successfully!');
      },
      error: (err) => {
        this.starting.set(false);
        this.error.set(
          err.error?.message || 'Unable to start the auction.'
        );
      },
    });
  }
}
