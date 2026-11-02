import { translations as enDelulu } from './en/delulu';
import { translations as enNara } from './en/nara';
import { translations as enSerena } from './en/serena';
import { translations as esDelulu } from './es/delulu';
import { translations as esNara } from './es/nara';
import { translations as esSerena } from './es/serena';
import type { Language, Personality, Pronoun, Translation } from './types';

export const translations = {
  es: {
    serena: esSerena,
    nara: esNara,
    delulu: esDelulu,
  },
  en: {
    serena: enSerena,
    nara: enNara,
    delulu: enDelulu,
  },
} satisfies Record<Language, Record<Personality, Translation>>;

export type { Language, Personality, Pronoun, Translation };
