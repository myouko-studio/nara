import type { CategoryValue } from './category';
import type { CollectionItem } from './collection-item';

export type Ticket = CollectionItem & {
  type: 'ticket';
  ticketCategories: {
    venue?: CategoryValue;
    city?: CategoryValue;
  };
  eventDate?: string;
};
