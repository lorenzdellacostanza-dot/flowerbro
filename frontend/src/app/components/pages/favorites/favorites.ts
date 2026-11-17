import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
import { FlowerService } from '../../../services/flower.service';
import { FlowerCard } from '../../partials/flower-card/flower-card';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, FlowerCard, Icon],
  templateUrl: './favorites.html',
})
export class Favorites {
  protected readonly flowers = inject(FlowerFavoritesService).selectedFlowers;
  protected readonly catalog = inject(FlowerService);
}
