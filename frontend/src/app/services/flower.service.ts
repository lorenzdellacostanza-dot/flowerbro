import { Injectable } from '@angular/core';
import { sample_flower, sample_tags } from '../../data';import{ Flower } from '../shared/models/Flower';
import { Tag } from '../shared/models/Tag';

@Injectable({
  providedIn: 'root'
})
export class FlowerService {

  constructor() { }

  getAll():Flower[] {
    return sample_flower;
  }
 getAllTags(): Tag[] {
  return sample_tags;
}
getAllFlowersByTag(tag: string): Flower[] {
  return tag === "All" ?
    this.getAll() :
    this.getAll().filter(flower => flower.tags?.includes(tag));
}

  getFlowerById(flowerId: string): Flower | undefined {
    return this.getAll().find(flower => flower.id === flowerId);
  }
}