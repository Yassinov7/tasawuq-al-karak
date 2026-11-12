import { HomeAdTargetPicker } from "@/components/admin/HomeAdTargetPicker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Switch, Text, useWindowDimensions, View } from "react-native";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppDialog } from "@/context/AppDialogContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDriverTaskRefresh } from "@/hooks/useDriverTaskRefresh";
import { deleteHomeAd, listHomeAds, previewHomeAd, saveHomeAd, uploadHomeAd, type HomeAd, type HomeAdInput } from "@/lib/customer-home-ads";
import { createHomeAdThumbnail, removeLocalAdThumbnail } from "@/lib/home-ad-thumbnail";
import { pickHomeAdMedia, type PickedHomeAdMedia } from "@/lib/home-ad-picker";
import { localOfferEndInstant, localOfferFields } from "@/lib/offer-expiration";
import { newIdempotencyKey } from "@/lib/request-key";
import { latinDigits } from "@/lib/signup-data";

type Draft = Omit<HomeAdInput, "priority"> & { priority: string };
const destinations = [["store", "متجر"], ["product", "منتج"], ["offer", "عرض"]] as const;
function localInput(value: string | number) {
  const { date, time } = localOfferFields(value);
  return `${date} ${time}`;
}
function instant(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(latinDigits(value.trim()));
  if (!match) throw Error("أدخل التاريخ والوقت بصيغة YYYY-MM-DD HH:mm.");
  return localOfferEndInstant(match[1], match[2]);
}
function newDraft(): Draft {
  const now = Date.now();
  return {
    id: newIdempotencyKey(), title: "", body: "", advertiser: "", admin_note: "", target_kind: "store", target_id: "",
    media_kind: "image", media_path: "", starts_at: localInput(now), ends_at: localInput(now + 86400000), is_active: false, priority: "0",
  };
}

export default function HomeAdsScreen() {
  const { user } = useAuth();
  return user ? <HomeAds key={user.id} owner={user.id} /> : null;
}

function HomeAds({ owner }: { owner: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dialog = useAppDialog();
  const [rows, setRows] = useState<HomeAd[]>();
  const [draft, setDraft] = useState<Draft>();
  const [editVersion, setEditVersion] = useState(0);
  const [original, setOriginal] = useState<HomeAd>();
  const [picked, setPicked] = useState<PickedHomeAdMedia>();
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const thumbnail = picked?.thumbnailUri;
  useEffect(() => () => removeLocalAdThumbnail(thumbnail), [thumbnail]);
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await listHomeAds(owner, signal);
      if (!signal.aborted) { setRows(next); setListError(""); }
    } catch { if (!signal.aborted) setListError("تعذر تحميل الإعلانات. أعد المحاولة."); }
  }, [owner]);
  const refresh = useDriverTaskRefresh(load, true);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إتمام العملية."); }
    finally { lock.current = false; setBusy(false); }
  };
  const edit = (row?: HomeAd) => {
    setEditVersion(version => version + 1);
    setOriginal(row);
    setDraft(row ? { ...row, priority: String(row.priority), starts_at: localInput(row.starts_at), ends_at: localInput(row.ends_at) } : newDraft());
    setPicked(undefined); setPreview(""); setError("");
  };
  const prepareThumbnail = async (media: PickedHomeAdMedia) => {
    setExtracting(true);
    try {
      const thumbnailUri = await createHomeAdThumbnail(media.uri, media.duration);
      if (!mounted.current) { removeLocalAdThumbnail(thumbnailUri); return; }
      setPicked({ ...media, thumbnailUri });
    } finally {
      if (mounted.current) setExtracting(false);
    }
  };
  const pick = (kind: "images" | "videos") => run(async () => {
    const media = await pickHomeAdMedia(kind);
    if (!media || !mounted.current) return;
    // Retain the validated file before decoding, so a failed thumbnail can be retried.
    setPicked(media);
    setPreview("");
    if (media.mime === "video/mp4") await prepareThumbnail(media);
  });
  const save = () => run(async () => {
    if (!draft) return;
    const targetId = draft.target_id.trim();
    if (!targetId) throw Error("اختر وجهة الإعلان من النتائج.");
    const startsAt = instant(draft.starts_at), endsAt = instant(draft.ends_at);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw Error("يجب أن تكون النهاية بعد البداية.");
    const priority = latinDigits(draft.priority.trim());
    if (!/^\d{1,3}$/.test(priority)) throw Error("أدخل أولوية من 0 إلى 999.");
    if (picked?.mime === "video/mp4" && !picked.thumbnailUri) throw Error("استخرج الصورة المصغرة للفيديو قبل الحفظ.");
    if (!picked && !draft.media_path) throw Error("اختر صورة أو فيديو للإعلان.");
    const media = picked ? await uploadHomeAd(owner, draft.id, picked.uri, picked.mime, picked.thumbnailUri) : {
      media_kind: draft.media_kind, media_path: draft.media_path, thumbnail_path: draft.thumbnail_path ?? null,
    };
    setDraft({ ...draft, ...media }); setPicked(undefined); setPreview("");
    await saveHomeAd(owner, {
      id: draft.id, title: draft.title.trim(), body: draft.body.trim(), advertiser: draft.advertiser.trim(), admin_note: draft.admin_note.trim(),
      target_kind: draft.target_kind, target_id: targetId, ...media, starts_at: startsAt, ends_at: endsAt,
      is_active: draft.is_active, priority: Number(priority),
    }, original);
    setDraft(undefined); setPreview(""); await refresh("manual");
  });
  const field = (key: "title" | "body" | "advertiser" | "admin_note" | "starts_at" | "ends_at" | "priority", label: string, maxLength: number) =>
    draft && <AppTextField label={label} value={draft[key]} maxLength={maxLength} disabled={busy}
      onChangeText={value => setDraft(previous => previous ? { ...previous, [key]: value } : previous)} />;
  const row = { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" } as const;
  const text = { ...Typography.body, color: colors.text, textAlign: "right" } as const;
  const video = picked ? picked.mime === "video/mp4" : draft?.media_kind === "video";
  const mediaUri = picked ? (video ? picked.thumbnailUri : picked.uri) : preview;
  const previewPath = draft && (video ? draft.thumbnail_path : draft.media_path);
  const mediaWidth = Math.min(width - Spacing.four * 2, MaxContentWidth);
  return <KeyboardAwareScrollView contentContainerStyle={{ width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", padding: Spacing.four, gap: Spacing.three }}>
    <View style={row}>
      {!draft ? <AppButton compact fullWidth={false} title="إضافة" icon="add-outline" disabled={busy} onPress={() => edit()} /> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ ...text, color: colors.errorForeground }}>{error}</Text> : null}
    {draft ? <>
      {field("title", "عنوان الإعلان (اختياري)", 100)}
      {field("body", "النص المختصر (اختياري)", 220)}
      {field("advertiser", "الجهة المعلنة (اختياري)", 100)}
      {field("admin_note", "ملاحظة الإدارة (اختياري)", 500)}
      <View style={row}>{destinations.map(([kind, label]) => <AppButton key={kind} compact fullWidth={false}
        title={draft.target_kind === kind ? `✓ ${label}` : label} variant={draft.target_kind === kind ? "primary" : "outline"}
        disabled={busy} onPress={() => { if (kind !== draft.target_kind) setDraft({ ...draft, target_kind: kind, target_id: "" }); }} />)}</View>
      <HomeAdTargetPicker key={editVersion + ":" + draft.target_kind} owner={owner}
        kind={draft.target_kind} targetId={draft.target_id} disabled={busy}
        onChange={target_id => setDraft(previous => previous ? { ...previous, target_id } : previous)} />
      {field("starts_at", "البداية · YYYY-MM-DD HH:mm", 16)}
      {field("ends_at", "النهاية · YYYY-MM-DD HH:mm", 16)}
      {field("priority", "أولوية العرض", 3)}
      <View style={row}>
        <Text style={text}>تفعيل الإعلان</Text>
        <Switch accessibilityLabel="تفعيل الإعلان" value={draft.is_active} disabled={busy} onValueChange={is_active => setDraft({ ...draft, is_active })} />
      </View>
      <View style={{ gap: Spacing.one, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: colors.surfaceSecondary }}>
        <Text style={text}>الصورة · 16:9، يفضّل 1200 × 675 بكسل، والمقاس الأدنى المقترح 800 × 450.</Text>
        <Text style={text}>الفيديو · 16:9، يفضّل 1280 × 720 بصيغة MP4/H.264 ومن 6 إلى 15 ثانية.</Text>
        <Text style={text}>يملأ الإعلان المساحة دون تمديد. قد تُقص الأطراف عند اختلاف النسبة. المعاينة أدناه تعرض الاقتصاص.</Text>
      </View>
      <View style={row}>
        <AppButton compact fullWidth={false} variant="outline" title="اختيار صورة" disabled={busy} onPress={() => void pick("images")} />
        <AppButton compact fullWidth={false} variant="outline" title="اختيار فيديو" disabled={busy} onPress={() => void pick("videos")} />
        {previewPath && !picked && !mediaUri ? <AppButton compact fullWidth={false} variant="outline" title="معاينة الإعلان" disabled={busy}
          onPress={() => void run(async () => setPreview(await previewHomeAd(owner, previewPath)))} /> : null}
      </View>
      {picked?.mime === "video/mp4" ? <Text style={text}>{picked.name || "الفيديو المحدد"}</Text> : null}
      {picked?.mime === "video/mp4" && !extracting
        ? <AppButton compact fullWidth={false} variant="outline" title="إعادة استخراج الصورة المصغرة"
          disabled={busy} onPress={() => void run(() => prepareThumbnail(picked))} /> : null}
      {extracting ? <Text accessibilityRole="progressbar" style={text}>جارٍ استخراج الصورة المصغرة من الفيديو…</Text> : null}
      {video && draft.media_path && !picked && !previewPath ? <Text style={text}>
        هذا الفيديو القديم بلا صورة مصغرة. أعد اختيار الفيديو لإضافتها.
      </Text> : null}
      {mediaUri ? <View accessibilityLabel={video ? "الصورة المصغرة للفيديو" : "معاينة الإعلان"}
        style={{ width: mediaWidth, aspectRatio: 16 / 9, overflow: "hidden", borderRadius: Radius.lg, backgroundColor: colors.surfaceSecondary }}>
        <ShoppingCardImage uri={mediaUri} restricted icon={video ? "film-outline" : "image-outline"} />
      </View> : null}
      <View style={row}>
        <AppButton compact fullWidth={false} title="حفظ الإعلان" loading={busy} disabled={picked?.mime === "video/mp4" && !picked.thumbnailUri} onPress={() => void save()} />
        <AppButton compact fullWidth={false} variant="outline" title="إلغاء" disabled={busy} onPress={() => { setDraft(undefined); setPreview(""); setPicked(undefined); setError(""); }} />
      </View>
    </> : <>
      <AppButton compact fullWidth={false} variant="outline" title="تحديث القائمة" disabled={busy} onPress={() => void refresh("manual")} />
      {listError ? <Text accessibilityRole="alert" style={{ ...text, color: colors.errorForeground }}>{listError}</Text> : null}
      {!rows && !listError ? <Text style={text}>جارٍ تحميل الإعلانات…</Text> : null}
      {rows?.length === 0 ? <Text style={text}>لا توجد إعلانات.</Text> : null}
      {rows?.map(ad => <View key={ad.id} style={{ padding: Spacing.three, gap: Spacing.two, backgroundColor: colors.surface }}>
        <Text style={text}>{ad.title || ad.advertiser || "إعلان ممول"} · {ad.is_active ? "مفعّل" : "متوقف"}</Text>
        <Text style={text}>{localInput(ad.starts_at)} – {localInput(ad.ends_at)}</Text>
        <View style={row}>
          <AppButton compact fullWidth={false} variant="outline" title="تعديل" disabled={busy} onPress={() => edit(ad)} />
          <AppButton compact fullWidth={false} variant="danger" title="حذف" disabled={busy} onPress={() => void run(async () => {
            if (await dialog.confirm({ title: "حذف الإعلان؟", message: "سيختفي الإعلان من الرئيسية.", confirmText: "حذف", destructive: true })) {
              await deleteHomeAd(owner, ad); await refresh("manual");
            }
          })} />
        </View>
      </View>)}
    </>}
  </KeyboardAwareScrollView>;
}
