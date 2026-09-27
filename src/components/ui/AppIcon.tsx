import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleProp, TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

type AppIconName = keyof typeof Ionicons.glyphMap;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  active?: boolean;
  style?: StyleProp<TextStyle>;
};

export function AppIcon({
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
      color={color ?? (active ? colors.primary : colors.textMuted)}
      style={style}
    />
  );
}
