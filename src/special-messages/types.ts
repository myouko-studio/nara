import type { Language } from '@/i18n/types';

export type SpecialMessageBlockKind =
  | 'title'
  | 'shout'
  | 'emphasis'
  | 'decoration'
  | 'body'
  | 'signature';

export type SpecialMessageBlock = {
  kind: SpecialMessageBlockKind;
  text: string;
};

export type LocalizedSpecialMessage = {
  imageDescription: string;
  blocks: SpecialMessageBlock[];
  buttonLabel: string;
};

export type SpecialMessageResource = {
  id: string;
  locales: Record<Language, LocalizedSpecialMessage>;
};

export type SpecialMessageId = 'firstCollectionItem';
