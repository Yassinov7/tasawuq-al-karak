import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppIcon } from "@/components/ui/AppIcon";
import { useTheme } from "@/context/ThemeContext";
import type { IconName } from "@/types/catalog";

export function ShoppingCardImage({ uri, cacheKey, restricted = false, icon, fit = "cover" }: {
  uri?: string;
  cacheKey?: string;
  restricted?: boolean;
  icon: IconName;
  fit?: "cover" | "contain";
}) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string>();
  return uri && uri !== failedUri ? (
    <Image source={{ uri, cacheKey }} recyclingKey={cacheKey ?? uri}
      style={StyleSheet.absoluteFill} contentFit={fit}
      cachePolicy={restricted ? "memory" : "memory-disk"}
      accessible={false} onError={() => setFailedUri(uri)} />
  ) : <View accessible={false}><AppIcon name={icon} size={24} color={colors.primary} /></View>;
}
