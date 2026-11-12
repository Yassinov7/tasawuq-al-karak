import { File, FileMode } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { checkBrandingSignature, validateBrandingInput } from "@/lib/store-branding-contract";

export type PickedHomeAdMedia = {
  uri: string;
  mime: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  name?: string | null;
  duration?: number | null;
  thumbnailUri?: string;
};

export async function pickHomeAdMedia(kind: "images" | "videos"): Promise<PickedHomeAdMedia | undefined> {
  if (kind === "videos" && Platform.OS === "web") {
    throw Error("استخدم التطبيق على Android أو iPhone لاختيار الفيديو واستخراج صورته المصغرة.");
  }
  if (kind === "videos" && Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {
      throw Error("تعذر التحقق من إذن الوصول إلى مكتبة الفيديو.");
    });
    if (!permission.granted) {
      throw Error(permission.canAskAgain
        ? "اسمح بالوصول إلى مكتبة الوسائط لاختيار الفيديو."
        : "فعّل الوصول إلى الصور والفيديو لهذا التطبيق من إعدادات iPhone، ثم أعد المحاولة.");
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [kind],
    allowsEditing: false,
    allowsMultipleSelection: false,
  }).catch((cause: unknown) => {
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
    if (/FAILED_TO_(PICK_MEDIA|EXTRACT_VIDEO_METADATA|READ_FILE|WRITE_FILE|CREATE_FILE)/.test(code)) {
      throw Error("تعذر استلام الملف من المنتقي. نزّل الملف إلى الجهاز أو جرّب ملفًا آخر.");
    }
    if (code.includes("USER_REJECTED_PERMISSIONS")) throw Error("لم يُمنح التطبيق إذن الوصول إلى الوسائط.");
    throw Error(kind === "videos" ? "تعذر فتح منتقي الفيديو. أعد المحاولة."
      : "تعذر فتح منتقي الصور. أعد المحاولة.");
  });
  if (result.canceled) return;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw Error("لم يُرجع المنتقي ملفًا يمكن قراءته. اختر ملفًا مرة أخرى.");

  let header: ArrayBuffer;
  let size: number;
  try {
    if (asset.file) {
      size = asset.file.size;
      header = await asset.file.slice(0, 32).arrayBuffer();
    } else {
      const file = new File(asset.uri);
      size = file.size;
      const handle = file.open(FileMode.ReadOnly);
      try { header = handle.readBytes(32).buffer; }
      finally { handle.close(); }
    }
  } catch {
    throw Error("تعذرت قراءة الملف المختار. نزّل الملف إلى الجهاز ثم اختره مجددًا.");
  }

  const types = kind === "videos" ? ["video/mp4"] as const : ["image/jpeg", "image/png", "image/webp"] as const;
  // Android providers can omit MIME or return a generic type. Validate the actual file header.
  const mime = types.find(type => {
    try { checkBrandingSignature(type, header); return true; } catch { return false; }
  });
  if (!mime) throw Error(kind === "videos" ? "الملف المختار ليس فيديو MP4 مدعومًا. اختر فيديو MP4 بترميز H.264."
    : "الملف المختار ليس صورة JPEG أو PNG أو WebP.");
  try { validateBrandingInput(kind === "videos" ? "promo_video" : "logo", mime, size); }
  catch { throw Error(kind === "videos" ? "اختر فيديو صالحًا بحجم لا يتجاوز 50 ميغابايت."
    : "اختر صورة صالحة بحجم لا يتجاوز 4 ميغابايت."); }

  return { uri: asset.uri, name: asset.fileName, duration: asset.duration, mime };
}
