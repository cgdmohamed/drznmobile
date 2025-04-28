import { Category } from '../interfaces/category.interface';

// Demo data for categories
export const demoCategories: Category[] = [
  {
    id: 1,
    name: 'Electronics',
    slug: 'electronics',
    parent: 0,
    description: 'All electronic devices and gadgets',
    display: 'default',
    image: {
      id: 201,
      date_created: '2023-01-01T10:00:00',
      date_modified: '2023-01-01T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Electronics',
      name: 'Electronics Category',
      alt: 'Electronics Category'
    },
    menu_order: 1,
    count: 250,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/1'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  },
  {
    id: 2,
    name: 'Audio',
    slug: 'audio',
    parent: 1,
    description: 'Audio equipment including headphones, speakers, and microphones',
    display: 'default',
    image: {
      id: 202,
      date_created: '2023-01-02T10:00:00',
      date_modified: '2023-01-02T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Audio',
      name: 'Audio Category',
      alt: 'Audio Category'
    },
    menu_order: 2,
    count: 85,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/2'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  },
  {
    id: 3,
    name: 'Wearables',
    slug: 'wearables',
    parent: 1,
    description: 'Wearable technology including smartwatches and fitness trackers',
    display: 'default',
    image: {
      id: 203,
      date_created: '2023-01-03T10:00:00',
      date_modified: '2023-01-03T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Wearables',
      name: 'Wearables Category',
      alt: 'Wearables Category'
    },
    menu_order: 3,
    count: 45,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/3'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  },
  {
    id: 4,
    name: 'Televisions',
    slug: 'televisions',
    parent: 1,
    description: 'Smart TVs, 4K TVs, and other television equipment',
    display: 'default',
    image: {
      id: 204,
      date_created: '2023-01-04T10:00:00',
      date_modified: '2023-01-04T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Televisions',
      name: 'Televisions Category',
      alt: 'Televisions Category'
    },
    menu_order: 4,
    count: 30,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/4'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  },
  {
    id: 5,
    name: 'Smartphones',
    slug: 'smartphones',
    parent: 1,
    description: 'Latest smartphones and mobile devices',
    display: 'default',
    image: {
      id: 205,
      date_created: '2023-01-05T10:00:00',
      date_modified: '2023-01-05T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Smartphones',
      name: 'Smartphones Category',
      alt: 'Smartphones Category'
    },
    menu_order: 5,
    count: 75,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/5'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  },
  {
    id: 6,
    name: 'Accessories',
    slug: 'accessories',
    parent: 1,
    description: 'Accessories for all electronics including chargers, cases, and more',
    display: 'default',
    image: {
      id: 206,
      date_created: '2023-01-06T10:00:00',
      date_modified: '2023-01-06T10:00:00',
      src: 'https://via.placeholder.com/300x300?text=Accessories',
      name: 'Accessories Category',
      alt: 'Accessories Category'
    },
    menu_order: 6,
    count: 120,
    _links: {
      self: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories/6'
        }
      ],
      collection: [
        {
          href: 'https://example.com/wp-json/wc/v3/products/categories'
        }
      ]
    }
  }
];