import { inject, Injectable } from '@angular/core';
import { CartService } from './cart.service';

interface DeliveryDetails {
  recipient: string;
  street: string;
  city: string;
}

export interface CheckoutReceipt {
  count: number;
  total: number;
}

type CheckoutResult =
  | { status: 'empty-cart' | 'incomplete-delivery' }
  | { status: 'confirmed'; receipt: CheckoutReceipt };

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly cart = inject(CartService);

  confirmOrder({ recipient, street, city }: DeliveryDetails): CheckoutResult {
    const count = this.cart.count();
    if (!count) return { status: 'empty-cart' };
    if (!recipient.trim() || !street.trim() || !city.trim()) {
      return { status: 'incomplete-delivery' };
    }

    const receipt = { count, total: this.cart.total() };
    this.cart.clear();
    return { status: 'confirmed', receipt };
  }
}
