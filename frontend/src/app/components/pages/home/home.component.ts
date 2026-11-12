import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../partials/icon/icon';
import { Catalog } from './catalog/catalog';
import { occasions } from './catalog/occasions';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Catalog],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly occasions = occasions;
}
