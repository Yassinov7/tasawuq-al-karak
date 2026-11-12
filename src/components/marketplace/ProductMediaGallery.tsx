import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductMediaPreview } from "@/components/marketplace/ProductMediaPreview";
import { AppIcon } from "@/components/ui/AppIcon";
import type { IconName, Product } from "@/types/catalog";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type ProductMediaGalleryProps = {
  activeMediaIndex: number;
  categoryIcon?: IconName;
  favorite: boolean;
  onSelectMedia: (index: number) => void;
  onToggleFavorite: () => void;
  product: Product;
  width: number;
};

export function ProductMediaGallery({
  activeMediaIndex,
  categoryIcon,
  favorite,
  onSelectMedia,
  onToggleFavorite,
  product,
  width,
}: ProductMediaGalleryProps) {
  const { colors } = useTheme();
  const activeMedia = product.media?.[activeMediaIndex];

  return (
    <>
      <View style={[styles.preview, { backgroundColor: product.offer ? colors.accentLight : colors.primaryLight }]}>
        {activeMedia ? (
          <ProductMediaPreview
            key={activeMedia.id}
            media={activeMedia}
            width={width}
            height={270}
            fallbackIcon={categoryIcon ?? "cube-outline"}
            contentFit="contain"
            interactive
          />
        ) : (
          <AppIcon name={categoryIcon ?? "cube-outline"} size={78} color={colors.primary} />
        )}

        <Pressable
          onPress={onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          accessibilityState={{ selected: favorite }}
          style={({ pressed }) => [
            styles.favoriteButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <AppIcon name={favorite ? "heart" : "heart-outline"} size={23} color={favorite ? colors.error : colors.textSecondary} />
        </Pressable>

        {product.offer ? (
          <View style={[styles.offerBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.offerBadgeText, { color: colors.surface }]}>عرض</Text>
          </View>
        ) : null}
      </View>

      {product.media && product.media.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
          {product.media.map((media, index) => {
            const selected = index === activeMediaIndex;
            return (
              <Pressable
                key={media.id}
                onPress={() => onSelectMedia(index)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={media.type === "video" ? "عرض فيديو المنتج" : `عرض صورة ${media.altText}`}
                style={[
                  styles.thumbnail,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                {media.type === "image" ? (
                  <Image source={{ uri: media.uri }} contentFit="cover" style={styles.thumbnailImage} accessibilityLabel={media.altText} />
                ) : (
                  <AppIcon name="videocam-outline" size={25} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: "center", borderRadius: Radius.xl, height: 270, justifyContent: "center", overflow: "hidden", position: "relative" },
  favoriteButton: { alignItems: "center", borderRadius: Radius.full, borderWidth: 1, height: 46, justifyContent: "center", left: Spacing.three, position: "absolute", top: Spacing.three, width: 46 },
  offerBadge: { alignItems: "center", borderRadius: Radius.full, justifyContent: "center", paddingHorizontal: Spacing.three, paddingVertical: 5, position: "absolute", right: Spacing.three, top: Spacing.three },
  offerBadgeText: { fontFamily: Fonts.bold, fontSize: FontSizes.xs },
  thumbnails: { flexDirection: "row-reverse", gap: Spacing.two, paddingTop: Spacing.two },
  thumbnail: { alignItems: "center", borderRadius: Radius.md, height: 64, justifyContent: "center", overflow: "hidden", width: 64 },
  thumbnailImage: { height: "100%", width: "100%" },
  pressed: { opacity: 0.72 },
});
