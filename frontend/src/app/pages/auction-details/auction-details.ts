import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auction, AuctionService } from '../../services/auction';

@Component({
  selector: 'app-auction-details',
  imports: [DatePipe, RouterLink],
  templateUrl: './auction-details.html',
  styleUrl: './auction-details.css',
})
export class AuctionDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);

  auction = signal<Auction | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('Auction ID is missing.');
      this.loading.set(false);
      return;
    }

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
}
