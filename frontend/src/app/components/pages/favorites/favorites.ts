import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
import { FlowerService } from '../../../services/flower.service';
import { FlowerCard } from '../../partials/flower-card/flower-card';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, FlowerCard, Icon],
  template: `
    <section class="shell page">
      <a class="back-link" routerLink="/" fragment="catalogo"><app-icon name="arrow-left" /> Catalogo</a>
      <header class="page-title">
        <h1>I tuoi preferiti</h1>
        @if (flowers().length) {
          <p>{{ flowers().length }} {{ flowers().length === 1 ? 'fiore salvato' : 'fiori salvati' }}</p>
        }
      </header>
      @if (flowers().length) {
        <ul class="product-grid">
          @for (flower of flowers(); track flower.id) {
            <li><app-flower-card [flower]="flower" /></li>
          }
        </ul>
      } @else {
        <div class="empty-state">
          <app-icon name="heart" />
          <h2>Qui troverai i tuoi fiori preferiti</h2>
          <p>Tocca il cuore su un fiore per ritrovarlo qui.</p>
          <a class="btn" routerLink="/" fragment="catalogo">Esplora il catalogo <app-icon name="arrow-right" /></a>
        </div>
      }
    </section>
  `,
})
export class Favorites {
  private readonly catalog = inject(FlowerService).getAll();
  private readonly favorites = inject(FlowerFavoritesService);
  protected readonly flowers = computed(() => this.catalog.filter(flower => this.favorites.isFavorite(flower)));
}
