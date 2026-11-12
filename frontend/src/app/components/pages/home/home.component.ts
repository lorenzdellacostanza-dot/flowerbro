import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlowerService } from '../../../services/flower.service';
import { FlowerCard } from '../../partials/flower-card/flower-card';
import { Icon } from '../../partials/icon/icon';

const categories = [
  { id: 'all', label: 'Tutti i fiori', tags: [] },
  { id: 'romantic', label: 'Romantici', tags: ['romantic'] },
  { id: 'colorful', label: 'Colorati', tags: ['colorful', 'bright'] },
  { id: 'elegant', label: 'Eleganti', tags: ['elegant'] },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, FlowerCard, Icon],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly flowers = inject(FlowerService).getAll();
  protected readonly categories = categories;
  protected readonly category = signal(categories[0]);
  protected readonly sort = signal('featured');
  protected readonly searchTerm = signal('');

  protected readonly visibleFlowers = computed(() => {
    const term = this.searchTerm();
    const category = this.category();
    const flowers = this.flowers.filter(flower =>
      flower.name.toLocaleLowerCase('it').includes(term) &&
      (category.tags.length === 0 || category.tags.some(tag => flower.tags?.includes(tag)))
    );

    switch (this.sort()) {
      case 'price-ascending': return flowers.sort((a, b) => a.price - b.price);
      case 'price-descending': return flowers.sort((a, b) => b.price - a.price);
      case 'rating': return flowers.sort((a, b) => b.stars - a.stars);
      default: return flowers;
    }
  });

  protected searchFlowers(query: string): void {
    this.searchTerm.set(query.trim().toLocaleLowerCase('it'));
  }

  protected resetFilters(input: HTMLInputElement): void {
    input.value = '';
    this.searchFlowers('');
    this.category.set(categories[0]);
    this.sort.set('featured');
    input.focus();
  }
}
