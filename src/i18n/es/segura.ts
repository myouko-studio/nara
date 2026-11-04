import { baseTranslations } from '../base-translations';
import type { Translation } from '../types';

export const translations: Translation = {
  ...baseTranslations.es,
  personality: {
    ...baseTranslations.es.personality,
    voices: {
      ...baseTranslations.es.personality.voices,
      segura: {
        greeting: '¿53 categorías? Interesante.',
        guardian: 'Voy a asumir que esta photocard es distinta de las demás.',
        universe: 'No necesito una explicación. Sé que vas a tener una.',
        map: '¿Otro cambio? Te escucho.',
      },
    },
  },
};
