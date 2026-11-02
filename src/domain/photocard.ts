import type { CategoryValue } from './category';
import type { CollectionItem } from './collection-item';

export type Photocard = CollectionItem & {
  type: 'photocard';
  size: 'little' | 'medium' | 'large' | 'xlarge';
  photocardCategories: {
    group?: CategoryValue;
    member?: CategoryValue;
    album?: CategoryValue;
    version?: CategoryValue;
    era?: CategoryValue;
  };
};
