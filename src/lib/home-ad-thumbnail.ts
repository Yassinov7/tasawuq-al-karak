import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from "expo-video";
import { Platform } from "react-native";

export function removeLocalAdThumbnail(uri?: string) {
  if (!uri) return;
  try { new File(uri).delete(); } catch { /* The temporary file may already have been removed. */ }
}

export class AdCoverError extends Error {
  readonly detail: string;

  constructor(message: string, stage: string, causes: unknown[] = []) {
    super(message, { cause: causes.at(-1) });
    const native = causes.map(cause => {
      if (!cause || typeof cause !== "object") return String(cause);
      return ["code" in cause ? String(cause.code) : "", "message" in cause ? String(cause.message) : ""]
        .filter(Boolean).join(" ");
    }).filter(Boolean).join(" | ");
    this.detail = (stage + (native ? ": " + native : ""))
      .replace(/(?:file|content|https?):\/\/[^\s'"]+|\/(?:data|storage|sdcard|private|var)\/[^\s'"]+/gi, "[مسار محلي]")
      .slice(0, 520);
  }
}

function waitForVideo(player: VideoPlayer, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      subscription.remove();
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error("انتهت مهلة انتظار جاهزية الفيديو."));
    const subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "readyToPlay") finish();
      if (status === "error") finish(new AdCoverError("تعذر تحميل الفيديو لاستخراج غلافه.", "statusChange", [error]));
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else if (player.status === "readyToPlay") finish();
    else if (player.status === "error") finish(new AdCoverError("تعذر تحميل الفيديو لاستخراج غلافه.", "status:error"));
  });
}

function ensureActive(signal?: AbortSignal) {
  if (signal?.aborted) throw Error("انتهت مهلة استخراج الغلاف.");
}

export async function saveHomeAdCover(source: string | VideoThumbnail, maxWidth?: number, signal?: AbortSignal) {
  try {
    const context = ImageManipulator.manipulate(source);
    try {
      if (maxWidth && maxWidth > 800) context.resize({ width: 800, height: null });
      const image = await context.renderAsync();
      try {
        ensureActive(signal);
        const { uri } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
        if (signal?.aborted) removeLocalAdThumbnail(uri);
        ensureActive(signal);
        return uri;
      } finally { image.release(); }
    } finally { context.release(); }
  } catch (cause) {
    ensureActive(signal);
    throw new AdCoverError("تعذر تجهيز صورة الغلاف بصيغة JPEG.", "ImageManipulator", [cause]);
  }
}

export async function createHomeAdThumbnail(uri: string, durationMs?: number | null) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new AdCoverError("استخراج الغلاف التلقائي متاح على Android وiPhone. يمكنك اختيار صورة غلاف.", "platform");
  }

  let player: VideoPlayer;
  try { player = createVideoPlayer(null); }
  catch (cause) { throw new AdCoverError("تعذر تهيئة مشغّل استخراج الغلاف.", "createVideoPlayer", [cause]); }

  const controller = new AbortController();
  const { signal } = controller;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheme = uri.match(/^([a-z][a-z0-9+.-]*):/i)?.[1] ?? "unknown";
  let stage = "replaceAsync";
  const work = (async () => {
    try {
      const ready = waitForVideo(player, signal);
      // Keep the error event even if it fires before replaceAsync settles.
      void ready.catch(() => {});
      try { await player.replaceAsync({ uri }); }
      catch (cause) { throw new AdCoverError("تعذر فتح الفيديو لاستخراج غلافه.", stage + " (" + scheme + ")", [cause]); }
      ensureActive(signal);
      stage = "readyToPlay";
      await ready;
      ensureActive(signal);

      stage = "generateThumbnailsAsync";
      const duration = player.duration > 0 && Number.isFinite(player.duration)
        ? player.duration : Math.max(0, (durationMs ?? 0) / 1000);
      const offset = Number.isFinite(duration) ? Math.min(0.8, duration * 0.2) : 0;
      const failures: unknown[] = [];
      // Android's scaled frame path is separate from its unscaled retriever.
      const attempts = [{ time: offset, scaled: true }];
      if (offset > 0) attempts.push({ time: 0, scaled: true });
      if (Platform.OS === "android") attempts.push({ time: 0, scaled: false });
      for (const { time, scaled } of attempts) {
        ensureActive(signal);
        let frame: VideoThumbnail | undefined;
        try {
          [frame] = await player.generateThumbnailsAsync([time], scaled ? { maxWidth: 800, maxHeight: 800 } : undefined);
          if (!frame) throw Error("No frame returned");
        } catch (cause) {
          failures.push(cause);
          continue;
        }
        try {
          ensureActive(signal);
          stage = "ImageManipulator";
          return await saveHomeAdCover(frame, frame.width, signal);
        } finally { frame.release(); }
      }
      ensureActive(signal);
      throw new AdCoverError("تعذر استخراج غلاف تلقائي. أعد المحاولة أو اختر صورة غلاف.",
        stage + " (" + scheme + ")", failures);
    } finally {
      // Keep the native object alive until the outstanding native operation settles.
      controller.abort();
      player.release();
    }
  })();

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AdCoverError("انتهت مهلة استخراج الغلاف. أعد المحاولة أو اختر صورة غلاف.", stage + " (" + scheme + ")"));
          controller.abort();
        }, 20_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
