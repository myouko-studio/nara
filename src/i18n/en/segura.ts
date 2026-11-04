import { baseTranslations } from '../base-translations';
import type { Translation } from '../types';

export const translations: Translation = {
  ...baseTranslations.en,
  personality: {
    ...baseTranslations.en.personality,
    voices: {
      ...baseTranslations.en.personality.voices,
      segura: {
        greeting: '53 categories? Interesting.',
        guardian: "I'll assume this photocard is different from the others.",
        universe: "I don't need an explanation. I know you'll have one.",
        map: 'Another change? I am listening.',
      },
    },
  },
};
