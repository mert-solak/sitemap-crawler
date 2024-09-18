export interface Category {
  include: string;
  label: string;
  path: string;
  exclude?: string;
}

export interface CategorisedSitemap {
  name: string;
  path: string;
  data: string;
}
