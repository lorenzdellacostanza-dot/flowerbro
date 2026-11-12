import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { flowerTagLabels } from '../../../../data';
import { CartService } from '../../../services/cart.service';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
import { FlowerService } from '../../../services/flower.service';
import { FlowerCard } from '../../partials/flower-card/flower-card';
import { Icon } from '../../partials/icon/icon';
import { Rating } from '../../partials/rating/rating';

@Component({
  selector: 'app-flower-page',
  imports: [CurrencyPipe, RouterLink, Icon, Rating, FlowerCard],
  templateUrl: './flower-page.component.html',
  styleUrl: './flower-page.component.css',
})
export class FlowerPageComponent {
  private readonly flowerService = inject(FlowerService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });
  protected readonly flower = computed(() =>
    this.flowerService.getFlowerById(this.params().get('id') ?? '')
  );
  protected readonly related = computed(() => {
    const flower = this.flower();
    return flower
      ? this.flowerService.getAll()
        .filter(item => item.kind === flower.kind && item.id !== flower.id)
        .slice(0, 4)
      : [];
  });
  protected readonly quantity = linkedSignal({ source: () => this.flower()?.id, computation: () => 1 });
  protected readonly favorites = inject(FlowerFavoritesService);
  protected readonly cart = inject(CartService);
  protected readonly tagLabels = flowerTagLabels;

  protected addToCart(id: string): void {
    this.cart.setQuantity(id, this.cart.quantity(id) + this.quantity());
  }
}
