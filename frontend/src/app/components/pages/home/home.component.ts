import { afterNextRender, ChangeDetectorRef, Component } from '@angular/core';
import { FlowerService } from '../../../services/flower.service';
import { Flower } from '../../../shared/models/Flower';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  flowers: Flower[];

  constructor(flowerService: FlowerService, changeDetector: ChangeDetectorRef) {
    this.flowers = flowerService.getAll();

    afterNextRender(() => {
      try {
        for (const flower of this.flowers) {
          const saved = localStorage.getItem(this.favoriteKey(flower.id));
          if (saved === 'true' || saved === 'false') {
            flower.favorite = saved === 'true';
          }
        }
      } catch {
        // Browser storage may be unavailable.
      }
      changeDetector.markForCheck();
    });
  }

  protected toggleFavorite(flower: Flower): void {
    flower.favorite = !flower.favorite;

    try {
      localStorage.setItem(this.favoriteKey(flower.id), String(flower.favorite));
    } catch {
      // Keep the selection in memory when browser storage is unavailable.
    }
  }

  private favoriteKey(id: string): string {
    return `flowerbro.favorite.${id}`;
  }
}
