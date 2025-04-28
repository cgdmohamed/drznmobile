import { Product } from '../interfaces/product.interface';

// Demo data for products
export const demoProducts: Product[] = [
  {
    id: 1,
    name: 'Premium Headphones',
    slug: 'premium-headphones',
    permalink: 'https://example.com/product/premium-headphones',
    date_created: '2023-01-15T12:00:00',
    date_modified: '2023-01-15T12:00:00',
    type: 'simple',
    status: 'publish',
    featured: true,
    catalog_visibility: 'visible',
    description: '<p>These premium headphones deliver crystal clear sound with noise-cancellation technology. Perfect for music lovers and professionals alike.</p>',
    short_description: '<p>Premium noise-cancelling headphones</p>',
    sku: 'HDPH-001',
    price: '299.99',
    regular_price: '349.99',
    sale_price: '299.99',
    date_on_sale_from: '2023-01-01T00:00:00',
    date_on_sale_to: '2023-12-31T00:00:00',
    on_sale: true,
    purchasable: true,
    total_sales: 156,
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: 0,
    download_expiry: 0,
    tax_status: 'taxable',
    tax_class: '',
    manage_stock: true,
    stock_quantity: 50,
    stock_status: 'instock',
    backorders: 'no',
    backorders_allowed: false,
    backordered: false,
    sold_individually: false,
    weight: '0.5',
    dimensions: {
      length: '20',
      width: '15',
      height: '8'
    },
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: '',
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: '4.8',
    rating_count: 125,
    related_ids: [2, 3, 4],
    upsell_ids: [5, 6],
    cross_sell_ids: [],
    parent_id: 0,
    purchase_note: 'Thank you for purchasing our premium headphones!',
    categories: [
      {
        id: 1,
        name: 'Electronics',
        slug: 'electronics'
      },
      {
        id: 2,
        name: 'Audio',
        slug: 'audio'
      }
    ],
    tags: [
      {
        id: 1,
        name: 'Premium',
        slug: 'premium'
      },
      {
        id: 2,
        name: 'Noise-Cancelling',
        slug: 'noise-cancelling'
      }
    ],
    attributes: [
      {
        id: 1,
        name: 'Color',
        position: 0,
        visible: true,
        variation: true,
        options: ['Black', 'Silver', 'Gold']
      },
      {
        id: 2,
        name: 'Brand',
        position: 1,
        visible: true,
        variation: false,
        options: ['SonicWave']
      }
    ],
    variations: [],
    grouped_products: [],
    menu_order: 1,
    images: [
      {
        id: 101,
        date_created: '2023-01-15T12:00:00',
        date_modified: '2023-01-15T12:00:00',
        src: 'https://via.placeholder.com/800x600?text=Premium+Headphones',
        name: 'Premium Headphones',
        alt: 'Premium Headphones - Black'
      }
    ],
    meta_data: []
  },
  {
    id: 2,
    name: 'Smart Watch Pro',
    slug: 'smart-watch-pro',
    permalink: 'https://example.com/product/smart-watch-pro',
    date_created: '2023-02-01T10:30:00',
    date_modified: '2023-02-05T14:45:00',
    type: 'simple',
    status: 'publish',
    featured: true,
    catalog_visibility: 'visible',
    description: '<p>The Smart Watch Pro is the perfect fitness companion. With heart rate monitoring, GPS tracking, and water resistance up to 50 meters, it\'s ideal for any sport or activity.</p>',
    short_description: '<p>Premium smart watch with fitness tracking</p>',
    sku: 'SWTCH-002',
    price: '249.99',
    regular_price: '299.99',
    sale_price: '249.99',
    date_on_sale_from: '2023-02-01T00:00:00',
    date_on_sale_to: '2023-05-31T00:00:00',
    on_sale: true,
    purchasable: true,
    total_sales: 89,
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: 0,
    download_expiry: 0,
    tax_status: 'taxable',
    tax_class: '',
    manage_stock: true,
    stock_quantity: 35,
    stock_status: 'instock',
    backorders: 'no',
    backorders_allowed: false,
    backordered: false,
    sold_individually: false,
    weight: '0.2',
    dimensions: {
      length: '10',
      width: '5',
      height: '2'
    },
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: '',
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: '4.6',
    rating_count: 75,
    related_ids: [1, 3],
    upsell_ids: [],
    cross_sell_ids: [4],
    parent_id: 0,
    purchase_note: 'Thanks for purchasing the Smart Watch Pro!',
    categories: [
      {
        id: 1,
        name: 'Electronics',
        slug: 'electronics'
      },
      {
        id: 3,
        name: 'Wearables',
        slug: 'wearables'
      }
    ],
    tags: [
      {
        id: 3,
        name: 'Fitness',
        slug: 'fitness'
      },
      {
        id: 4,
        name: 'Waterproof',
        slug: 'waterproof'
      }
    ],
    attributes: [
      {
        id: 1,
        name: 'Color',
        position: 0,
        visible: true,
        variation: true,
        options: ['Black', 'White', 'Blue']
      },
      {
        id: 2,
        name: 'Brand',
        position: 1,
        visible: true,
        variation: false,
        options: ['TechFit']
      }
    ],
    variations: [],
    grouped_products: [],
    menu_order: 2,
    images: [
      {
        id: 103,
        date_created: '2023-02-01T10:30:00',
        date_modified: '2023-02-01T10:30:00',
        src: 'https://via.placeholder.com/800x600?text=Smart+Watch+Pro',
        name: 'Smart Watch Pro',
        alt: 'Smart Watch Pro - Black'
      }
    ],
    meta_data: []
  },
  {
    id: 3,
    name: 'Portable Bluetooth Speaker',
    slug: 'portable-bluetooth-speaker',
    permalink: 'https://example.com/product/portable-bluetooth-speaker',
    date_created: '2023-03-10T09:15:00',
    date_modified: '2023-03-15T11:20:00',
    type: 'simple',
    status: 'publish',
    featured: false,
    catalog_visibility: 'visible',
    description: '<p>This portable Bluetooth speaker delivers big sound in a compact package. With 20 hours of battery life and waterproof design, take your music anywhere.</p>',
    short_description: '<p>Compact waterproof Bluetooth speaker</p>',
    sku: 'SPKR-003',
    price: '79.99',
    regular_price: '99.99',
    sale_price: '79.99',
    date_on_sale_from: '2023-03-01T00:00:00',
    date_on_sale_to: '2023-04-30T00:00:00',
    on_sale: true,
    purchasable: true,
    total_sales: 210,
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: 0,
    download_expiry: 0,
    tax_status: 'taxable',
    tax_class: '',
    manage_stock: true,
    stock_quantity: 120,
    stock_status: 'instock',
    backorders: 'no',
    backorders_allowed: false,
    backordered: false,
    sold_individually: false,
    weight: '0.7',
    dimensions: {
      length: '15',
      width: '8',
      height: '8'
    },
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: '',
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: '4.5',
    rating_count: 185,
    related_ids: [1, 2],
    upsell_ids: [],
    cross_sell_ids: [],
    parent_id: 0,
    purchase_note: 'Enjoy your new Bluetooth speaker!',
    categories: [
      {
        id: 1,
        name: 'Electronics',
        slug: 'electronics'
      },
      {
        id: 2,
        name: 'Audio',
        slug: 'audio'
      }
    ],
    tags: [
      {
        id: 4,
        name: 'Waterproof',
        slug: 'waterproof'
      },
      {
        id: 5,
        name: 'Portable',
        slug: 'portable'
      }
    ],
    attributes: [
      {
        id: 1,
        name: 'Color',
        position: 0,
        visible: true,
        variation: true,
        options: ['Red', 'Blue', 'Black']
      },
      {
        id: 2,
        name: 'Brand',
        position: 1,
        visible: true,
        variation: false,
        options: ['SoundBox']
      }
    ],
    variations: [],
    grouped_products: [],
    menu_order: 3,
    images: [
      {
        id: 104,
        date_created: '2023-03-10T09:15:00',
        date_modified: '2023-03-10T09:15:00',
        src: 'https://via.placeholder.com/800x600?text=Bluetooth+Speaker',
        name: 'Bluetooth Speaker',
        alt: 'Bluetooth Speaker - Red'
      }
    ],
    meta_data: []
  }
];