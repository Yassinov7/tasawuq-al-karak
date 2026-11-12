import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ShoppingCardImage } from "@/components/marketplace/ShoppingCardImage";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { adSwipeDirection, nextAdIndex, stillAdMs, videoAdLimitMs } from "@/lib/home-ad-carousel";
import type { CustomerHomeAd } from "@/lib/customer-home-feed";

function BannerVideo({ url, paused, poster, onEnd, onRetire }: {
  url: string; paused: boolean; poster: ReactNode; onEnd: () => void; onRetire: () => void;
}) {
  const [ready, setReady] = useState(false);
  const started = useRef(false);
  // A renewed signature for this same version must not replace an in-flight stream.
  const [source] = useState(url);
  const player = useVideoPlayer(source, video => {
    video.muted = true;
    video.loop = false;
    video.staysActiveInBackground = false;
  });

  useEffect(() => {
    const ended = player.addListener("playToEnd", onEnd);
    const status = player.addListener("statusChange", event => { if (event.status === "error") onRetire(); });
    if (player.status === "error") onRetire();
    return () => { ended.remove(); status.remove(); };
  }, [player, onEnd, onRetire]);

  useEffect(() => () => {
    // Keep the poster on return if this stream already rendered before the screen blurred.
    if (started.current) onRetire();
  }, [onRetire]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
    // useVideoPlayer releases the native player on unmount. Only control it while mounted.
  }, [player, paused]);

  return <>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover"
      surfaceType="textureView" nativeControls={false} onFirstFrameRender={() => { started.current = true; setReady(true); }} />
    {ready ? null : poster}
  </>;
}

export function CustomerHomeSponsored({ ads, onOpen }: { ads: CustomerHomeAd[]; onOpen: (ad: CustomerHomeAd) => void }) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(() => AppState.currentState === null || AppState.currentState === "active");
  const [motion, setMotion] = useState({ reduced: true, reader: Platform.OS !== "web" });
  const [selected, setSelected] = useState<string>();
  const [interacting, setInteracting] = useState(false);
  const interaction = useRef(false);
  const [seenVideos, setSeenVideos] = useState<ReadonlySet<string>>(() => new Set());
  const swiping = useRef(false);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const app = AppState.addEventListener("change", state => setForeground(state === "active"));
    let active = true;
    let motionChanged = false, readerChanged = false;
    const motionSub = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
      motionChanged = true;
      setMotion(previous => ({ ...previous, reduced }));
    });
    const readerSub = Platform.OS !== "web" ? AccessibilityInfo.addEventListener("screenReaderChanged", reader => {
      readerChanged = true;
      setMotion(previous => ({ ...previous, reader }));
    }) : undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (active && !motionChanged) setMotion(previous => ({ ...previous, reduced }));
    }).catch(() => {});
    if (Platform.OS !== "web") void AccessibilityInfo.isScreenReaderEnabled().then(reader => {
      if (active && !readerChanged) setMotion(previous => ({ ...previous, reader }));
    }).catch(() => {});
    return () => { active = false; app.remove(); motionSub?.remove(); readerSub?.remove(); };
  }, []);

  const visible = focused && foreground;
  const auto = visible && !motion.reduced && !motion.reader;
  const index = Math.max(0, ads.findIndex(ad => ad.id === selected));
  const ad = ads[index];
  const key = ad?.mediaKey;
  const playVideo = Boolean(auto && ad?.media_kind === "video" && key && !seenVideos.has(key));
  const previousId = ads[nextAdIndex(index, ads.length, -1)]?.id;
  const nextId = ads[nextAdIndex(index, ads.length, 1)]?.id;
  const multiple = ads.length > 1;

  const markVideo = useCallback(() => {
    if (playVideo && key) {
      setSeenVideos(previous => previous.has(key) ? previous : new Set(previous).add(key));
    }
  }, [key, playVideo]);
  const move = useCallback((direction: 1 | -1) => {
    markVideo();
    if (multiple) setSelected(direction === 1 ? nextId : previousId);
  }, [markVideo, multiple, nextId, previousId]);
  const begin = useCallback(() => { interaction.current = true; setInteracting(true); }, []);
  const end = useCallback(() => { interaction.current = false; setInteracting(false); }, []);
  const endSwipe = useCallback(() => { swiping.current = false; end(); }, [end]);
  const finish = useCallback(() => {
    if (interaction.current) markVideo();
    else move(1);
  }, [markVideo, move]);

  useEffect(() => {
    if (!auto || interacting || !key || (!multiple && !playVideo)) return;
    const timer = setTimeout(() => { if (!interaction.current) move(1); }, playVideo ? videoAdLimitMs : stillAdMs);
    return () => clearTimeout(timer);
  }, [auto, interacting, key, move, multiple, playVideo]);

  useEffect(() => {
    if (motion.reduced || !visible || !key) { opacity.setValue(1); return; }
    opacity.setValue(0.82);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [key, motion.reduced, opacity, visible]);

  if (!ad) return null;
  const isVideo = ad.media_kind === "video";
  const poster = <View style={[styles.poster, { backgroundColor: colors.surfaceSecondary }]}>
    <ShoppingCardImage uri={isVideo ? ad.thumbnailUrl : ad.url}
      cacheKey={isVideo ? ad.thumbnailKey : ad.mediaKey} restricted icon={isVideo ? "film-outline" : "image-outline"} />
  </View>;
  return <View style={[styles.banner, { backgroundColor: colors.surfaceSecondary }]}
    onTouchStart={event => { start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }}
    onMoveShouldSetResponderCapture={event => {
      if (!multiple || !start.current) return false;
      const dx = Math.abs(event.nativeEvent.pageX - start.current.x);
      const dy = Math.abs(event.nativeEvent.pageY - start.current.y);
      return dx > 12 && dx > dy * 1.3;
    }}
    onResponderGrant={() => { swiping.current = true; begin(); }}
    onResponderRelease={event => {
      const direction = start.current && adSwipeDirection(event.nativeEvent.pageX - start.current.x);
      if (direction) move(direction);
      endSwipe();
    }}
    onResponderTerminate={endSwipe}>
    <Pressable style={styles.hitArea} accessibilityRole="link"
      accessibilityLabel={["ممول", ad.title || "فتح الإعلان", multiple ? (index + 1) + " من " + ads.length : ""].filter(Boolean).join("، ")}
      accessibilityActions={multiple ? [{ name: "increment", label: "الإعلان التالي" }, { name: "decrement", label: "الإعلان السابق" }] : undefined}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === "increment") move(1);
        if (event.nativeEvent.actionName === "decrement") move(-1);
      }}
      onPressIn={begin} onPressOut={() => { if (!swiping.current) end(); }} onPress={() => onOpen(ad)}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none"
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {playVideo ? <BannerVideo key={key} url={ad.url} paused={interacting} poster={poster}
          onEnd={finish} onRetire={markVideo} /> : poster}
        <Text style={[styles.badge, { color: colors.text, backgroundColor: colors.surface }]}>ممول</Text>
        {multiple ? <View style={[styles.dots, { backgroundColor: colors.surface }]}>
          {ads.map((item, position) => <View key={item.id}
            style={[styles.dot, { backgroundColor: position === index ? colors.primary : colors.borderStrong }]} />)}
        </View> : null}
      </Animated.View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: Spacing.four, aspectRatio: 16 / 9, borderRadius: Radius.lg, overflow: "hidden" },
  hitArea: { flex: 1 },
  poster: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: Spacing.two, right: Spacing.two, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two, fontFamily: Fonts.medium, fontSize: FontSizes.xs },
  dots: { position: "absolute", bottom: Spacing.two, alignSelf: "center", flexDirection: "row-reverse",
    gap: Spacing.one, borderRadius: Radius.full, padding: Spacing.one },
  dot: { width: 6, height: 6, borderRadius: Radius.full },
});
