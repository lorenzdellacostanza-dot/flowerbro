import { afterNextRender, Injectable, signal } from '@angular/core';

interface Profile {
  name: string;
  email: string;
}

interface Credentials {
  email: string;
  password: string;
  name?: string;
}

const accountPath = '/api/account';
const serviceUnavailable = 'Il servizio account non è disponibile. Riprova tra poco.';
const logoutFailed = 'Non è stato possibile uscire. Riprova tra poco.';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly activeProfile = signal<Profile | null>(null);
  private readonly initialCheckComplete = signal(false);
  private readonly logoutPending = signal(false);
  readonly profile = this.activeProfile.asReadonly();
  readonly ready = this.initialCheckComplete.asReadonly();
  readonly signingOut = this.logoutPending.asReadonly();

  constructor() {
    afterNextRender(() => {
      try {
        localStorage.removeItem('flowerbro.demo-account.v1');
      } catch {
        // Some browsers restrict access to local storage.
      }
      void this.loadSession();
    });
  }

  register(name: string, email: string, password: string): Promise<string | null> {
    return this.authenticate('register', { name, email, password });
  }

  signIn(email: string, password: string): Promise<string | null> {
    return this.authenticate('login', { email, password });
  }

  async signOut(): Promise<string | null> {
    this.logoutPending.set(true);
    try {
      const response = await this.post('logout', {});
      if (response.status !== 204) return this.readError(response, logoutFailed);
      this.activeProfile.set(null);
      return null;
    } catch {
      return logoutFailed;
    } finally {
      this.logoutPending.set(false);
    }
  }

  private async loadSession(): Promise<void> {
    try {
      const response = await fetch(accountPath, {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) this.activeProfile.set(await this.readProfile(response));
    } catch {
      // Login remains available when the initial session check fails.
    } finally {
      this.initialCheckComplete.set(true);
    }
  }

  private async authenticate(action: 'register' | 'login', credentials: Credentials): Promise<string | null> {
    try {
      const response = await this.post(action, credentials);
      if (!response.ok) return this.readError(response, serviceUnavailable);
      const profile = await this.readProfile(response);
      if (!profile) return serviceUnavailable;
      this.activeProfile.set(profile);
      return null;
    } catch {
      return serviceUnavailable;
    }
  }

  private post(action: 'register' | 'login' | 'logout', body: object): Promise<Response> {
    return fetch(accountPath + '/' + action, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async readProfile(response: Response): Promise<Profile | null> {
    const data: { profile?: Partial<Profile> | null } | null = await response.json();
    const profile = data?.profile;
    return profile && typeof profile.name === 'string' && typeof profile.email === 'string'
      ? { name: profile.name, email: profile.email }
      : null;
  }

  private async readError(response: Response, fallback: string): Promise<string> {
    if (response.status === 429) return 'Troppi tentativi. Riprova tra poco.';
    if (response.status >= 500) return fallback;
    const data: { error?: unknown } | null = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }
}
