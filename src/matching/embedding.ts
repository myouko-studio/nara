export const EMBEDDING_MODEL_VERSION = 'mediapipe-mobilenet-v3-small-1';

export async function generateImageEmbedding(_imageUri: string): Promise<number[]> {
  throw new Error('The local TFLite embedding prototype is available on iOS and Android only.');
}
