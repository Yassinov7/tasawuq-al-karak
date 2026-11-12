import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createVideoPlayer } from "expo-video";
import { Platform } from "react-native";

export function removeLocalAdThumbnail(uri?: string) {
  if (!uri) return;
  try { new File(uri).delete(); } catch { /* The temporary file may already have been removed. */ }
}

export async function createHomeAdThumbnail(uri: string, durationMs?: number | null) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw Error("اختر الفيديو من تطبيق الإدارة على Android أو iPhone لاستخراج صورته المصغرة.");
  }
  let player: ReturnType<typeof createVideoPlayer>;
  try { player = createVideoPlayer(null); }
  catch { throw Error("تعذر تهيئة مشغّل الفيديو. تحقق من أن نسخة التطبيق تدعم معالجة الفيديو."); }

  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ensureCurrent = () => {
    if (expired) throw Error("انتهت مهلة استخراج الصورة المصغرة.");
  };
  const work = (async () => {
    try {
      try { await player.replaceAsync(uri); }
      catch { throw Error("تعذر فتح ملف الفيديو للمعالجة. تأكد من أنه محفوظ على الجهاز."); }
      ensureCurrent();
      const offset = durationMs && durationMs > 0 ? Math.min(0.8, durationMs / 5000) : 0.5;
      const frame = await (async () => {
        const read = async (time: number) => (await player.generateThumbnailsAsync([time], {
          maxWidth: 800, maxHeight: 800,
        }))[0];
        const early = await read(offset).catch(() => undefined);
        if (early) return early;
        ensureCurrent();
        const first = await read(0).catch(() => undefined);
        if (!first) throw Error("تعذر قراءة إطار من الفيديو. تأكد من أن الملف يعمل وأن ترميزه H.264.");
        return first;
      })();
      try {
        ensureCurrent();
        try {
          const context = ImageManipulator.manipulate(frame);
          try {
            const image = await context.renderAsync();
            try {
              ensureCurrent();
              const { uri: thumbnail } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
              if (expired) removeLocalAdThumbnail(thumbnail);
              ensureCurrent();
              return thumbnail;
            } finally { image.release(); }
          } finally { context.release(); }
        } catch (cause) {
          ensureCurrent();
          throw Error("تعذر حفظ الصورة المصغرة على الجهاز. تحقق من توفر مساحة ثم أعد الاستخراج.", { cause });
        }
      } finally { frame.release(); }
    } finally {
      // Native work owns this standalone player until its last asynchronous operation settles.
      player.release();
    }
  })();

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(Error("انتهت مهلة استخراج الصورة المصغرة. أعد المحاولة للفيديو نفسه."));
        }, 20_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
