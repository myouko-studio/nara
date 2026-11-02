import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel } from 'react-native-fast-tflite';

import modelAsset from '../../assets/models/mobilenet_v3_small.tflite';

export const EMBEDDING_MODEL_VERSION = 'mediapipe-mobilenet-v3-small-1';

const MODEL_INPUT_SIZE = 224;
let modelPromise: ReturnType<typeof loadTensorflowModel> | null = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(modelAsset, []).catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

function createRgbInput(
  rgba: Uint8Array,
  width: number,
  height: number,
  expectedShape: number[]
): ArrayBuffer {
  if (
    expectedShape.length !== 4 ||
    expectedShape[0] !== 1 ||
    expectedShape[1] !== height ||
    expectedShape[2] !== width ||
    expectedShape[3] !== 3
  ) {
    throw new Error(`Unsupported embedding model input shape: ${expectedShape.join('x')}.`);
  }

  const input = new Float32Array(width * height * 3);
  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < rgba.length; sourceOffset += 4) {
    input[targetOffset++] = rgba[sourceOffset] / 127.5 - 1;
    input[targetOffset++] = rgba[sourceOffset + 1] / 127.5 - 1;
    input[targetOffset++] = rgba[sourceOffset + 2] / 127.5 - 1;
  }

  const buffer = new ArrayBuffer(input.byteLength);
  new Float32Array(buffer).set(input);
  return buffer;
}

function normalizeEmbedding(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('The image model returned an empty embedding.');
  }

  return vector.map((value) => value / magnitude);
}

export async function generateImageEmbedding(imageUri: string): Promise<number[]> {
  const model = await getModel();
  const inputTensor = model.inputs[0];
  const outputTensor = model.outputs[0];

  if (
    model.inputs.length !== 1 ||
    inputTensor?.dataType !== 'float32' ||
    model.outputs.length < 1 ||
    outputTensor?.dataType !== 'float32'
  ) {
    throw new Error('The bundled image model has an unsupported tensor configuration.');
  }

  const rendered = await ImageManipulator.manipulate(imageUri, {
    maxWidth: MODEL_INPUT_SIZE,
    maxHeight: MODEL_INPUT_SIZE,
  })
    .resize({ width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE })
    .renderAsync();
  const jpegResult = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 1,
  });
  const imageBytes = await new File(jpegResult.uri).bytes();
  const decoded = jpeg.decode(imageBytes, {
    useTArray: true,
    maxResolutionInMP: 1,
  });

  if (
    decoded.width !== MODEL_INPUT_SIZE ||
    decoded.height !== MODEL_INPUT_SIZE ||
    decoded.data.length !== MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 4
  ) {
    throw new Error('The resized image could not be decoded at the model input size.');
  }

  const input = createRgbInput(
    decoded.data,
    decoded.width,
    decoded.height,
    inputTensor.shape
  );
  const outputs = await model.run([input]);
  const output = outputs[0];
  if (!output || output.byteLength === 0 || output.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error('The image model returned an invalid embedding tensor.');
  }

  const rawVector = Array.from(new Float32Array(output));
  if (rawVector.some((value) => !Number.isFinite(value))) {
    throw new Error('The image model returned non-finite embedding values.');
  }

  return normalizeEmbedding(rawVector);
}
