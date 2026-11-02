import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useLanguage } from '@/i18n/language-context';

export function useColorScheme() {
  const systemColorScheme = useSystemColorScheme();
  const { theme } = useLanguage();

  return theme === 'system' ? systemColorScheme : theme;
}
