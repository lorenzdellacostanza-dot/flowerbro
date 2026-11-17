import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../../services/account.service';
import { CartService } from '../../../services/cart.service';
import { CheckoutService, type CheckoutReceipt } from '../../../services/checkout.service';
import { FlowerService } from '../../../services/flower.service';
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
  protected readonly catalog = inject(FlowerService);
  protected readonly email = signal<string | null>(null);
  protected readonly receipt = signal<CheckoutReceipt | null>(null);
  protected readonly error = signal('');
  protected readonly pending = signal(false);

  protected async placeOrder(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.receipt() || this.pending()) return;

    const data = new FormData(event.currentTarget as HTMLFormElement);
    this.error.set('');
    this.pending.set(true);
    const result = await this.checkout.confirmOrder({
      recipient: String(data.get('recipient') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      street: String(data.get('street') ?? '').trim(),
      city: String(data.get('city') ?? '').trim(),
      postcode: String(data.get('postcode') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    });
    this.pending.set(false);
    if (result.status === 'confirmed') {
      this.receipt.set(result.receipt);
    } else {
      this.error.set(result.error);
    }
  }
}
