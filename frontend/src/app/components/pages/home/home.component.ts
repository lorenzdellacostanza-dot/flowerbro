import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlowerService } from '../../../services/flower.service';
import { Icon } from '../../partials/icon/icon';
import { Catalog } from './catalog/catalog';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Catalog],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly occasions = inject(FlowerService).occasions;
}
