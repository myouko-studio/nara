import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useLanguage } from '@/i18n/language-context';

const subscribeToHydration = () => () => {};
const getHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const colorScheme = useRNColorScheme();
  const { theme } = useLanguage();

  if (!hasHydrated) {
    return 'light';
  }

  return theme === 'system' ? colorScheme : theme;
}
