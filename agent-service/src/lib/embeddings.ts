import { pipeline as xenovaPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/bge-small-en-v1.5";
const EMBEDDING_DIMS = 384;

type FeatureExtractionPipeline = Awaited<ReturnType<typeof xenovaPipeline<"feature-extraction">>>;

let extractor: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  if (loadingPromise) return loadingPromise;

  console.log(`[embeddings] Loading model ${MODEL_NAME}...`);
  loadingPromise = xenovaPipeline("feature-extraction", MODEL_NAME, {
    quantized: true,
  }).then((model) => {
    extractor = model as FeatureExtractionPipeline;
    loadingPromise = null;
    console.log(`[embeddings] Model loaded (${EMBEDDING_DIMS} dims)`);
    return extractor;
  });

  return loadingPromise;
}

/**
 * Embed a batch of texts using bge-small-en-v1.5.
 * Returns an array of 384-dim float arrays.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await getExtractor();
  const output = await model(texts, { pooling: "cls", normalize: true });

  // output.tolist() returns number[][] for batch input
  const embeddings: number[][] = output.tolist();
  return embeddings;
}

/**
 * Embed a single text. Convenience wrapper around embedBatch.
 */
export async function embedSingle(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding;
}

/**
 * Format a code entity into embedding-friendly text.
 */
export function formatEntityForEmbedding(entity: {
  type: string;
  name: string;
  signature: string;
  docstring?: string | null;
  filePath: string;
}): string {
  const description = entity.docstring || entity.signature;
  return `${entity.type} ${entity.name}: ${description}. File: ${entity.filePath}`;
}

export { EMBEDDING_DIMS, MODEL_NAME };
