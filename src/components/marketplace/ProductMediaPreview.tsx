import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import type { IconName, ProductMedia } from "@/constants/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type ProductMediaPreviewProps = {
  media: ProductMedia;
  width: number;
  height: number;
  fallbackIcon: IconName;
  contentFit?: "cover" | "contain";
  interactive?: boolean;
};

export function ProductMediaPreview({
  media,
  width,
  height,
  fallbackIcon,
  contentFit = "cover",
  interactive = false,
}: ProductMediaPreviewProps) {
  if (!media.uri) {
    return <MediaFallback width={width} height={height} icon={fallbackIcon} />;
  }
  if (media.type === "video") {
    return (
      <ProductVideoPreview
        uri={media.uri}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  return (
    <ProductImagePreview
      uri={media.uri}
      altText={media.altText}
      width={width}
      height={height}
      contentFit={contentFit}
      interactive={interactive}
    />
  );
}

function MediaFallback({ width, height, icon }: { width: number; height: number; icon: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fallback, { width, height, backgroundColor: colors.primaryLight }]}>
      <AppIcon name={icon} size={38} color={colors.primary} />
    </View>
  );
}

function ProductImagePreview({
  uri,
  altText,
  width,
  height,
  contentFit,
  interactive,
}: {
  uri: string;
  altText: string;
  width: number;
  height: number;
  contentFit: "cover" | "contain";
  interactive: boolean;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  if (failed) return <MediaFallback width={width} height={height} icon="image-outline" />;
  const image = (
    <Image
      source={{ uri }}
      style={{ width, height, backgroundColor: colors.primaryLight }}
      contentFit={contentFit}
      accessibilityLabel={altText}
      transition={150}
      onError={() => setFailed(true)}
    />
  );

  if (!interactive) return image;
  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel={`تكبير الصورة: ${altText}`}
      >
        {image}
      </Pressable>
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={[styles.viewer, { backgroundColor: "rgba(0,0,0,0.94)" }]}>
          <Pressable
            onPress={() => setExpanded(false)}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="إغلاق عرض الصورة"
          >
            <AppIcon name="close-outline" size={26} color="#FFFFFF" />
          </Pressable>
          <Image
            source={{ uri }}
            style={{ width: screenWidth - Spacing.four, height: screenHeight - Spacing.ten }}
            contentFit="contain"
            accessibilityLabel={altText}
          />
        </View>
      </Modal>
    </>
  );
}

function ProductVideoPreview({
  uri,
  width,
  height,
  interactive,
}: {
  uri: string;
  width: number;
  height: number;
  interactive: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const poster = (
    <View style={[styles.videoPoster, { width, height, backgroundColor: colors.surfaceSecondary }]}>
      <AppIcon name="videocam-outline" size={34} color={colors.primary} />
      <View style={[styles.playBadge, { backgroundColor: colors.surface }]}>
        <AppIcon name="play" size={18} color={colors.primary} />
      </View>
      <Text style={[styles.videoLabel, { color: colors.textSecondary }]}>فيديو المنتج</Text>
    </View>
  );
  if (!interactive) return poster;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="تشغيل فيديو المنتج"
      >
        {poster}
      </Pressable>
      {open ? <ProductVideoModal uri={uri} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ProductVideoModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { colors } = useTheme();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.muted = false;
    videoPlayer.play();
  });

  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error" || error) {
        setErrorMessage("تعذر تشغيل الفيديو. تحقق من اتصالك ثم حاول مجددًا.");
      }
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoModal}>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="إغلاق مشغل الفيديو"
        >
          <AppIcon name="close-outline" size={26} color="#FFFFFF" />
        </Pressable>
        <VideoView
          player={player}
          style={styles.videoPlayer}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          accessibilityLabel="فيديو المنتج"
        />
        {errorMessage ? (
          <Text accessibilityRole="alert" style={[styles.videoError, { color: colors.surface }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  videoPoster: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  playBadge: {
    alignItems: "center",
    borderRadius: Radius.full,
    height: 44,
    justifyContent: "center",
    marginTop: Spacing.two,
    width: 44,
  },
  videoLabel: { fontFamily: Fonts.medium, fontSize: FontSizes.xs, marginTop: Spacing.one },
  viewer: { alignItems: "center", flex: 1, justifyContent: "center" },
  closeButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: Spacing.three,
    top: Spacing.five,
    width: 48,
    zIndex: 1,
  },
  videoModal: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.96)", flex: 1, justifyContent: "center" },
  videoPlayer: { alignSelf: "center", height: "56%", width: "100%" },
  videoError: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, marginHorizontal: Spacing.five, textAlign: "center" },
});
