import { afterNextRender, computed, inject, Injectable, signal } from '@angular/core';
import { Flower } from '../shared/models/Flower';
import { FlowerService } from './flower.service';

const storageKey = 'flowerbro.cart';
const maxQuantity = 2_147_483_647;
type Quantities = Partial<Record<string, number>>;

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly flowers = inject(FlowerService);
  private readonly quantities = signal<Quantities>({});

  readonly items = computed(() => this.flowers.getAll().flatMap(flower => {
    const quantity = this.quantity(flower.id);
    return quantity > 0 ? [{ flower, quantity, subtotal: flower.price * quantity }] : [];
  }));
  readonly count = computed(() => this.items().reduce((count, item) => count + item.quantity, 0));
  readonly total = computed(() => this.items().reduce((total, item) => total + item.subtotal, 0));
  readonly missingItems = computed(() => !this.flowers.unavailable() &&
    Object.keys(this.quantities()).some(id => !this.flowers.getFlowerById(id)));
  readonly exceedsStock = computed(() => this.items().some(({ flower, quantity }) =>
    flower.stockQuantity !== null && quantity > flower.stockQuantity));

  constructor() {
    afterNextRender(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return;

        const saved: unknown = JSON.parse(stored);
        if (!saved || typeof saved !== 'object') return;

        const quantities: Record<string, number> = {};
        for (const [id, quantity] of Object.entries(saved)) {
          if (/^[1-9][0-9]{0,18}$/.test(id) && typeof quantity === 'number'
              && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= maxQuantity) {
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

  availableToAdd(flower: Flower): number {
    return Math.max(0, (flower.stockQuantity ?? maxQuantity) - this.quantity(flower.id));
  }

  add(flowerId: string, amount = 1): void {
    this.setQuantity(flowerId, this.quantity(flowerId) + amount);
  }

  decrease(flowerId: string): void {
    const quantity = this.quantity(flowerId);
    if (quantity > 1) this.setQuantity(flowerId, quantity - 1);
  }

  remove(flowerId: string): void {
    this.setQuantity(flowerId, 0);
  }

  setQuantity(flowerId: string, quantity: number): void {
    const flower = this.flowers.getFlowerById(flowerId);
    const current = this.quantity(flowerId);
    if (!flower || !Number.isSafeInteger(quantity) || quantity < 0
        || quantity - current > this.availableToAdd(flower)) {
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

  removeMissing(): void {
    if (!this.missingItems()) return;
    const quantities = { ...this.quantities() };
    for (const id of Object.keys(quantities)) {
      if (!this.flowers.getFlowerById(id)) delete quantities[id];
    }
    this.saveQuantities(quantities);
  }

  removePurchased(items: readonly { productId: string; quantity: number }[]): void {
    const quantities = { ...this.quantities() };
    for (const { productId, quantity } of items) {
      const remaining = (quantities[productId] ?? 0) - quantity;
      if (remaining > 0) {
        quantities[productId] = remaining;
      } else {
        delete quantities[productId];
      }
    }
    this.saveQuantities(quantities);
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
