import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { clearAllCollectionItems, getAllCollectionItems } from '@/database';
import { useLanguage } from '@/i18n/language-context';

export default function UniverseScreen() {
  const db = useSQLiteContext();
  const { t } = useLanguage();
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const refreshItemCount = useCallback(async () => {
    try {
      const items = await getAllCollectionItems(db);
      setItemCount(items.length);
      setDatabaseError(false);
    } catch (error) {
      console.error('Unable to load collection items.', error);
      setDatabaseError(true);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refreshItemCount();
    }, [refreshItemCount])
  );

  const clearDevelopmentData = async () => {
    setIsClearing(true);
    try {
      await clearAllCollectionItems(db);
      await refreshItemCount();
    } catch (error) {
      console.error('Unable to clear development collection data.', error);
      setDatabaseError(true);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title">{t.universe.title}</ThemedText>

        <ThemedText type="subtitle">{t.universe.greeting}</ThemedText>

        {databaseError ? (
          <ThemedText style={styles.text}>{t.universe.databaseError}</ThemedText>
        ) : itemCount === null ? (
          <ActivityIndicator accessibilityLabel={t.universe.loading} />
        ) : (
          <ThemedText style={styles.text}>
            {itemCount === 0
              ? t.universe.emptyCollection
              : t.universe.collectionCount.replace('{count}', String(itemCount))}
          </ThemedText>
        )}

        {__DEV__ && (
          <Pressable
            accessibilityRole="button"
            disabled={isClearing}
            onPress={() => void clearDevelopmentData()}
            style={({ pressed }) => [
              styles.developmentButton,
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.developmentButtonText}>
              {isClearing ? 'Limpiando datos…' : 'Limpiar datos de desarrollo'}
            </ThemedText>
          </Pressable>
        )}

        <ThemedText style={styles.text}>{t.universe.someday}</ThemedText>

        <ThemedText style={styles.text}>{t.universe.explore}</ThemedText>

        <ThemedText style={styles.signature}>🗺️</ThemedText>

        <ThemedText style={styles.signature}>{t.universe.map}</ThemedText>

        <ThemedText style={styles.signature}>{t.universe.signature}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  text: {
    textAlign: 'center',
  },
  developmentButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#F9DFC9',
  },
  developmentButtonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  signature: {
    textAlign: 'center',
  },
});