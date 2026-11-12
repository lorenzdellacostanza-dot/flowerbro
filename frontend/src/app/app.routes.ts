import { Routes } from '@angular/router';
import { Account } from './components/pages/account/account';
import { CartPageComponent } from './components/pages/cart-page/cart-page.component';
import { Checkout } from './components/pages/checkout/checkout';
import { Favorites } from './components/pages/favorites/favorites';
import { FlowerPageComponent } from './components/pages/flower-page/flower-page.component';
import { HomeComponent } from './components/pages/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full', title: 'Flower Bro! | Catalogo di fiori' },
  { path: 'flower/:id', component: FlowerPageComponent, title: 'Dettaglio fiore | Flower Bro!' },
  { path: 'preferiti', component: Favorites, title: 'Preferiti | Flower Bro!' },
  { path: 'cart-page', component: CartPageComponent, title: 'Carrello | Flower Bro!' },
  { path: 'checkout', component: Checkout, title: 'Consegna | Flower Bro!' },
  { path: 'login', component: Account, title: 'Accedi | Flower Bro!' },
  { path: 'registrati', component: Account, title: 'Registrati | Flower Bro!', data: { mode: 'register' } },
  { path: 'profilo', component: Account, title: 'Profilo | Flower Bro!' },
  { path: '**', redirectTo: '' },
];
