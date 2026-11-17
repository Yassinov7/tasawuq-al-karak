import { I18nManager } from "react-native";

// Native layout mirrors these values when the app already runs in RTL.
const isRTL = I18nManager.isRTL;
export const arabicRowDirection = isRTL ? "row" : "row-reverse";
export const arabicStart = isRTL ? "flex-start" : "flex-end";
// Fabric also mirrors explicit left/right paragraph alignment in RTL.
export const arabicTextAlign = isRTL ? "left" : "right";
