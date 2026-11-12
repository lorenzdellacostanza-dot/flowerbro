import { Component, input } from '@angular/core';

type IconName =
  | 'account' | 'arrow-left' | 'arrow-right' | 'bag' | 'check' | 'chevron'
  | 'clock' | 'close' | 'eye' | 'eye-off' | 'flower' | 'heart' | 'minus' | 'plus'
  | 'search' | 'trash';

@Component({
  selector: 'app-icon',
  styles: [`
    :host { display: inline-flex; vertical-align: middle; flex: none; }
    svg { width: var(--icon-size, 1.25rem); height: var(--icon-size, 1.25rem); }
  `],
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('account') {
          <circle cx="12" cy="12" r="9.2" />
          <circle cx="12" cy="9.1" r="2.6" />
          <path d="M6.4 18.7c.3-2.6 2.8-4.3 5.6-4.3s5.3 1.7 5.6 4.3" />
        }
        @case ('arrow-left') { <path d="M19 12H5m6-6-6 6 6 6" /> }
        @case ('arrow-right') { <path d="M5 12h14m-6-6 6 6-6 6" /> }
        @case ('bag') {
          <path d="M5 8h14l1 12H4L5 8Z" />
          <path d="M9 10V6a3 3 0 1 1 6 0v4" />
        }
        @case ('check') { <path d="m5 12 4 4L19 6" /> }
        @case ('chevron') { <path d="m7 10 5 5 5-5" /> }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18" /> }
        @case ('eye') {
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        }
        @case ('eye-off') {
          <path d="m3 3 18 18M10 6.2c.6-.1 1.3-.2 2-.2 6 0 9.5 6 9.5 6s-.8 1.4-2.3 2.8M6.1 7.9C3.8 9.6 2.5 12 2.5 12s3.5 6 9.5 6c1.7 0 3.3-.5 4.6-1.2" />
        }
        @case ('flower') {
          <path d="M12 12c-3.5-3.5-7.9-5.7-8.6-1.5-.4 2.2 1.8 3.4 4.1 3.4-1.8 1.5-2.4 3.8-.7 5.3 2.9 2.5 5.2-1.4 5.2-5.3 0 3.9 2.3 7.8 5.2 5.3 1.7-1.5 1.1-3.8-.7-5.3 2.3 0 4.5-1.2 4.1-3.4-.7-4.2-5.1-2-8.6 1.5Z" />
          <path d="M12 12C7.4 7 8.4 3.7 12 3.7S16.6 7 12 12Z" />
        }
        @case ('heart') { <path d="M20.7 5.5a5.2 5.2 0 0 0-7.3 0L12 6.8l-1.4-1.3a5.2 5.2 0 0 0-7.3 7.4l1.4 1.4 7.3 7 7.3-7 1.4-1.4a5.2 5.2 0 0 0 0-7.4Z" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('search') { <circle cx="10.8" cy="10.8" r="6.1" /><path d="m15.2 15.2 4.3 4.3" /> }
        @case ('trash') {
          <path d="M4.5 7h15M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5m4-5v5" />
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
