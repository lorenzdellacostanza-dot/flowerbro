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
  protected readonly navOpen = signal(false);
  protected readonly sectionMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'exact',
  };
  protected readonly catalogMatch: IsActiveMatchOptions = {
    ...this.sectionMatch,
    queryParams: 'subset',
  };

  private readonly document = inject(DOCUMENT);
  private readonly navigation = viewChild.required<ElementRef<HTMLElement>>('navigation');
  private readonly navButton = viewChild.required<ElementRef<HTMLButtonElement>>('navButton');
  private readonly accountArea = viewChild.required<ElementRef<HTMLElement>>('accountArea');
  private readonly accountButton = viewChild.required<ElementRef<HTMLButtonElement>>('accountButton');

  protected toggleNavigation(): void {
    this.accountOpen.set(false);
    this.navOpen.update(open => !open);
  }

  protected toggleAccount(): void {
    this.navOpen.set(false);
    this.accountOpen.update(open => !open);
  }

  protected focusSearch(): void {
    this.navOpen.set(false);
    const field = this.document.getElementById('cerca-fiori');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'center' });
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.accountOpen() && !this.accountArea().nativeElement.contains(target)) {
      this.accountOpen.set(false);
    }

    if (this.navOpen() && !this.navigation().nativeElement.contains(target) &&
        !this.navButton().nativeElement.contains(target)) {
      this.navOpen.set(false);
    }
  }

  protected closeOnEscape(): void {
    if (this.accountOpen()) {
      this.accountOpen.set(false);
      this.accountButton().nativeElement.focus();
    } else if (this.navOpen()) {
      this.navOpen.set(false);
      this.navButton().nativeElement.focus();
    }
  }

  protected signOut(): void {
    this.account.signOut();
    this.closeOnEscape();
  }
}
