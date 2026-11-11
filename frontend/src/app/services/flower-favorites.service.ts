import { afterNextRender, inject, Injectable, signal } from '@angular/core';
import { Flower } from '../shared/models/Flower';
import { FlowerService } from './flower.service';

@Injectable({ providedIn: 'root' })
export class FlowerFavoritesService {
  private readonly flowers = inject(FlowerService).getAll();
  private readonly favorites = signal<Partial<Record<string, boolean>>>({});

  constructor() {
    afterNextRender(() => {
      try {
        const favorites: Record<string, boolean> = {};
        for (const flower of this.flowers) {
          const saved = localStorage.getItem(this.storageKey(flower.id));
          if (saved === 'true' || saved === 'false') {
            favorites[flower.id] = saved === 'true';
          }
        }
        this.favorites.set(favorites);
      } catch {
        // Browser storage may be unavailable.
      }
    });
  }

  isFavorite(flower: Flower): boolean {
    return this.favorites()[flower.id] ?? flower.favorite;
  }

  toggle(flower: Flower): void {
    const favorite = !this.isFavorite(flower);
    this.favorites.update(favorites => ({ ...favorites, [flower.id]: favorite }));

    try {
      localStorage.setItem(this.storageKey(flower.id), String(favorite));
    } catch {
      // Keep the selection in memory when browser storage is unavailable.
    }
  }

  private storageKey(id: string): string {
    return `flowerbro.favorite.${id}`;
  }
}
