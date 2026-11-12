import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-cart-page',
  imports: [CurrencyPipe, RouterLink, Icon],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.css',
})
export class CartPageComponent {
  protected readonly cart = inject(CartService);
}
