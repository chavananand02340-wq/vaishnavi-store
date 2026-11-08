/** Catalogue shapes. Database rows keep snake_case; view models for the UI use camelCase. */

export type Variant = {
  id: string;
  label: string;
  price_paise: number;
  mrp_paise: number | null;
  sale_price_paise: number | null;
  sale_ends_at: string | null;
  stock_qty: number;
  is_active: boolean;
  sort_order: number;
};

export type ProductImage = { id?: string; storage_path: string; sort_order: number };

export type Product = {
  id: string;
  name: string;
  name_local?: string | null;
  description: string | null;
  search_keywords?: string | null;
  category_id: string;
  is_active: boolean;
  is_featured: boolean;
  product_variants: Variant[];
  product_images: ProductImage[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  image_path: string | null;
};

/** Plain, serialisable product for client components (prices already worked out). */
export type CardVariant = { id: string; label: string; price: number; compare: number | null; stock: number };
export type CardProduct = {
  id: string;
  name: string;
  nameLocal: string | null;
  image: string | null;
  categoryId: string;
  featured: boolean;
  variants: CardVariant[];
};

/** Sliding photo banner on the home page. */
export type Banner = { id: string; image: string; link: string | null; alt: string | null };
