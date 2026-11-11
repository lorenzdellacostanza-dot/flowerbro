import { Component, computed, inject, signal } from '@angular/core';
import { FlowerFavoritesService } from '../../../services/flower-favorites.service';
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

  protected readonly favorites = inject(FlowerFavoritesService);
  private readonly searchTerm = signal('');

  protected readonly visibleFlowers = computed(() => {
    const term = this.searchTerm();
    return this.flowers.filter(flower => flower.name.toLowerCase().includes(term));
  });

  constructor(flowerService: FlowerService) {
    this.flowers = flowerService.getAll();
  }

  protected searchFlowers(query: string): void {
    this.searchTerm.set(query.trim().toLowerCase());
  }

  protected clearSearchWhenEmpty(query: string): void {
    if (!query.trim()) {
      this.searchFlowers('');
    }
  }
}
