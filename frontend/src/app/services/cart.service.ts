import { afterNextRender, computed, inject, Injectable, signal } from '@angular/core';
import { FlowerService } from './flower.service';

const storageKey = 'flowerbro.cart';
type Quantities = Partial<Record<string, number>>;

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly flowers = inject(FlowerService).getAll();
  private readonly quantities = signal<Quantities>({});

  readonly items = computed(() => this.flowers.flatMap(flower => {
    const quantity = this.quantity(flower.id);
    return quantity > 0 ? [{ flower, quantity, subtotal: flower.price * quantity }] : [];
  }));
  readonly count = computed(() => this.items().reduce((count, item) => count + item.quantity, 0));
  readonly total = computed(() => this.items().reduce((total, item) => total + item.subtotal, 0));

  constructor() {
    afterNextRender(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return;

        const saved: unknown = JSON.parse(stored);
        if (!saved || typeof saved !== 'object') return;

        const quantities: Record<string, number> = {};
        for (const { id } of this.flowers) {
          const quantity = (saved as Record<string, unknown>)[id];
          if (typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0) {
            quantities[id] = quantity;
          }
        }
        this.quantities.set(quantities);
      } catch {
        // Keep an empty cart if browser storage cannot be read.
      }
    });
  }

  quantity(flowerId: string): number {
    return this.quantities()[flowerId] ?? 0;
  }

  add(flowerId: string): void {
    this.setQuantity(flowerId, this.quantity(flowerId) + 1);
  }

  remove(flowerId: string): void {
    this.setQuantity(flowerId, 0);
  }

  setQuantity(flowerId: string, quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || !this.flowers.some(flower => flower.id === flowerId)) {
      return;
    }

    const quantities = { ...this.quantities() };
    if (quantity > 0) {
      quantities[flowerId] = quantity;
    } else {
      delete quantities[flowerId];
    }
    this.saveQuantities(quantities);
  }

  clear(): void {
    this.saveQuantities({});
  }

  private saveQuantities(quantities: Quantities): void {
    this.quantities.set(quantities);
    try {
      localStorage.setItem(storageKey, JSON.stringify(quantities));
    } catch {
      // Keep the cart usable for this session when browser storage is unavailable.
    }
  }
}
