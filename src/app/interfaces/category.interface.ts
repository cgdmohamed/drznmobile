export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: {
    id: number;
    date_created: string;
    date_modified: string;
    src: string;
    name: string;
    alt: string;
  };
  menu_order: number;
  count: number;
  _links: {
    self: {
      href: string;
    }[];
    collection: {
      href: string;
    }[];
  };
}