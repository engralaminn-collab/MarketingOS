import { randomInt } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const REQUEST_TIMEOUT_MS = 30_000;
const GENERATION_TIMEOUT_MS = 180_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

interface ComfyImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

function getComfyConfig(): { baseUrl: URL; checkpoint: string; apiKey: string | null } | null {
  const configuredUrl = process.env.COMFYUI_BASE_URL?.trim();
  if (!configuredUrl) return null;

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new Error("COMFYUI_BASE_URL must be a valid absolute URL");
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("COMFYUI_BASE_URL must use HTTP(S) and must not contain credentials, a query, or a fragment");
  }

  const checkpoint = process.env.COMFYUI_IMAGE_CHECKPOINT?.trim();
  if (!checkpoint) throw new Error("Set COMFYUI_IMAGE_CHECKPOINT to a checkpoint file installed in ComfyUI's models/checkpoints folder");
  if (checkpoint.length > 160 || checkpoint.includes("..") || checkpoint.includes("/") || checkpoint.includes("\\")) {
    throw new Error("COMFYUI_IMAGE_CHECKPOINT must be a checkpoint filename, not a path");
  }

  return {
    baseUrl: new URL(baseUrl.toString().endsWith("/") ? baseUrl.toString() : `${baseUrl.toString()}/`),
    checkpoint,
    apiKey: process.env.COMFYUI_API_KEY?.trim() || null,
  };
}

function endpoint(baseUrl: URL, path: string): URL {
  return new URL(path.replace(/^\/+/, ""), baseUrl);
}

function headers(apiKey: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

async function fetchJson(url: URL, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("ComfyUI request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildImageWorkflow(prompt: string, checkpoint: string, width: number, height: number) {
  const seed = randomInt(0, 2 ** 32);
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: "low quality, blurry, unreadable text, watermark, distorted", clip: ["1", 1] } },
    "4": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 24,
        cfg: 6.5,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
    },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { filename_prefix: "marketingos-local", images: ["6", 0] } },
  };
}

function findOutputImage(history: unknown, promptId: string): ComfyImage | null {
  if (!history || typeof history !== "object" || Array.isArray(history)) return null;
  const job = (history as Record<string, unknown>)[promptId];
  if (!job || typeof job !== "object" || Array.isArray(job)) return null;
  const outputs = (job as Record<string, unknown>).outputs;
  if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) return null;

  for (const output of Object.values(outputs as Record<string, unknown>)) {
    if (!output || typeof output !== "object" || Array.isArray(output)) continue;
    const images = (output as Record<string, unknown>).images;
    if (!Array.isArray(images)) continue;
    const image = images.find((candidate): candidate is ComfyImage =>
      Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)
        && typeof (candidate as Record<string, unknown>).filename === "string"),
    );
    if (image) return image;
  }
  return null;
}

function findJobError(history: unknown, promptId: string): boolean {
  if (!history || typeof history !== "object" || Array.isArray(history)) return false;
  const job = (history as Record<string, unknown>)[promptId];
  if (!job || typeof job !== "object" || Array.isArray(job)) return false;
  const status = (job as Record<string, unknown>).status;
  return Boolean(status && typeof status === "object" && (status as Record<string, unknown>).status_str === "error");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Generates one image on an operator-configured, self-hosted ComfyUI instance. */
export async function generateWithComfyUI(prompt: string, width: number, height: number): Promise<string | null> {
  const config = getComfyConfig();
  if (!config) return null;

  const submission = await fetchJson(endpoint(config.baseUrl, "/prompt"), {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({ prompt: buildImageWorkflow(prompt, config.checkpoint, width, height) }),
  });
  if (!submission || typeof submission !== "object" || typeof (submission as Record<string, unknown>).prompt_id !== "string") {
    throw new Error("ComfyUI did not return a prompt ID");
  }
  const promptId = (submission as Record<string, unknown>).prompt_id as string;
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const history = await fetchJson(endpoint(config.baseUrl, `/history/${encodeURIComponent(promptId)}`), {
      method: "GET",
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });
    if (findJobError(history, promptId)) throw new Error("ComfyUI could not complete the image workflow");
    const image = findOutputImage(history, promptId);
    if (image) {
      const viewUrl = endpoint(config.baseUrl, "/view");
      viewUrl.searchParams.set("filename", image.filename);
      viewUrl.searchParams.set("subfolder", image.subfolder || "");
      viewUrl.searchParams.set("type", image.type || "output");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(viewUrl, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`ComfyUI image download returned HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("ComfyUI returned an empty or oversized image");
        const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        if (contentType && !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
          throw new Error("ComfyUI returned an unsupported image type");
        }
        return `data:${contentType || "image/png"};base64,${bytes.toString("base64")}`;
      } finally {
        clearTimeout(timeout);
      }
    }
    await wait(1_500);
  }

  throw new Error("ComfyUI image generation timed out after 180 seconds");
}

interface ComfyVideoFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_WORKFLOW_BYTES = 2 * 1024 * 1024;
const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

async function readBoundedVideo(response: Response): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_VIDEO_BYTES) throw new Error("ComfyUI returned an oversized video");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VIDEO_BYTES) {
        await reader.cancel();
        throw new Error("ComfyUI returned an oversized video");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function getComfyVideoConfig(): { baseUrl: URL; apiKey: string | null; workflowPath: string } | null {
  const workflowPath = process.env.COMFYUI_VIDEO_WORKFLOW_FILE?.trim();
  if (!workflowPath) return null;

  const configuredUrl = process.env.COMFYUI_BASE_URL?.trim();
  if (!configuredUrl) throw new Error("COMFYUI_BASE_URL is required when COMFYUI_VIDEO_WORKFLOW_FILE is set");
  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new Error("COMFYUI_BASE_URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("COMFYUI_BASE_URL must use HTTP(S) and must not contain credentials, a query, or a fragment");
  }

  return {
    baseUrl: new URL(baseUrl.toString().endsWith("/") ? baseUrl.toString() : `${baseUrl.toString()}/`),
    apiKey: process.env.COMFYUI_API_KEY?.trim() || null,
    workflowPath: resolve(workflowPath),
  };
}

function numericSetting(name: string, fallback: number, min: number, max: number): number {
  const configured = process.env[name]?.trim();
  if (!configured) return fallback;
  const value = Number(configured);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function substituteVideoParameters(value: unknown, replacements: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    const exact = /^\{\{([A-Z_]+)\}\}$/.exec(value);
    if (exact && Object.hasOwn(replacements, exact[1])) return replacements[exact[1]];
    return value.replace(/\{\{([A-Z_]+)\}\}/g, (token, name: string) =>
      Object.hasOwn(replacements, name) ? String(replacements[name]) : token,
    );
  }
  if (Array.isArray(value)) return value.map((item) => substituteVideoParameters(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substituteVideoParameters(item, replacements)]));
  }
  return value;
}

function findOutputVideo(history: unknown, promptId: string): ComfyVideoFile | null {
  if (!history || typeof history !== "object" || Array.isArray(history)) return null;
  const job = (history as Record<string, unknown>)[promptId];
  if (!job || typeof job !== "object" || Array.isArray(job)) return null;
  const outputs = (job as Record<string, unknown>).outputs;
  if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) return null;

  for (const output of Object.values(outputs as Record<string, unknown>)) {
    if (!output || typeof output !== "object" || Array.isArray(output)) continue;
    const row = output as Record<string, unknown>;
    for (const key of ["videos", "gifs", "images"]) {
      const files = row[key];
      if (!Array.isArray(files)) continue;
      const video = files.find((candidate): candidate is ComfyVideoFile => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
        const filename = (candidate as Record<string, unknown>).filename;
        if (typeof filename !== "string") return false;
        const extension = filename.split(".").pop()?.toLowerCase() || "";
        return Object.hasOwn(VIDEO_MIME_BY_EXTENSION, extension);
      });
      if (video) return video;
    }
  }
  return null;
}

/**
 * Runs an operator-provided ComfyUI API-format workflow. The workflow file is
 * trusted server configuration; user input is only substituted into explicit
 * {{PROMPT}} tokens. The generated video is returned as a short-lived data URI.
 */
export async function generateWithComfyUIVideo(prompt: string, durationSeconds: number): Promise<string | null> {
  const config = getComfyVideoConfig();
  if (!config) return null;
  if (!prompt.trim() || prompt.length > 8_000) throw new Error("Video prompt must be between 1 and 8,000 characters");
  if (!Number.isInteger(durationSeconds) || durationSeconds < 3 || durationSeconds > 10) {
    throw new Error("Local ComfyUI video duration must be a whole number from 3 to 10 seconds");
  }

  const workflowStats = await stat(config.workflowPath);
  if (!workflowStats.isFile() || workflowStats.size < 2 || workflowStats.size > MAX_VIDEO_WORKFLOW_BYTES) {
    throw new Error("COMFYUI_VIDEO_WORKFLOW_FILE must point to an API-format JSON file smaller than 2 MB");
  }
  let rawWorkflow: unknown;
  try {
    rawWorkflow = JSON.parse(await readFile(config.workflowPath, "utf8"));
  } catch {
    throw new Error("ComfyUI video workflow file is not valid JSON");
  }
  if (!rawWorkflow || typeof rawWorkflow !== "object" || Array.isArray(rawWorkflow)) {
    throw new Error("ComfyUI video workflow must be a JSON object exported in API format");
  }
  const workflowNodes = Object.values(rawWorkflow as Record<string, unknown>);
  if (!workflowNodes.length || !workflowNodes.some((node) =>
    node && typeof node === "object" && !Array.isArray(node)
      && typeof (node as Record<string, unknown>).class_type === "string"
      && (node as Record<string, unknown>).inputs && typeof (node as Record<string, unknown>).inputs === "object",
  )) {
    throw new Error("ComfyUI video workflow must contain API-format nodes with class_type and inputs");
  }
  const workflowTemplate = JSON.stringify(rawWorkflow);
  if (!workflowTemplate.includes("{{PROMPT}}") || !workflowTemplate.includes("{{FRAMES}}")) {
    throw new Error("ComfyUI video workflow must include {{PROMPT}} and {{FRAMES}} placeholders");
  }

  const fps = numericSetting("COMFYUI_VIDEO_FPS", 12, 1, 60);
  const width = numericSetting("COMFYUI_VIDEO_WIDTH", 768, 256, 2048);
  const height = numericSetting("COMFYUI_VIDEO_HEIGHT", 512, 256, 2048);
  if (width % 8 !== 0 || height % 8 !== 0) throw new Error("COMFYUI_VIDEO_WIDTH and COMFYUI_VIDEO_HEIGHT must be multiples of 8");
  const seed = randomInt(0, 2 ** 32);
  const promptWorkflow = substituteVideoParameters(rawWorkflow, {
    PROMPT: prompt,
    NEGATIVE_PROMPT: "flicker, jitter, distorted anatomy, text artifacts, watermark, low quality",
    DURATION: durationSeconds,
    FPS: fps,
    FRAMES: durationSeconds * fps,
    WIDTH: width,
    HEIGHT: height,
    SEED: seed,
  });

  const submission = await fetchJson(endpoint(config.baseUrl, "/prompt"), {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({ prompt: promptWorkflow }),
  });
  if (!submission || typeof submission !== "object" || typeof (submission as Record<string, unknown>).prompt_id !== "string") {
    throw new Error("ComfyUI did not return a prompt ID for the video workflow");
  }
  const promptId = (submission as Record<string, unknown>).prompt_id as string;
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const history = await fetchJson(endpoint(config.baseUrl, `/history/${encodeURIComponent(promptId)}`), {
      method: "GET",
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });
    if (findJobError(history, promptId)) throw new Error("ComfyUI could not complete the video workflow");
    const video = findOutputVideo(history, promptId);
    if (video) {
      const viewUrl = endpoint(config.baseUrl, "/view");
      viewUrl.searchParams.set("filename", video.filename);
      viewUrl.searchParams.set("subfolder", video.subfolder || "");
      viewUrl.searchParams.set("type", video.type || "output");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(viewUrl, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`ComfyUI video download returned HTTP ${response.status}`);
        const bytes = await readBoundedVideo(response);
        if (!bytes.length) throw new Error("ComfyUI returned an empty video");
        const extension = video.filename.split(".").pop()?.toLowerCase() || "";
        const inferredMime = VIDEO_MIME_BY_EXTENSION[extension];
        const responseMime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        const contentType = responseMime && Object.values(VIDEO_MIME_BY_EXTENSION).includes(responseMime)
          ? responseMime
          : inferredMime;
        if (!contentType) throw new Error("ComfyUI returned an unsupported video type");
        return `data:${contentType};base64,${bytes.toString("base64")}`;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("ComfyUI video download timed out");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    await wait(1_500);
  }

  throw new Error("ComfyUI video generation timed out after 180 seconds");
}
