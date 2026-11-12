import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { flowerTagLabels } from '../../../../data';
import { CartService } from '../../../services/cart.service';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
import { FlowerService } from '../../../services/flower.service';
import { Icon } from '../../partials/icon/icon';
import { Rating } from '../../partials/rating/rating';

@Component({
  selector: 'app-flower-page',
  imports: [CurrencyPipe, RouterLink, Icon, Rating],
  templateUrl: './flower-page.component.html',
  styleUrl: './flower-page.component.css',
})
export class FlowerPageComponent {
  private readonly flowerService = inject(FlowerService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });
  protected readonly flower = computed(() =>
    this.flowerService.getFlowerById(this.params().get('id') ?? '')
  );
  protected readonly favorites = inject(FlowerFavoritesService);
  protected readonly cart = inject(CartService);
  protected readonly tagLabels = flowerTagLabels;
}
