import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Typography } from "@/constants/theme";
import { focusedFieldScroll, keyboardFormLayout } from "@/lib/keyboard-visibility";

type FocusTarget = { measureInWindow: View["measureInWindow"] };
type FormFocus = { focus: (field: FocusTarget) => void; blur: (field: FocusTarget) => void };
const FormFocusContext = createContext<FormFocus | null>(null);
export const useFormFocus = () => useContext(FormFocusContext);

/** One keyboard strategy per form: measured space + focused-field scrolling; no nested KAV. */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView({ children, contentContainerStyle, onScroll, onLayout, ...props }, forwardedRef) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null), viewport = useRef<View>(null);
  const field = useRef<FocusTarget | null>(null), offset = useRef(0), keyboardTop = useRef<number | null>(null);
  const frame = useRef<number | null>(null), measurement = useRef(0);
  const [space, setSpace] = useState({ overlap: 0, bottomSpace: 0 });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useImperativeHandle(forwardedRef, () => scroll.current!, []);
  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const token = ++measurement.current;
        viewport.current?.measureInWindow((_x, y, _width, height) => {
          if (token !== measurement.current || keyboardTop.current === null) return;
          const layout = keyboardFormLayout(y, height, keyboardTop.current);
          setSpace(previous => previous.overlap === layout.overlap && previous.bottomSpace === layout.bottomSpace ? previous : layout);
          const focused = field.current;
          focused?.measureInWindow((_fx, fy, _fw, fh) => {
            if (token !== measurement.current || field.current !== focused || keyboardTop.current === null) return;
            const next = focusedFieldScroll(offset.current, fy, fh, y, layout.visibleBottom);
            if (Math.abs(next - offset.current) > 1) scroll.current?.scrollTo({ y: next, animated: true });
          });
        });
      });
    });
  }, []);
  const cancelMeasurements = useCallback(() => {
    measurement.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", event => { keyboardTop.current = event.endCoordinates.screenY; setKeyboardOpen(true); reveal(); });
    const change = Keyboard.addListener("keyboardDidChangeFrame", event => { if (keyboardTop.current !== null) { keyboardTop.current = event.endCoordinates.screenY; reveal(); } });
    const hide = Keyboard.addListener("keyboardDidHide", () => { keyboardTop.current = null; measurement.current++; setKeyboardOpen(false); setSpace({ overlap: 0, bottomSpace: 0 }); });
    return () => { show.remove(); change.remove(); hide.remove(); cancelMeasurements(); };
  }, [reveal, cancelMeasurements]);
  const focus = useMemo<FormFocus>(() => ({ focus: target => { field.current = target; reveal(); }, blur: target => { if (field.current === target) field.current = null; } }), [reveal]);
  return <FormFocusContext.Provider value={focus}>
    <View ref={viewport} style={{ flex: 1 }} onLayout={reveal}>
      <ScrollView {...props} ref={scroll} style={[{ flex: 1 }, props.style]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={false} scrollsChildToFocus scrollEventThrottle={16} contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]} onContentSizeChange={(w,h) => { props.onContentSizeChange?.(w,h); reveal(); }} onLayout={event => { onLayout?.(event); reveal(); }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}>
        {children}
        <View style={{ height: space.bottomSpace }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>
      </ScrollView>
      {keyboardOpen ? <Pressable accessibilityRole="button" accessibilityLabel="إخفاء لوحة المفاتيح" onPress={Keyboard.dismiss} style={{ position: "absolute", bottom: space.overlap, start: 0, end: 0, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.borderStrong }}><Text style={{ ...Typography.bodyStrong, color: colors.primary }}>إخفاء لوحة المفاتيح</Text></Pressable> : null}
    </View>
  </FormFocusContext.Provider>;
});
