import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  translations,
  type Language,
  type NaraOutfit,
  type Personality,
  type Pronoun,
} from './translations';

export type ThemePreference = 'light' | 'dark' | 'system';

type Preferences = {
  language: Language;
  theme: ThemePreference;
  outfit: NaraOutfit;
  personality: Personality;
  pronouns: Pronoun;
};

type StoredPreferences = Omit<Preferences, 'outfit'> & Partial<Pick<Preferences, 'outfit'>>;

type LanguageContextValue = Preferences & {
  isLoaded: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setOutfit: (outfit: NaraOutfit) => void;
  setPersonality: (personality: Personality) => void;
  setPronouns: (pronouns: Pronoun) => void;
};

const STORAGE_KEY = 'Nara.preferences';
const DEFAULT_PREFERENCES: Preferences = {
  language: 'es',
  theme: 'system',
  outfit: 'unicornio',
  personality: 'nara',
  pronouns: 'neutral',
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isPreferences(value: unknown): value is StoredPreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const preferences = value as Record<string, unknown>;

  return (
    (preferences.language === 'es' || preferences.language === 'en') &&
    (preferences.theme === 'light' ||
      preferences.theme === 'dark' ||
      preferences.theme === 'system') &&
    (preferences.personality === 'serena' ||
      preferences.personality === 'nara' ||
      preferences.personality === 'delulu' ||
      preferences.personality === 'segura') &&
    (preferences.pronouns === 'feminine' ||
      preferences.pronouns === 'masculine' ||
      preferences.pronouns === 'neutral') &&
    (preferences.outfit === undefined ||
      preferences.outfit === 'unicornio' ||
      preferences.outfit === 'capibara' ||
      preferences.outfit === 'algodon' ||
      preferences.outfit === 'cerezo' ||
      preferences.outfit === 'pato')
  );
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    ...DEFAULT_PREFERENCES,
    outfit: Appearance.getColorScheme() === 'dark' ? 'capibara' : 'unicornio',
  }));
  const [isLoaded, setIsLoaded] = useState(false);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      try {
        const storedPreferences = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedPreferences === null) {
          return;
        }

        const parsedPreferences: unknown = JSON.parse(storedPreferences);
        if (!isPreferences(parsedPreferences)) {
          throw new Error('Stored preferences have an invalid format.');
        }

        if (isMounted) {
          setPreferences({
            ...parsedPreferences,
            outfit:
              parsedPreferences.outfit ??
              (parsedPreferences.theme === 'dark' ||
              (parsedPreferences.theme === 'system' &&
                Appearance.getColorScheme() === 'dark')
                ? 'capibara'
                : 'unicornio'),
          });
        }
      } catch (error) {
        console.error('Unable to load Nara preferences.', error);
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }

    void loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preferences.theme === 'system' ? 'auto' : preferences.theme);
    }
  }, [preferences.theme]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)))
      .catch((error: unknown) => {
        console.error('Unable to save Nara preferences.', error);
      });
  }, [isLoaded, preferences]);

  return (
    <LanguageContext.Provider
      value={{
        ...preferences,
        isLoaded,
        setLanguage: (language) =>
          setPreferences((current) => ({ ...current, language })),
        setTheme: (theme) => setPreferences((current) => ({ ...current, theme })),
        setOutfit: (outfit) =>
          setPreferences((current) => ({
            ...current,
            outfit,
            theme:
              outfit === 'unicornio'
                ? 'light'
                : outfit === 'capibara'
                  ? 'dark'
                  : current.theme,
          })),
        setPersonality: (personality) =>
          setPreferences((current) => ({ ...current, personality })),
        setPronouns: (pronouns) =>
          setPreferences((current) => ({ ...current, pronouns })),
      }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider.');
  }

  return {
    ...context,
    t: translations[context.language][context.personality],
  };
}
