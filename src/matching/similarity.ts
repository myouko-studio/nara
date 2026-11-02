export type RankedMatch = {
  id: string;
  score: number;
};

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    throw new Error('Cannot compare embeddings with different dimensions.');
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === undefined || rightValue === undefined) {
      throw new Error('Embedding data is incomplete.');
    }
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  const denominator = Math.sqrt(leftMagnitude * rightMagnitude);
  if (!Number.isFinite(denominator) || denominator === 0) {
    throw new Error('Cannot compare an empty embedding.');
  }

  return dotProduct / denominator;
}

export function rankTopMatches(
  query: number[],
  candidates: { id: string; vector: number[] }[],
  limit = 5
): RankedMatch[] {
  return candidates
    .map(({ id, vector }) => ({ id, score: cosineSimilarity(query, vector) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
