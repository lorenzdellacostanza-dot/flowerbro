export class Flower {
  id!: string;
  name!: string;
  kind!: 'bouquet' | 'stem';
  price!: number;
  tags!: string[];
  stars!: number;
  imageUrl!: string;
  origins!: string[];
  stockQuantity!: number | null;
  deliveryTime!: string | null;
  description!: string | null;
  composition!: string | null;
}
