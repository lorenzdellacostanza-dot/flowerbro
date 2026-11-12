import { CurrencyPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
import { Flower } from '../../../shared/models/Flower';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-flower-card',
  imports: [CurrencyPipe, RouterLink, Icon],
  templateUrl: './flower-card.html',
  styleUrl: './flower-card.css',
})
export class FlowerCard {
  readonly flower = input.required<Flower>();
  readonly loading = input<'eager' | 'lazy'>('lazy');
  protected readonly cart = inject(CartService);
  protected readonly favorites = inject(FlowerFavoritesService);
}
