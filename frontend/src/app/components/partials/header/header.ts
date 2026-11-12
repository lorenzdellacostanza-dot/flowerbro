import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { DemoAccountService } from '../../../services/demo-account.service';
import { Icon } from '../icon/icon';

@Component({
  imports: [RouterLink, RouterLinkActive, Icon],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeOnEscape()',
  },
})
export class Header {
  protected readonly cart = inject(CartService);
  protected readonly account = inject(DemoAccountService);
  protected readonly accountOpen = signal(false);
  protected readonly activeOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'exact',
  };

  private readonly accountArea = viewChild.required<ElementRef<HTMLElement>>('accountArea');
  private readonly accountButton = viewChild.required<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly document = inject(DOCUMENT);

  protected focusSearch(): void {
    const field = this.document.getElementById('cerca-fiori');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'center' });
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.accountOpen() && !this.accountArea().nativeElement.contains(event.target as Node)) {
      this.accountOpen.set(false);
    }
  }

  protected closeOnEscape(): void {
    if (this.accountOpen()) {
      this.accountOpen.set(false);
      this.accountButton().nativeElement.focus();
    }
  }

  protected signOut(): void {
    this.account.signOut();
    this.closeOnEscape();
  }
}
