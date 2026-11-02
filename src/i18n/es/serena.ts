import { baseTranslations } from '../base-translations';
import type { Translation } from '../types';

export const translations: Translation = {
  ...baseTranslations.es,
  personality: {
    ...baseTranslations.es.personality,
    voices: {
      ...baseTranslations.es.personality.voices,
      serena: {
        greeting: 'Hiya! Soy Nara.',
        guardian: 'Guardiana de tu colección.',
        universe: 'Tu colección es tu universo.',
        map: 'Yo cuido del mapa.',
      },
    },
  },
};
