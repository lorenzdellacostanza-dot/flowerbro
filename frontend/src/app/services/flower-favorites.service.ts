import { afterNextRender, computed, inject, Injectable, signal } from '@angular/core';
import { Flower } from '../shared/models/Flower';
import { FlowerService } from './flower.service';

const storagePrefix = 'flowerbro.favorite.';

@Injectable({ providedIn: 'root' })
export class FlowerFavoritesService {
  private readonly flowers = inject(FlowerService);
  private readonly favorites = signal<Partial<Record<string, boolean>>>({});

  readonly selectedFlowers = computed(() => this.flowers.getAll().filter(flower => this.isFavorite(flower)));

  constructor() {
    afterNextRender(() => {
      try {
        const favorites: Record<string, boolean> = {};
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith(storagePrefix) && localStorage.getItem(key) === 'true') {
            const id = key.slice(storagePrefix.length);
            if (/^[1-9][0-9]{0,18}$/.test(id)) favorites[id] = true;
          }
        }
        this.favorites.set(favorites);
      } catch {
        // Browser storage may be unavailable.
      }
    });
  }

  isFavorite(flower: Flower): boolean {
    return this.favorites()[flower.id] === true;
  }

  toggle(flower: Flower): void {
    const favorite = !this.isFavorite(flower);
    this.favorites.update(favorites => ({ ...favorites, [flower.id]: favorite }));

    try {
      localStorage.setItem(storagePrefix + flower.id, String(favorite));
    } catch {
      // Keep the selection in memory when browser storage is unavailable.
    }
  }
}
