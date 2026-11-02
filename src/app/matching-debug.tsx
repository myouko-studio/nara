import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  getAllCollectionItems,
  getPhotocardEmbeddings,
  savePhotocardEmbedding,
} from '@/database';
import type { Photocard } from '@/domain/photocard';
import { EMBEDDING_MODEL_VERSION, generateImageEmbedding } from '@/matching/embedding';
import { rankTopMatches } from '@/matching/similarity';

type MatchResult = {
  photocard: Photocard;
  score: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido al comparar imágenes.';
}

export default function MatchingDebugScreen() {
  const db = useSQLiteContext();
  const [queryImageUri, setQueryImageUri] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const getPhotocardsWithEmbeddings = async (): Promise<
    { photocard: Photocard; vector: number[] }[]
  > => {
    const collection = await getAllCollectionItems(db);
    const photocards = collection.filter(
      (item): item is Photocard => item.type === 'photocard'
    );
    if (photocards.length === 0) {
      throw new Error('No hay photocards registradas para comparar.');
    }

    const storedEmbeddings = await getPhotocardEmbeddings(db, EMBEDDING_MODEL_VERSION);
    const vectorsById = new Map(
      storedEmbeddings.map((embedding) => [embedding.collectionItemId, embedding.vector])
    );

    for (let index = 0; index < photocards.length; index += 1) {
      const photocard = photocards[index];
      if (!photocard) {
        continue;
      }

      let vector = vectorsById.get(photocard.id);
      if (!vector) {
        setStatus(`Generando embeddings de la colección (${index + 1}/${photocards.length})…`);
        const generatedVector = await generateImageEmbedding(photocard.imageUri);
        await savePhotocardEmbedding(
          db,
          photocard.id,
          EMBEDDING_MODEL_VERSION,
          generatedVector
        );
        vectorsById.set(photocard.id, generatedVector);
      }
    }

    return photocards.map((photocard) => {
      const vector = vectorsById.get(photocard.id);
      if (!vector) {
        throw new Error(`No se pudo obtener el embedding de "${photocard.id}".`);
      }
      return { photocard, vector };
    });
  };

  const chooseQueryImage = async (source: 'camera' | 'gallery') => {
    setErrorMessage('');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Se necesita permiso de cámara para tomar la imagen de prueba.');
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Se necesita permiso para acceder a las imágenes de la galería.');
        }
      }

      const selection =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
            });
      if (selection.canceled) {
        return;
      }

      setQueryImageUri(selection.assets[0]?.uri ?? null);
      setResults([]);
      setStatus('');
    } catch (error) {
      console.error('Unable to select a matching test image.', error);
      setErrorMessage(getErrorMessage(error));
    }
  };

  const prepareCollection = async () => {
    setIsBusy(true);
    setErrorMessage('');
    setStatus('Preparando embeddings locales…');
    try {
      const indexed = await getPhotocardsWithEmbeddings();
      setStatus(`${indexed.length} photocards indexadas localmente.`);
    } catch (error) {
      console.error('Unable to prepare the local photocard embedding index.', error);
      setStatus('');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const compareQuery = async () => {
    if (!queryImageUri) {
      setErrorMessage('Selecciona o toma primero una imagen para comparar.');
      return;
    }

    setIsBusy(true);
    setErrorMessage('');
    setResults([]);
    try {
      const photocards = await getPhotocardsWithEmbeddings();
      setStatus('Generando embedding de la imagen consultada…');
      const queryVector = await generateImageEmbedding(queryImageUri);
      const ranked = rankTopMatches(
        queryVector,
        photocards.map(({ photocard, vector }) => ({ id: photocard.id, vector })),
        5
      );
      const cardsById = new Map(photocards.map(({ photocard }) => [photocard.id, photocard]));
      setResults(
        ranked.map(({ id, score }) => {
          const photocard = cardsById.get(id);
          if (!photocard) {
            throw new Error(`No se encontró la photocard del resultado "${id}".`);
          }
          return { photocard, score };
        })
      );
      setStatus(`${ranked.length} resultados; similitud coseno sin calibrar.`);
    } catch (error) {
      console.error('Unable to compare the selected image with the collection.', error);
      setStatus('');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Coincidencias · debug
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Embeddings locales · {EMBEDDING_MODEL_VERSION}
        </ThemedText>

        <View style={styles.buttonRow}>
          <DebugButton
            disabled={isBusy}
            label="Tomar foto"
            onPress={() => void chooseQueryImage('camera')}
          />
          <DebugButton
            disabled={isBusy}
            label="Elegir de galería"
            onPress={() => void chooseQueryImage('gallery')}
          />
        </View>
        {queryImageUri && (
          <View style={styles.queryContainer}>
            <ThemedText type="smallBold">Photocard consultada</ThemedText>
            <Image source={{ uri: queryImageUri }} style={styles.queryImage} />
          </View>
        )}

        <View style={styles.buttonRow}>
          <DebugButton
            disabled={isBusy}
            label="Indexar photocards"
            onPress={() => void prepareCollection()}
          />
          <DebugButton
            disabled={isBusy || !queryImageUri}
            label="Comparar y mostrar top 5"
            onPress={() => void compareQuery()}
          />
        </View>

        {isBusy && <ActivityIndicator />}
        {!!status && <ThemedText>{status}</ThemedText>}
        {!!errorMessage && (
          <ThemedText accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </ThemedText>
        )}

        {results.map(({ photocard, score }, index) => (
          <ThemedView key={photocard.id} type="backgroundElement" style={styles.resultCard}>
            <Image source={{ uri: photocard.imageUri }} style={styles.resultImage} />
            <View style={styles.resultDetails}>
              <ThemedText type="smallBold">#{index + 1}</ThemedText>
              <ThemedText>
                {photocard.photocardCategories.album?.value ?? photocard.id}
              </ThemedText>
              <ThemedText type="code">cosine: {score.toFixed(6)}</ThemedText>
            </View>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function DebugButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled) && styles.buttonInactive,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: 120,
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    backgroundColor: '#F0CF4A',
  },
  buttonInactive: {
    opacity: 0.55,
  },
  queryContainer: {
    gap: Spacing.two,
  },
  queryImage: {
    width: 180,
    height: 240,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 12,
  },
  resultImage: {
    width: 96,
    height: 128,
    borderRadius: 8,
    backgroundColor: '#ddd',
  },
  resultDetails: {
    flex: 1,
    gap: Spacing.two,
  },
  error: {
    color: '#c62828',
  },
});
