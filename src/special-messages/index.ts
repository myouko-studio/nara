import { firstCollectionItemMessage } from './first-collection-item';
import type { SpecialMessageId, SpecialMessageResource } from './types';
import type { Language } from '@/i18n/types';

const specialMessages = {
  firstCollectionItem: firstCollectionItemMessage,
} satisfies Record<SpecialMessageId, SpecialMessageResource>;

export function getSpecialMessage(id: SpecialMessageId, language: Language) {
  return specialMessages[id].locales[language];
}

export type { SpecialMessageResource } from './types';
