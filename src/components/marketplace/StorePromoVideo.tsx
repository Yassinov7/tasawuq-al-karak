import { useFocusEffect, useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppButton } from "@/components/ui/AppButton";
import { FontSizes, Fonts, Radius, RtlText, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { signPublishedStoreVideo, type PublishedStoreVideo } from "@/lib/customer-store-details";

function PromoPlayer({ url, onEnd, onError, onFullscreenEnter, onFullscreenExit }: {
  url: string;
  onEnd: () => void;
  onError: () => void;
  onFullscreenEnter: () => void;
  onFullscreenExit: () => void;
}) {
  const player = useVideoPlayer(url, video => {
    video.loop = false;
    video.staysActiveInBackground = false;
    video.muted = Platform.OS === "web";
  });

  useEffect(() => {
    const ended = player.addListener("playToEnd", onEnd);
    const status = player.addListener("statusChange", event => { if (event.status === "error") onError(); });
    try {
      if (player.status === "error") onError();
      else player.play();
    } catch {
      onError();
    }
    // The hook owns release. Cleanup never issues playback commands.
    return () => { ended.remove(); status.remove(); };
  }, [onEnd, onError, player]);

  return <VideoView player={player} style={StyleSheet.absoluteFill}
    contentFit="contain" surfaceType="textureView" nativeControls
    fullscreenOptions={{ enable: true, orientation: "landscape" }}
    onFullscreenEnter={onFullscreenEnter} onFullscreenExit={onFullscreenExit} />;
}

type Props = { asset: PublishedStoreVideo; owner: string | null };

export function StorePromoVideo({ asset, owner }: Props) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(() => AppState.currentState === null || AppState.currentState === "active");
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const fullscreen = useRef(false);
  const endedInFullscreen = useRef(false);
  const failedInFullscreen = useRef(false);
  const stop = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setUrl(undefined);
    setLoading(false);
  }, []);
  const onEnd = useCallback(() => {
    if (fullscreen.current) {
      endedInFullscreen.current = true;
      return;
    }
    stop();
  }, [stop]);
  const onError = useCallback(() => {
    if (fullscreen.current) {
      failedInFullscreen.current = true;
      return;
    }
    stop();
    setFailed(true);
  }, [stop]);
  const onFullscreenEnter = useCallback(() => {
    fullscreen.current = true;
  }, []);
  const onFullscreenExit = useCallback(() => {
    fullscreen.current = false;
    if (failedInFullscreen.current) {
      failedInFullscreen.current = false;
      endedInFullscreen.current = false;
      stop();
      setFailed(true);
    } else if (endedInFullscreen.current) {
      endedInFullscreen.current = false;
      stop();
    }
  }, [stop]);

  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (fullscreen.current) return;
      setForeground(state === "active");
      if (state !== "active") stop();
    });
    setForeground(AppState.currentState === null || AppState.currentState === "active");
    return () => { subscription.remove(); stop(); };
  }, [stop]));

  const start = async () => {
    if (!focused || !foreground || request.current) return;
    const operation = new AbortController();
    request.current = operation;
    setLoading(true);
    setFailed(false);
    endedInFullscreen.current = false;
    failedInFullscreen.current = false;
    try {
      const signed = await signPublishedStoreVideo(asset, owner, operation.signal);
      if (!operation.signal.aborted) setUrl(signed);
    } catch {
      if (!operation.signal.aborted) setFailed(true);
    } finally {
      if (request.current === operation) {
        request.current = null;
        setLoading(false);
      }
    }
  };
  if (failed && !loading) return <View style={[styles.failure, { backgroundColor: colors.surfaceSecondary }]}>
    <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.error }]}>تعذر تشغيل الفيديو.</Text>
    <AppButton compact title="إعادة المحاولة" icon="refresh-outline" variant="outline" fullWidth={false}
      onPress={() => void start()} />
  </View>;

  return <View style={styles.container}>
    {focused && foreground && url ? <View style={[styles.frame, { backgroundColor: colors.surfaceSecondary }]}>
      <PromoPlayer url={url} onEnd={onEnd} onError={onError}
        onFullscreenEnter={onFullscreenEnter} onFullscreenExit={onFullscreenExit} />
      <View style={styles.mediaAction} pointerEvents="box-none">
        <AppButton compact title="إيقاف الفيديو" icon="pause-outline" variant="outline" fullWidth={false} onPress={stop} />
      </View>
    </View> : <View style={[styles.frame, styles.preview, { backgroundColor: colors.primaryLight }]}>
      <View style={styles.poster}>
        <BrandMark size="medium" />
      </View>
      <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>معاينة افتراضية للفيديو</Text>
      <View style={styles.mediaAction} pointerEvents="box-none">
        <AppButton compact title="تشغيل الفيديو" icon="play-outline" variant="outline" fullWidth={false}
          loading={loading} onPress={() => void start()} />
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: {},
  frame: { aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: "hidden", position: "relative" },
  preview: { alignItems: "center", justifyContent: "center" },
  poster: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    alignItems: "center", justifyContent: "center", opacity: 0.72 },
  previewLabel: { position: "absolute", right: Spacing.two, bottom: Spacing.two,
    fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
  mediaAction: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    alignItems: "center", justifyContent: "center", zIndex: 2, elevation: 2 },
  failure: { minHeight: 48, borderRadius: Radius.md, padding: Spacing.two, flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: Spacing.two },
  message: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, ...RtlText },
});
