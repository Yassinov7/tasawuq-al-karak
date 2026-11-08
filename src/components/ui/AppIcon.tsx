import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleProp, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

type AppIconName = keyof typeof Ionicons.glyphMap;

type AppIconProps = {
  tone?: "default" | "muted" | "success" | "warning" | "error" | "info";
  name: AppIconName;
  size?: number;
  color?: string;
  active?: boolean;
  style?: StyleProp<TextStyle>;
};

export function AppIcon({
  tone = "default",
  name,
  size = 24,
  color,
  active = false,
  style,
}: AppIconProps) {
  const { colors } = useTheme();

  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? (tone === "default" ? active ? colors.primary : colors.textMuted : tone === "muted" ? colors.textSecondary : colors[`${tone}Foreground`])}
      style={style}
    />
  );
}
