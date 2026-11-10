import { Injectable } from '@angular/core';
import { sample_flower } from '../../data';
import{ Flower } from '../shared/models/Flower';


@Injectable({
  providedIn: 'root'
})
export class FlowerService {

  constructor() { }

  getAll():Flower[] {
    return sample_flower;
  }
}