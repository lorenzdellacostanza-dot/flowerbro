import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../../services/account.service';
import { CartService } from '../../../services/cart.service';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, RouterLink, Icon],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  protected readonly cart = inject(CartService);
  protected readonly account = inject(AccountService);
  protected readonly email = signal<string | null>(null);
  protected readonly receipt = signal<{ count: number; total: number } | null>(null);
  protected readonly error = signal('');

  protected placeOrder(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.cart.count() || this.receipt()) return;

    const data = new FormData(event.currentTarget as HTMLFormElement);
    const required = ['recipient', 'street', 'city'];
    if (required.some(field => !String(data.get(field) ?? '').trim())) {
      this.error.set('Completa i dati di consegna.');
      return;
    }

    this.receipt.set({ count: this.cart.count(), total: this.cart.total() });
    this.cart.clear();
  }
}
