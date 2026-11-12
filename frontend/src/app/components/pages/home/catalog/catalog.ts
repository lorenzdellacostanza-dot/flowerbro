import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { flowerTagLabels } from '../../../../../data';
import { FlowerService } from '../../../../services/flower.service';
import { FlowerCard } from '../../../partials/flower-card/flower-card';
import { Icon } from '../../../partials/icon/icon';
import { occasions } from './occasions';

const groups = [
  { id: null, label: 'Tutti i fiori', kind: null },
  { id: 'bouquet', label: 'Bouquet', kind: 'bouquet' },
  { id: 'fiori', label: 'Fiori singoli', kind: 'stem' },
] as const;

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase('it').normalize('NFD').replace(/\p{Diacritic}/gu, '');

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, FlowerCard, Icon],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
})
export class Catalog {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly flowers = inject(FlowerService).getAll();
  private readonly searchableFlowers = this.flowers.map(flower => ({
    flower,
    text: normalize([
      flower.name,
      flower.kind === 'bouquet' ? 'bouquet' : 'fiore singolo',
      flower.composition,
      ...(flower.tags ?? []).map(tag => flowerTagLabels[tag] ?? tag),
    ].join(' ')),
  }));

  protected readonly groups = groups;
  protected readonly occasions = occasions;
  protected readonly selectedGroup = computed(() =>
    groups.find(group => group.id === this.params().get('tipo')) ?? groups[0]
  );
  protected readonly selectedOccasion = computed(() =>
    occasions.find(occasion => occasion.id === this.params().get('occasione'))
  );
  protected readonly searchTerm = signal('');
  protected readonly sort = signal('featured');

  protected readonly visibleFlowers = computed(() => {
    const terms = normalize(this.searchTerm()).split(/\s+/).filter(Boolean);
    const group = this.selectedGroup();
    const occasion = this.selectedOccasion();
    const flowers = this.searchableFlowers
      .filter(({ flower, text }) =>
        (!group.kind || flower.kind === group.kind) &&
        (!occasion || occasion.tags.some(tag => flower.tags?.includes(tag))) &&
        terms.every(term => text.includes(term))
      )
      .map(({ flower }) => flower);

    switch (this.sort()) {
      case 'price-ascending': return flowers.sort((a, b) => a.price - b.price);
      case 'price-descending': return flowers.sort((a, b) => b.price - a.price);
      case 'rating': return flowers.sort((a, b) => b.stars - a.stars);
      default: return flowers;
    }
  });

  protected filterOccasion(occasion: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { occasione: occasion || null },
      queryParamsHandling: 'merge',
      fragment: 'catalogo',
    });
  }

  protected resetFilters(input: HTMLInputElement): void {
    this.searchTerm.set('');
    this.sort.set('featured');
    void this.router.navigate([], { relativeTo: this.route, fragment: 'cerca-fiori' }).then(() => input.focus());
  }
}
