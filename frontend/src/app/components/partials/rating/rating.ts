import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-rating',
  imports: [DecimalPipe],
  template: `
    <span class="rating" role="img" [attr.aria-label]="'Valutazione ' + (value() | number:'1.1-1') + ' su 5'">
      <span class="stars" aria-hidden="true" [style.--rating]="value()">
        ★★★★★<span class="stars-fill">★★★★★</span>
      </span>
      <span class="rating-number" aria-hidden="true">{{ value() | number:'1.1-1' }}</span>
    </span>
  `,
  styles: [`
    .rating { display: inline-flex; align-items: center; gap: .4rem; }
    .stars {
      position: relative;
      display: inline-block;
      color: #d9cfc6;
      font: 400 .9rem/1.2 system-ui, sans-serif;
      letter-spacing: .07em;
      white-space: nowrap;
    }
    .stars-fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: clamp(0%, calc(var(--rating) * 20%), 100%);
      overflow: hidden;
      color: #a35f21;
    }
    .rating-number { color: var(--muted); font-size: .8rem; font-weight: 700; }
  `],
})
export class Rating {
  readonly value = input.required<number>();
}
