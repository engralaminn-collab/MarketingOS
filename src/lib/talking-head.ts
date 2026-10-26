/**
 * Talking-head animation helpers.
 *
 * Everything here runs in the browser: the client's own photo is drawn to a
 * canvas, the mouth is animated against real speech, and the result is recorded
 * with MediaRecorder. No hosted service is involved and no photo ever leaves the
 * page unless the operator has configured a local lip-sync adapter.
 *
 * The mouth shapes are an approximation (an 8-shape viseme set), not a trained
 * lip-sync model. That distinction is surfaced in the UI: this produces a real,
 * downloadable talking clip from a still photo, but it is not photoreal neural
 * lip-sync. For that, the operator points LIPSYNC_ADAPTER_URL at a local
 * SadTalker / Wav2Lip / LiveTalk-style service and the job route takes over.
 */

export interface MouthShape {
  /** 0 = closed, 1 = fully open */
  open: number;
  /** 0 = wide (E/I), 1 = rounded (O/U) */
  round: number;
  /** 0..1 horizontal spread */
  wide: number;
}

export type VisemeName = 'rest' | 'AA' | 'E' | 'I' | 'O' | 'U' | 'M' | 'FV' | 'L' | 'WQ';

export const VISEMES: Record<VisemeName, MouthShape> = {
  rest: { open: 0.08, round: 0.35, wide: 0.55 },
  AA: { open: 0.92, round: 0.25, wide: 0.75 },
  E: { open: 0.5, round: 0.15, wide: 0.95 },
  I: { open: 0.4, round: 0.1, wide: 1 },
  O: { open: 0.78, round: 0.9, wide: 0.4 },
  U: { open: 0.55, round: 1, wide: 0.3 },
  M: { open: 0.02, round: 0.3, wide: 0.5 },
  FV: { open: 0.18, round: 0.25, wide: 0.65 },
  L: { open: 0.62, round: 0.2, wide: 0.7 },
  WQ: { open: 0.45, round: 0.85, wide: 0.35 },
};

/** Maps a character to the closest viseme. Cheap, deterministic, and smooth enough. */
export function charToViseme(char: string): VisemeName {
  const c = char.toLowerCase();
  if ('a'.includes(c)) return 'AA';
  if ('e'.includes(c)) return 'E';
  if ('i'.includes(c) || 'y'.includes(c)) return 'I';
  if ('o'.includes(c)) return 'O';
  if ('u'.includes(c)) return 'U';
  if ('mbp'.includes(c)) return 'M';
  if ('fv'.includes(c)) return 'FV';
  if ('l'.includes(c)) return 'L';
  if ('wqr'.includes(c)) return 'WQ';
  if (' .,!?;:'.includes(c)) return 'rest';
  return 'E';
}

export function ease(current: number, target: number, factor = 0.35): number {
  return current + (target - current) * factor;
}

export interface MouthState {
  open: number;
  round: number;
  wide: number;
  /** 0..1 talking energy, used for head sway amplitude */
  energy: number;
}

export function visemeToMouth(name: VisemeName, energy = 0.6): MouthState {
  const shape = VISEMES[name];
  return { open: shape.open, round: shape.round, wide: shape.wide, energy };
}

/** Energy estimate from a time-domain buffer (RMS scaled to 0..1). */
export function rmsEnergy(buffer: Uint8Array<ArrayBuffer>): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const v = (buffer[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
}

export interface RenderState {
  timeMs: number;
  mouth: MouthState;
  blink: number;
  /** Extra head translation, px, derived from energy */
  sway: number;
}

/**
 * Draws one frame: photo (or fallback silhouette), head bob, blink, and an
 * integrated mouth shape with a soft shadow so it reads as one object.
 */
export function drawTalkingFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  state: RenderState,
  options: {
    width: number;
    height: number;
    label?: string;
    /** Where the animated mouth sits on a photo, as fractions of the frame. */
    mouthAnchor?: { x: number; y: number };
  }
) {
  const anchor = options.mouthAnchor ?? { x: 0.5, y: 0.66 };
  const { width, height } = options;
  const t = state.timeMs / 1000;

  // backdrop
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const bobY = Math.sin(t * 1.9) * 4 + state.mouth.energy * Math.sin(t * 7.3) * 3;
  const swayX = Math.sin(t * 0.9) * 6 + state.sway;

  if (image && image.complete && image.naturalWidth > 0) {
    // cover-fit the photo
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const dx = (width - drawW) / 2 + swayX;
    const dy = (height - drawH) / 2 + bobY;
    ctx.save();
    ctx.drawImage(image, dx, dy, drawW, drawH);

    // mouth overlay anchored to the lower-middle of the frame
    const mouthCenterX = width * anchor.x + swayX * 1.2;
    const mouthCenterY = height * anchor.y + bobY;
    const baseW = width * 0.11 * (0.75 + state.mouth.wide * 0.45);
    const baseH = height * 0.055 * (0.2 + state.mouth.open * 1.5);

    ctx.beginPath();
    ctx.ellipse(mouthCenterX, mouthCenterY, baseW / 2, baseH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 12, 12, 0.82)';
    ctx.fill();
    if (state.mouth.open > 0.25) {
      // teeth hint on wide open vowels
      ctx.beginPath();
      ctx.ellipse(mouthCenterX, mouthCenterY - baseH * 0.22, baseW * 0.38, baseH * 0.14, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, width * 0.002);
    ctx.stroke();
    ctx.restore();
  } else {
    // No photo: draw a neutral presenter silhouette so the feature is usable.
    const cx = width / 2 + swayX;
    const headR = width * 0.17;
    const headY = height * 0.44 + bobY;
    const halo = ctx.createRadialGradient(cx, headY, headR * 0.4, cx, headY, headR * 2.6);
    halo.addColorStop(0, 'rgba(59,130,246,0.35)');
    halo.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR, headR * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // shoulders
    ctx.beginPath();
    ctx.ellipse(cx, height * 0.94, width * 0.34, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();

    // eyes with blink
    const eyeY = headY - headR * 0.22;
    const eyeGap = headR * 0.42;
    const eyeH = headR * 0.13 * (1 - Math.min(1, state.blink));
    ctx.fillStyle = '#0f172a';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + dir * eyeGap, eyeY, headR * 0.1, Math.max(0.6, eyeH), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // mouth
    const mouthY = headY + headR * 0.42;
    const mouthW = headR * 0.62 * (0.7 + state.mouth.wide * 0.5);
    const mouthH = headR * 0.5 * (0.08 + state.mouth.open * 1.25);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW / 2, Math.max(1, mouthH / 2), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
  }

  if (options.label) {
    ctx.font = `${Math.round(width * 0.026)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(options.label.slice(0, 64), width * 0.04, height * 0.94);
  }

  // vignette for polish
  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.32, width / 2, height / 2, width * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Picks the best MediaRecorder mime type available in this browser. */
export function pickVideoMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
}

/** Human-friendly list of browser speech voices, filtered to installed ones. */
export function browserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
