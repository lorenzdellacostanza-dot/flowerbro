import{Flower} from './app/shared/models/Flower';
import { Tag } from './app/shared/models/Tag';

export const sample_flower: Flower[] = [
    {
        id: '1',
        name: 'Rosa',
        price: 10,
        favorite: false,
        origins: ['Italy'],
        deliveryTime: '1–2 giorni',
        stars: 4.5,
        imageUrl: 'assets/flower_images/Rose.png',
        tags: ['romantic', 'classic'],
    },

    {
        id: '2',
        name: 'Tulipano',
        price: 8,
        favorite: false,
        origins: ['Netherlands'],
        stars: 4.0,
        imageUrl: 'assets/flower_images/Tulip.png',
        tags: ['spring', 'colorful'],
    },

    {
        id: '3',
        name: 'Orchidea',
        price: 15,
        favorite: false,
        origins: ['Thailand'],
        stars: 4.8,
        imageUrl: 'assets/flower_images/Orchid.png',
        tags: ['exotic', 'elegant'],
    },

    {
        id: '4',
        name: 'Girasole',
        price: 12,
        favorite: false,
        origins: ['United States'],
        stars: 4.2,
        imageUrl: 'assets/flower_images/Sunflower.png',
        tags: ['bright', 'cheerful'],
    },

    {
        id: '5',
        name: 'Margherita',
        price: 6,
        favorite: false,
        origins: ['Germany'],
        stars: 4.0,
        imageUrl: 'assets/flower_images/daisy.png',
        tags: ['simple', 'pure'],
    },

    {
        id: '6',
        name: 'Giglio',
        price: 10,
        favorite: false,
        origins: ['Japan'],
        stars: 4.5,
        imageUrl: 'assets/flower_images/Lily.png',
        tags: ['elegant', 'fragrant'],
    },
    
]
export const sample_tags: Tag[] = [
    { name: 'All', count: 6 },
    { name: 'romantic', count: 1 },
    { name: 'classic', count: 1 },
    { name: 'spring', count: 1 },
    { name: 'colorful', count: 1 },
    { name: 'exotic', count: 1 },
    { name: 'elegant', count: 2 },
    { name: 'bright', count: 1 },
    { name: 'cheerful', count: 1 },
    { name: 'simple', count: 1 },
    { name: 'pure', count: 1 },
    { name: 'fragrant', count: 1 }
];
