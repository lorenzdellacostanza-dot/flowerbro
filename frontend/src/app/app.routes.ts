import { Routes } from '@angular/router';
import { CartPageComponent } from './components/pages/cart-page/cart-page.component';
import { FlowerPageComponent } from './components/pages/flower-page/flower-page.component';
import { HomeComponent } from './components/pages/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full', title: 'Flower Bro' },
  { path: 'flower/:id', component: FlowerPageComponent, title: 'Dettaglio fiore | Flower Bro' },
  { path: 'cart-page', component: CartPageComponent, title: 'Carrello | Flower Bro' }
];
