import { inject, Injectable } from '@angular/core';
import { CartService } from './cart.service';
import { FlowerService } from './flower.service';

interface DeliveryDetails {
  recipient: string;
  email: string;
  street: string;
  city: string;
  postcode: string;
  message: string;
}

export interface CheckoutReceipt {
  id: string;
  count: number;
  total: number;
}

type CheckoutResult =
  | { status: 'error'; error: string }
  | { status: 'confirmed'; receipt: CheckoutReceipt };

interface OrderLine {
  productId: string;
  quantity: number;
  expectedPrice: number;
}

const unavailable = 'Impossibile verificare l’ordine. Riprova tra poco con gli stessi dati.';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly cart = inject(CartService);
  private readonly catalog = inject(FlowerService);
  private attempt?: { body: string; key: string };
  private submission?: Promise<CheckoutResult>;

  confirmOrder(delivery: DeliveryDetails): Promise<CheckoutResult> {
    if (this.submission) return this.submission;
    const items = this.cart.items().map(({ flower, quantity }) => ({
      productId: flower.id,
      quantity,
      expectedPrice: flower.price,
    }));
    if (!items.length || this.cart.missingItems() || this.cart.exceedsStock()) {
      return Promise.resolve({ status: 'error', error: 'Controlla i prodotti e le quantità nel carrello.' });
    }

    this.submission = this.submit(delivery, items).finally(() => {
      this.submission = undefined;
    });
    return this.submission;
  }

  private async submit(delivery: DeliveryDetails, items: OrderLine[]): Promise<CheckoutResult> {
    try {
      const body = JSON.stringify({ delivery, items });
      if (this.attempt?.body !== body) this.attempt = { body, key: crypto.randomUUID() };
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutKey: this.attempt.key, delivery, items }),
        signal: AbortSignal.timeout(17_000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await this.catalog.reload();
        return { status: 'error', error: typeof result?.error === 'string' ? result.error : unavailable };
      }
      if (typeof result?.id !== 'string' || !Number.isSafeInteger(result.count)
          || typeof result.total !== 'number' || !Number.isFinite(result.total)) {
        return { status: 'error', error: unavailable };
      }
      this.cart.removePurchased(items);
      this.attempt = undefined;
      void this.catalog.reload();
      return { status: 'confirmed', receipt: result };
    } catch {
      return { status: 'error', error: unavailable };
    }
  }
}
