import type { CollectionItem } from './collection-item';
import type { Photocard } from './photocard';
import type { Plushie } from './plushie';
import type { Ticket } from './ticket';

export type AlbumInclusion = CollectionItem & {
  type: 'albumInclusion';
};

export type OtherCollectible = CollectionItem & {
  type: 'other';
};

export type Collectible =
  | Photocard
  | Plushie
  | Ticket
  | AlbumInclusion
  | OtherCollectible;
