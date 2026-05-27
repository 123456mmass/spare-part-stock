import sharp from "sharp";

const MAX_INPUT_SIZE = 5 * 1024 * 1024;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelPromise: Promise<{ processor: any; model: any; RawImage: any }> | null = null;

async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
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
  return modelPromise;
}

export async function embedImage(buffer: Buffer): Promise<Float32Array> {
  if (buffer.length > MAX_INPUT_SIZE) throw new Error("image too large");

  const pngBuf = await sharp(buffer)
    .resize(336, 336, { fit: "cover" })
    .png()
    .toBuffer();

  const { processor, model, RawImage } = await getModel();
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
