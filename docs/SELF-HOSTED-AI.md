# Self-hosted AI for MarketingOS

## Short answer

MarketingOS can run its core text assistant and marketing agents against a model that you host yourself. **Ollama is now the default text provider**; there is no automatic fallback to OpenRouter or Z.AI when the local model is unavailable. That removes per-request AI API billing for chat, copy, agent runs, grammar checks, diagrams, and video-plan scripts.

It is not cost-free: you provide and operate the CPU/GPU, RAM, storage, electricity, network, and model licensing. A small model can be slower or less capable than a large paid model. No model server is bundled into the Next.js app image.

## Run Ollama locally

1. Install Ollama on the same host as the MarketingOS server.
2. Download a model, for example:

   ```sh
   ollama pull llama3.2:3b
   ```

3. Set these server-side environment values:

   ```dotenv
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3.2:3b
   ```

4. Restart MarketingOS. The app server calls Ollama's non-streaming chat endpoint at `/api/chat`; the user's browser never calls the Ollama host directly.

Choose a model that fits the machine and review its license before commercial use. Larger models often require substantial memory and may benefit from a compatible GPU. The example model is only a starting point, not a quality guarantee.

## Run Ollama with Docker Compose

The optional overlay keeps the model service on the private Compose network and persists model files in a named volume. From the directory containing the production Compose file:

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.local-ai.yml up -d

docker compose -f docker-compose.prod.yml -f docker-compose.local-ai.yml exec ollama ollama pull llama3.2:3b
```

Set `OLLAMA_MODEL` to the model you actually pulled. For a production VPS, review the model's RAM/CPU needs first. The model server has no host-published port in this example. Keep Ollama private; the unauthenticated local API should not be exposed to the public internet. Operators may pin `OLLAMA_IMAGE` rather than using the sample `latest` tag.

For deployments using a host-installed Ollama instead, set `OLLAMA_BASE_URL` to a server-reachable private address. Do not use `localhost` from a separate container; there, `localhost` means the MarketingOS container itself.

## Self-hosted image generation with ComfyUI

MarketingOS can send a standard checkpoint-based image workflow to an operator-run ComfyUI instance. MarketingOS does **not** install ComfyUI, download model weights, or expose the ComfyUI server to the browser. You are responsible for installing ComfyUI, adding a compatible checkpoint to `models/checkpoints`, and checking the licenses for the code, checkpoint, and any LoRAs you use.

Set these server-side values:

```dotenv
COMFYUI_BASE_URL=http://comfyui:8188
COMFYUI_IMAGE_CHECKPOINT=your-checkpoint.safetensors
COMFYUI_API_KEY=
```

Use an address reachable from the MarketingOS server/container. `localhost` inside the MarketingOS container refers to MarketingOS, not a ComfyUI process on another container. Keep the endpoint on a private network; if using an authenticated reverse proxy, set `COMFYUI_API_KEY`. Select a checkpoint filename, not a path. The integrated workflow uses ComfyUI's standard checkpoint loader, text encoders, sampler, VAE decode, and image-save nodes; custom checkpoints may need a different workflow and are not guaranteed to work.

When ComfyUI is configured, image generation uses it. If that local server or model fails, MarketingOS returns an error and **does not fall back** to Z.AI. Hosted Z.AI image/video/avatar/speech remains separately disabled unless `ZAI_MEDIA_ENABLED=true`. No ComfyUI or model is bundled because model sizes, GPU requirements, and deployment choices vary substantially.

## Self-hosted AI video through ComfyUI

The short AI clip endpoint can execute a **workflow file supplied by the operator** on the same ComfyUI instance. MarketingOS does not ship a video-model graph or weights: ComfyUI video nodes, model files, licenses, and GPU resources are installed and managed separately. A compatible workflow is model-specific, so this adapter is configurable rather than a guarantee that an arbitrary graph/model will work.

Export a workflow in ComfyUI's API format, save it under the server's workflow directory, and set:

```dotenv
COMFYUI_BASE_URL=http://comfyui:8188
COMFYUI_VIDEO_WORKFLOW_FILE=/app/comfy-workflows/video_api.json
COMFYUI_VIDEO_FPS=12
COMFYUI_VIDEO_WIDTH=768
COMFYUI_VIDEO_HEIGHT=512
```

For the production Compose file, place the JSON under `./comfy-workflows/` beside the Compose file; that directory is mounted read-only at `/app/comfy-workflows`. The workflow JSON must include both `{{PROMPT}}` in a text-conditioning field and `{{FRAMES}}` in a numeric frame-count field. Optional placeholders are `{{NEGATIVE_PROMPT}}`, `{{DURATION}}` (seconds), `{{FPS}}`, `{{WIDTH}}`, `{{HEIGHT}}`, and `{{SEED}}`. Exact numeric placeholders are replaced with JSON numbers. Output must include an `.mp4`, `.webm`, or `.mov` file. The configured dimensions/FPS must be valid for the chosen nodes/model; the default is only a starting point.

The endpoint accepts 3–10 second clips, waits up to 180 seconds for ComfyUI, and caps the returned file at 25 MiB. The video is returned to the current browser session as a data URL and is **not stored in the content database**; download it before leaving the page. This synchronous request can exceed some serverless/proxy time limits, so use a long-running server with suitable request timeouts. If the local workflow is configured but fails, MarketingOS reports the error and **does not attempt a hosted fallback**. No model-based video inference was available for live verification in this workspace.

## Self-hosted speech with an OpenAI-compatible TTS service

The voiceover route supports an operator-hosted service exposing `POST /v1/audio/speech` with the OpenAI-compatible JSON fields `model`, `input`, `voice`, and `response_format`. Example server-side settings:

```dotenv
LOCAL_TTS_BASE_URL=http://tts:8880
LOCAL_TTS_MODEL=tts-1
LOCAL_TTS_VOICE=default
LOCAL_TTS_API_KEY=
```

`LOCAL_TTS_BASE_URL` should be the private service root (the app appends `/v1/audio/speech`); set a voice name supported by the service. Configure a network-reachable address—`localhost` inside the MarketingOS container refers to that container, not another service. No particular TTS server/model is bundled or live-tested. The request times out after 120 seconds, accepts common audio MIME types, and limits output to 10 MiB.

When local TTS is configured, it is always preferred. A local error returns an error and **never falls back** to hosted Z.AI. If local TTS is not configured, hosted speech remains unavailable unless `ZAI_MEDIA_ENABLED=true`. Local audio is returned only to the current browser session and is not persisted; the script is saved as a content draft. This adapter does not clone voices. Review each model's license, commercial-use terms, and speaker consent/rights before use.

## Provider selection

`AI_PROVIDER` supports explicit server-side choices:

- `ollama` — default, self-hosted. `OLLAMA_BASE_URL` and `OLLAMA_MODEL` configure it.
- `openrouter` — optional external model routing. Requires a key saved in the Integrations vault and `AI_PROVIDER=openrouter`; it is never selected just because a key exists.
- `zai` — optional hosted text provider, selected only with `AI_PROVIDER=zai`.

Provider errors are surfaced; the app does not silently switch to a paid provider. When Ollama is down or the chosen model is missing, AI features that require generation will return an error or use an explicitly marked deterministic/template fallback.

## What is and is not self-hosted today

| Capability | Current behavior |
| --- | --- |
| AI Command, marketing copy, general agent runtime, workforce answers | Uses the configured text provider; Ollama is the default. |
| Grammar checks and diagrams | Uses the configured text provider; deterministic/rule fallback is labeled in the response when the model is unavailable. |
| Video script/storyboard planning | Uses the configured text provider. This creates a draft only; a separate short-clip action may render through a configured ComfyUI workflow. |
| Model-based image generation | Uses operator-hosted ComfyUI when `COMFYUI_BASE_URL` and a local checkpoint are configured. It is not bundled or live-tested. If local ComfyUI fails, there is no hosted fallback. A browser-side template PNG maker is also available, but it is not AI image generation. |
| Model-generated video clips | Uses a supplied ComfyUI API-format workflow when `COMFYUI_VIDEO_WORKFLOW_FILE` is set. The 3–10 second clip is returned to the session, not persisted; no model/workflow is bundled or live-tested. A configured local failure does not fall back to hosted. Otherwise, video rendering requires explicit `ZAI_MEDIA_ENABLED=true`. |
| Speech generation | Uses an OpenAI-compatible local TTS service when `LOCAL_TTS_BASE_URL` is configured; the audio is session-only and the script draft is persisted. A local failure never falls back. Otherwise hosted Z.AI is available only with `ZAI_MEDIA_ENABLED=true`. Voice cloning is not implemented. |
| Avatar rendering | Not implemented as a self-hosted feature; hosted Z.AI media is disabled unless explicitly enabled. |
| Browser video template | Exports short silent text-card WebM locally in the browser. It is not AI-generated footage or voice. |
| Mureka instrumental tracks | Separate optional external integration; an administrator must save its API key and a user must request generation. Each request asks for one output, but the provider may charge for it. This is not part of the no-paid-API path. |
| Social publishing and provider-connected inboxes | Not enabled by this AI configuration. AI text does not publish or send messages. |

A local text model does not replace image diffusion, model-generated video, or text-to-speech. The ComfyUI image/video adapters and OpenAI-compatible TTS adapter are integration points, not bundled services or turnkey models; each needs separately installed model weights, compatible nodes/server, sufficient hardware, and license review. The browser WebM maker creates animated text cards, not AI footage or audio. MarketingOS does not claim all-model coverage or full local multimodal parity with paid AI services.

## Security and privacy

- Keep `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `LOCAL_TTS_BASE_URL`, `LOCAL_TTS_API_KEY`, and all provider keys server-only; never add a `NEXT_PUBLIC_` prefix.
- Keep Ollama, ComfyUI, and TTS services on private networks. If an endpoint is behind an authenticated reverse proxy, configure its server-only bearer key.
- Prompts and generated media stay under the operator's infrastructure only if the configured Ollama/ComfyUI/TTS endpoints and networks are actually controlled by the operator. Local audio/video files are returned to the session but not persisted by these adapters.
- External providers remain optional. OpenRouter requires explicit selection; media generation requires a separate explicit enablement or a separately configured API key.
- Do not place secrets in prompts. Review model and prompt logs according to your own retention policy.

## Verification status

Lint and focused mocked-adapter tests cover ComfyUI image/video request flow and the local TTS HTTP contract, but they do not exercise model inference. Full TypeScript validation is blocked because the generated Prisma client is missing and Prisma engine download failed in this environment. No Ollama, ComfyUI server/model/workflow, or TTS server/model is present here, so live inference, image/video/audio output quality, browser WebM recording, and production performance remain unverified. The operator must install/pull models and verify private URLs, request timeouts, hardware capacity, browser support, output retention, consent, and all model/checkpoint licenses.
