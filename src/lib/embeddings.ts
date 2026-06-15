import sharp from "sharp";

const MAX_INPUT_SIZE = 5 * 1024 * 1024;
const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";
const DEFAULT_VOYAGE_MODEL = "voyage-multimodal-3.5";

export type ImageEmbeddingProvider = "clip" | "voyage";

export type ImageEmbeddingMetadata = {
  provider: ImageEmbeddingProvider;
  model: string;
  dimension: number;
};

export type ImageEmbeddingResult = ImageEmbeddingMetadata & {
  vector: Float32Array;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let imageModelPromise: Promise<{ processor: any; model: any; RawImage: any }> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textModelPromise: Promise<{ tokenizer: any; model: any }> | null = null;

async function getImageModel() {
  if (!imageModelPromise) {
    imageModelPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformers = await import("@xenova/transformers" as any);
      const { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } = transformers;
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      const modelId = process.env.CLIP_MODEL_ID || "Xenova/clip-vit-large-patch14";
      const processor = await AutoProcessor.from_pretrained(modelId);
      const model = await CLIPVisionModelWithProjection.from_pretrained(modelId);
      return { processor, model, RawImage };
    })();
  }
  return imageModelPromise;
}

async function getTextModel() {
  if (!textModelPromise) {
    textModelPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformers = await import("@xenova/transformers" as any);
      const { AutoTokenizer, CLIPTextModelWithProjection, env } = transformers;
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      const modelId = process.env.CLIP_MODEL_ID || "Xenova/clip-vit-large-patch14";
      const tokenizer = await AutoTokenizer.from_pretrained(modelId);
      const model = await CLIPTextModelWithProjection.from_pretrained(modelId);
      return { tokenizer, model };
    })();
  }
  return textModelPromise;
}

export function imageEmbeddingProvider(): ImageEmbeddingProvider {
  const provider = process.env.IMAGE_EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (provider === "voyage") return "voyage";
  if (provider === "clip") return "clip";
  return process.env.VOYAGE_API_KEY ? "voyage" : "clip";
}

export function currentImageEmbeddingMetadata(): Omit<ImageEmbeddingMetadata, "dimension"> & {
  dimension?: number;
} {
  const provider = imageEmbeddingProvider();
  if (provider === "voyage") {
    return {
      provider,
      model: process.env.VOYAGE_MULTIMODAL_MODEL || DEFAULT_VOYAGE_MODEL,
      dimension: Number(process.env.VOYAGE_EMBEDDING_DIMENSION || 1024),
    };
  }

  return {
    provider,
    model: process.env.CLIP_MODEL_ID || "Xenova/clip-vit-large-patch14",
  };
}

export async function embedImageWithMetadata(
  buffer: Buffer,
  inputType: "query" | "document" = "document"
): Promise<ImageEmbeddingResult> {
  if (imageEmbeddingProvider() === "voyage") {
    return embedImageWithVoyage(buffer, inputType);
  }

  const vector = await embedImageWithClip(buffer);
  return {
    vector,
    provider: "clip",
    model: process.env.CLIP_MODEL_ID || "Xenova/clip-vit-large-patch14",
    dimension: vector.length,
  };
}

export async function embedImage(
  buffer: Buffer,
  inputType: "query" | "document" = "document"
): Promise<Float32Array> {
  return (await embedImageWithMetadata(buffer, inputType)).vector;
}

async function embedImageWithClip(buffer: Buffer): Promise<Float32Array> {
  if (buffer.length > MAX_INPUT_SIZE) throw new Error("image too large");

  const pngBuf = await sharp(buffer)
    .resize(336, 336, { fit: "cover" })
    .png()
    .toBuffer();

  const { processor, model, RawImage } = await getImageModel();
  const blob = new Blob([new Uint8Array(pngBuf)], { type: "image/png" });
  const image = await RawImage.fromBlob(blob);
  const inputs = await processor(image);
  const output = await model(inputs);
  const embeds = output.image_embeds ?? output.last_hidden_state ?? output.pooler_output;
  if (!embeds?.data) {
    throw new Error("CLIP model returned no embeddings (keys: " + Object.keys(output).join(",") + ")");
  }
  const data = embeds.data instanceof Float32Array ? embeds.data : new Float32Array(embeds.data);

  let norm = 0;
  for (let i = 0; i < data.length; i++) norm += data[i] * data[i];
  norm = Math.sqrt(norm) || 1;
  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) normalized[i] = data[i] / norm;
  return normalized;
}

export async function embedTextWithMetadata(
  text: string,
  _inputType: "query" | "document" = "document"
): Promise<ImageEmbeddingResult> {
  if (imageEmbeddingProvider() === "voyage") {
    // TODO: implement Voyage text embedding or fallback to CLIP
    throw new Error("Text embeddings for Voyage provider are not yet implemented");
  }

  const vector = await embedTextWithClip(text);
  return {
    vector,
    provider: "clip",
    model: process.env.CLIP_MODEL_ID || "Xenova/clip-vit-large-patch14",
    dimension: vector.length,
  };
}

export async function embedText(text: string): Promise<Float32Array> {
  return (await embedTextWithMetadata(text)).vector;
}

async function embedTextWithClip(text: string): Promise<Float32Array> {
  const truncated = text.slice(0, 1000);
  const { tokenizer, model } = await getTextModel();
  const inputs = await tokenizer(truncated, {
    padding: true,
    truncation: true,
    max_length: 77,
    return_tensors: "pt",
  });
  const output = await model(inputs);
  const embeds = output.text_embeds ?? output.last_hidden_state ?? output.pooler_output;
  if (!embeds?.data) {
    throw new Error("CLIP text model returned no embeddings");
  }
  const data = embeds.data instanceof Float32Array ? embeds.data : new Float32Array(embeds.data);
  return normalizeVector(data);
}

async function embedImageWithVoyage(
  buffer: Buffer,
  inputType: "query" | "document"
): Promise<ImageEmbeddingResult> {
  if (buffer.length > 20 * 1024 * 1024) throw new Error("image too large");

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not configured");

  const model = process.env.VOYAGE_MULTIMODAL_MODEL || DEFAULT_VOYAGE_MODEL;
  const imageBuffer = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const response = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model,
      input_type: inputType,
      truncation: true,
      inputs: [
        {
          content: [
            {
              type: "image_base64",
              image_base64: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voyage embedding failed ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    embeddings?: number[][];
  };
  const values = data.data?.[0]?.embedding || data.embeddings?.[0];
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Voyage embedding returned no vector`);
  }

  const vector = normalizeVector(new Float32Array(values));
  return {
    vector,
    provider: "voyage",
    model,
    dimension: vector.length,
  };
}

export function normalizeVector(data: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < data.length; i++) norm += data[i] * data[i];
  norm = Math.sqrt(norm) || 1;
  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) normalized[i] = data[i] / norm;
  return normalized;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function float32ToBytes(vec: Float32Array): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(vec.byteLength);
  new Float32Array(ab).set(vec);
  return new Uint8Array(ab);
}

export function bytesToFloat32(buf: Uint8Array): Float32Array {
  if (buf.byteLength % 4 !== 0) throw new Error(`embedding bytes not aligned: ${buf.byteLength}`);
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Float32Array(ab);
}
