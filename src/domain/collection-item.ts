import type { CategoryValue } from './category';

export type CollectionItem = {
  id: string;
  imageUri: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  owned: boolean;
  wanted: boolean;
  isCatalogued: boolean;
  quantity: number;
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  notes?: string;
  itemEvent?: CategoryValue;
  acquisitionEvent?: CategoryValue;
  customCategories: CategoryValue[];
};
