import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService } from '../../../services/account.service';
import { Icon } from '../../partials/icon/icon';

@Component({
  selector: 'app-account',
  imports: [RouterLink, Icon],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly account = inject(AccountService);
  protected readonly register = inject(ActivatedRoute).snapshot.data['mode'] === 'register';
  protected readonly pending = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly error = signal('');

  protected async signOut(): Promise<void> {
    if (this.account.signingOut()) return;

    this.error.set('');
    const error = await this.account.signOut();
    if (!this.destroyRef.destroyed && error) this.error.set(error);
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!this.account.ready() || this.pending()) return;

    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');

    if (this.register && !name) {
      this.error.set('Inserisci il tuo nome.');
      return;
    }

    this.error.set('');
    this.pending.set(true);
    this.passwordVisible.set(false);
    try {
      const error = this.register
        ? await this.account.register(name, email, password)
        : await this.account.signIn(email, password);

      if (this.destroyRef.destroyed) return;

      if (error) {
        this.error.set(error);
      } else {
        form.reset();
        await this.router.navigateByUrl('/profilo');
      }
    } finally {
      this.pending.set(false);
    }
  }
}
