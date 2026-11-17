import { isPlatformServer } from '@angular/common';
import {
  computed, inject, Injectable, InjectionToken, makeStateKey, PLATFORM_ID, REQUEST, signal, TransferState,
} from '@angular/core';
import { Flower } from '../shared/models/Flower';

interface Occasion {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
  tags: string[];
}

interface CatalogData {
  products: Flower[];
  tagLabels: Record<string, string>;
  occasions: Occasion[];
}

interface FlowerSearch {
  kind: Flower['kind'] | null;
  occasionTags: readonly string[] | undefined;
  term: string;
  sort: string;
}

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase('it').normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const CATALOG_URL = new InjectionToken<string>('Catalog URL', {
  providedIn: 'root',
  factory: () => '/api/catalog',
});

const catalogState = makeStateKey<CatalogData | null>('flowerbro.catalog');

@Injectable({ providedIn: 'root' })
export class FlowerService {
  private readonly url = inject(CATALOG_URL);
  private readonly transfer = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, { optional: true });
  private readonly catalog = signal<CatalogData | null>(null);
  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();
  readonly unavailable = computed(() => this.catalog() === null);
  readonly occasions = computed(() => this.catalog()?.occasions ?? []);
  readonly tagLabels = computed(() => this.catalog()?.tagLabels ?? {});

  private readonly searchableFlowers = computed(() => {
    const labels = this.tagLabels();
    return this.getAll().map(flower => ({
      flower,
      text: normalize([
        flower.name,
        flower.kind === 'bouquet' ? 'bouquet' : 'fiore singolo',
        flower.composition,
        ...flower.tags.map(tag => labels[tag] ?? tag),
      ].join(' ')),
    }));
  });

  async initialize(): Promise<void> {
    if (this.isServer && !this.request) return;
    if (this.transfer.hasKey(catalogState)) {
      this.catalog.set(this.transfer.get(catalogState, null));
      this.transfer.remove(catalogState);
      return;
    }
    await this.reload();
    if (this.isServer) this.transfer.set(catalogState, this.catalog());
  }

  async reload(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const response = await fetch(this.url, { signal: AbortSignal.timeout(6_000) });
      if (!response.ok) return;
      const catalog: CatalogData = await response.json();
      if (Array.isArray(catalog?.products) && Array.isArray(catalog.occasions) && catalog.tagLabels) {
        this.catalog.set(catalog);
      }
    } catch {
      // Retain the last catalog if a refresh fails.
    } finally {
      this.loading.set(false);
    }
  }

  getAll(): Flower[] {
    return this.catalog()?.products ?? [];
  }

  getFlowerById(flowerId: string): Flower | undefined {
    return this.getAll().find(flower => flower.id === flowerId);
  }

  getRelated(flower: Flower): Flower[] {
    return this.getAll().filter(item => item.kind === flower.kind && item.id !== flower.id);
  }

  search({ kind, occasionTags, term, sort }: FlowerSearch): Flower[] {
    const terms = normalize(term).split(/\s+/).filter(Boolean);
    const flowers = this.searchableFlowers()
      .filter(({ flower, text }) =>
        (!kind || flower.kind === kind) &&
        (!occasionTags || occasionTags.some(tag => flower.tags.includes(tag))) &&
        terms.every(word => text.includes(word))
      )
      .map(({ flower }) => flower);

    switch (sort) {
      case 'price-ascending': return flowers.sort((a, b) => a.price - b.price);
      case 'price-descending': return flowers.sort((a, b) => b.price - a.price);
      case 'rating': return flowers.sort((a, b) => b.stars - a.stars);
      default: return flowers;
    }
  }
}
