import { afterNextRender, Injectable, signal } from '@angular/core';

interface Profile {
  name: string;
  email: string;
}

interface DemoProfile extends Profile {
  salt: string;
  verifier: string;
}

interface DemoState {
  profiles: DemoProfile[];
  activeEmail: string | null;
}

const storageKey = 'flowerbro.demo-account.v1';

@Injectable({ providedIn: 'root' })
export class DemoAccountService {
  private readonly activeProfile = signal<Profile | null>(null);
  readonly profile = this.activeProfile.asReadonly();

  constructor() {
    afterNextRender(() => {
      try {
        this.showProfile(this.readState());
      } catch {
        // The browser can block storage for this site.
      }
    });
  }

  async register(name: string, email: string, password: string): Promise<string | null> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await this.deriveVerifier(password, salt);
    const state = this.readState();
    if (state.profiles.some(profile => profile.email === email)) {
      return 'Esiste già un account demo con questa email.';
    }

    state.profiles.push({ name, email, verifier, salt: btoa(String.fromCharCode(...salt)) });
    this.saveState({ ...state, activeEmail: email });
    return null;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const profile = this.readState().profiles.find(profile => profile.email === email);
    if (!profile) return 'Email o password errata.';

    const salt = Uint8Array.from(atob(profile.salt), char => char.charCodeAt(0));
    const verifier = await this.deriveVerifier(password, salt);
    if (verifier !== profile.verifier) return 'Email o password errata.';

    this.saveState({ ...this.readState(), activeEmail: email });
    return null;
  }

  signOut(): void {
    try {
      this.saveState({ ...this.readState(), activeEmail: null });
    } catch {
      this.activeProfile.set(null);
    }
  }

  private readState(): DemoState {
    const raw = localStorage.getItem(storageKey);
    try {
      const state: Partial<DemoState> | null = JSON.parse(raw ?? 'null');
      return {
        profiles: Array.isArray(state?.profiles) ? state.profiles.filter(profile =>
          profile && typeof profile.name === 'string' && typeof profile.email === 'string' &&
          typeof profile.salt === 'string' && typeof profile.verifier === 'string'
        ) : [],
        activeEmail: typeof state?.activeEmail === 'string' ? state.activeEmail : null,
      };
    } catch {
      return { profiles: [], activeEmail: null };
    }
  }

  private saveState(state: DemoState): void {
    localStorage.setItem(storageKey, JSON.stringify(state));
    this.showProfile(state);
  }

  private showProfile(state: DemoState): void {
    const profile = state.profiles.find(profile => profile.email === state.activeEmail);
    this.activeProfile.set(profile ? { name: profile.name, email: profile.email } : null);
  }

  private async deriveVerifier(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 }, key, 256,
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  }
}
