export class Flower {
  id!: string;
  name!: string;
  kind!: 'bouquet' | 'stem';
  price!: number;
  tags?: string[];
  favorite!: boolean;
  stars!: number;
  imageUrl!: string;
  origins!: string[];
  deliveryTime?: string;
  description?: string;
  composition?: string;
}
