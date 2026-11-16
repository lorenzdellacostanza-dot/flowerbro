import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../../services/account.service';
import { CartService } from '../../../services/cart.service';
import { CheckoutService, type CheckoutReceipt } from '../../../services/checkout.service';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, RouterLink, Icon],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  private readonly checkout = inject(CheckoutService);
  protected readonly cart = inject(CartService);
  protected readonly account = inject(AccountService);
  protected readonly email = signal<string | null>(null);
  protected readonly receipt = signal<CheckoutReceipt | null>(null);
  protected readonly error = signal('');

  protected placeOrder(event: SubmitEvent): void {
    event.preventDefault();
    if (this.receipt()) return;

    const data = new FormData(event.currentTarget as HTMLFormElement);
    const result = this.checkout.confirmOrder({
      recipient: String(data.get('recipient') ?? ''),
      street: String(data.get('street') ?? ''),
      city: String(data.get('city') ?? ''),
    });
    if (result.status === 'incomplete-delivery') {
      this.error.set('Completa i dati di consegna.');
    } else if (result.status === 'confirmed') {
      this.receipt.set(result.receipt);
    }
  }
}
