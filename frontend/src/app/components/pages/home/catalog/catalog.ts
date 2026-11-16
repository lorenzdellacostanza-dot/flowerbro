import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FlowerService } from '../../../../services/flower.service';
import { FlowerCard } from '../../../partials/flower-card/flower-card';
import { Icon } from '../../../partials/icon/icon';
import { occasions } from './occasions';

const groups = [
  { id: null, label: 'Tutti i fiori', kind: null },
  { id: 'bouquet', label: 'Bouquet', kind: 'bouquet' },
  { id: 'fiori', label: 'Fiori singoli', kind: 'stem' },
] as const;

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
  private readonly flowerService = inject(FlowerService);

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

  protected readonly visibleFlowers = computed(() => this.flowerService.search({
    kind: this.selectedGroup().kind,
    occasionTags: this.selectedOccasion()?.tags,
    term: this.searchTerm(),
    sort: this.sort(),
  }));

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
