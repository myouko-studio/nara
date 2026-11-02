import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initializeDatabase } from '@/database';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LanguageProvider } from '@/i18n/language-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <SQLiteProvider databaseName="nara.db" onInit={initializeDatabase}>
      <LanguageProvider>
        <ThemedTabLayout />
      </LanguageProvider>
    </SQLiteProvider>
  );
}

function ThemedTabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
