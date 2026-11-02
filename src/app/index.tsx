import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText type="subtitle">
          Hiya! Soy Nara.
        </ThemedText>

        <ThemedText style={styles.text}>
          Guardiana de tu colección.
        </ThemedText>

        <ThemedText style={styles.text}>
          Tu colección es tu universo.
        </ThemedText>

        <ThemedText style={styles.text}>
          Yo cuido del mapa.
        </ThemedText>

        <Pressable style={styles.button}>
          <ThemedText style={styles.buttonText}>
            Empezamos
          </ThemedText>
        </Pressable>

        <ThemedText style={styles.smallText}>
          Todavía estoy aprendiendo.
        </ThemedText>

        <ThemedText style={styles.smallText}>
          Ya puedes explorar Nara desde las pestañas inferiores.
        </ThemedText>
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

  logo: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },

  text: {
    textAlign: 'center',
  },

  smallText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
  },

  button: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#F75202',
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});