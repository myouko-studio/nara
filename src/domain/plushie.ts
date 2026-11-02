import type { CategoryValue } from './category';
import type { CollectionItem } from './collection-item';

export type Plushie = CollectionItem & {
  type: 'plushie';
  plushieCategories: {
    character?: CategoryValue;
    edition?: CategoryValue;
  };
};
