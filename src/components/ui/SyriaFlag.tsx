import Svg, { Path } from "react-native-svg";

export function SyriaFlag() {
  return (
    <Svg
      width={36}
      height={24}
      viewBox="0 0 30 20"
      accessible
      accessibilityLabel="علم الجمهورية العربية السورية"
    >
      <Path d="M0 0h30v20H0z" fill="#000000" />
      <Path d="M1 1h28v6H1z" fill="#007a3d" />
      <Path d="M1 13h28v6H1z" fill="#000000" />
      <Path d="M1 7h28v6H1z" fill="#ffffff" />
      <Path
        d="m15 11.061-1.3.939.491-1.526-1.294-.972H14.5L15 8l.5 1.502h1.603l-1.294.972L16.3 12zM8.103 11.061l-1.3.939.491-1.526L6 9.502h1.603L8.103 8l.5 1.502h1.603l-1.294.972.491 1.526zM21.897 11.061l-1.3.939.491-1.526-1.294-.972h1.603l.5-1.502.5 1.502H24l-1.294.972.491 1.526z"
        fill="#ce1126"
      />
    </Svg>
  );
}
