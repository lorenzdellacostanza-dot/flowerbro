import { ViewportScroller } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Header } from './components/partials/header/header';
import { Icon } from './components/partials/icon/icon';

@Component({
  imports: [RouterOutlet, RouterLink, Header, Icon],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  constructor() {
    inject(ViewportScroller).setOffset([0, 92]);
  }
}
