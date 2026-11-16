import { Injectable } from '@angular/core';
import { flowerTagLabels, sample_flower, sample_tags } from '../../data';
import { Flower } from '../shared/models/Flower';
import { Tag } from '../shared/models/Tag';

interface FlowerSearch {
  kind: Flower['kind'] | null;
  occasionTags: readonly string[] | undefined;
  term: string;
  sort: string;
}

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase('it').normalize('NFD').replace(/\p{Diacritic}/gu, '');

@Injectable({ providedIn: 'root' })
export class FlowerService {
  private readonly searchableFlowers = sample_flower.map(flower => ({
    flower,
    text: normalize([
      flower.name,
      flower.kind === 'bouquet' ? 'bouquet' : 'fiore singolo',
      flower.composition,
      ...(flower.tags ?? []).map(tag => flowerTagLabels[tag] ?? tag),
    ].join(' ')),
  }));

  getAll(): Flower[] {
    return sample_flower;
  }

  getAllTags(): Tag[] {
    return sample_tags;
  }

  getAllFlowersByTag(tag: string): Flower[] {
    return tag === 'All'
      ? this.getAll()
      : this.getAll().filter(flower => flower.tags?.includes(tag));
  }

  getFlowerById(flowerId: string): Flower | undefined {
    return this.getAll().find(flower => flower.id === flowerId);
  }

  getRelated(flower: Flower): Flower[] {
    return this.getAll().filter(item => item.kind === flower.kind && item.id !== flower.id);
  }

  search({ kind, occasionTags, term, sort }: FlowerSearch): Flower[] {
    const terms = normalize(term).split(/\s+/).filter(Boolean);
    const flowers = this.searchableFlowers
      .filter(({ flower, text }) =>
        (!kind || flower.kind === kind) &&
        (!occasionTags || occasionTags.some(tag => flower.tags?.includes(tag))) &&
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
