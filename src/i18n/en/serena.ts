import { baseTranslations } from '../base-translations';
import type { Translation } from '../types';

export const translations: Translation = {
  ...baseTranslations.en,
  personality: {
    ...baseTranslations.en.personality,
    voices: {
      ...baseTranslations.en.personality.voices,
      serena: {
        greeting: "Hiya! I'm Nara.",
        guardian: 'Guardian of your collection.',
        universe: 'Your collection is your universe.',
        map: 'I take care of the map.',
      },
    },
  },
};
