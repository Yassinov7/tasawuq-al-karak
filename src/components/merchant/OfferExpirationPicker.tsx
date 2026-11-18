import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { arabicRowDirection, arabicTextAlign } from "@/lib/arabic-layout";
import { moveOfferMonth, offerCalendarCells, parseOfferDay } from "@/lib/offer-expiration";
import {
  canSelectSyriaOfferDay, formatSyriaOfferTime, keepsSavedSyriaOfferTime,
  syriaOfferFields, syriaOfferInstant, validateSyriaOfferTime,
} from "@/lib/offer-syria-time";

type Selection = { mode: "keep" | "none" } | { mode: "new"; date: string; time: string; instant: string };
type Props = {
  kind?: "start" | "end"; mode: "keep" | "none" | "new"; original: string | null;
  date: string; time: string; selectedInstant?: string; now: number; startsAt?: string;
  disabled: boolean; error?: string; allowNone?: boolean; onSelect: (value: Selection) => void;
};
type Draft = { date: string; hour: string; minute: string; year: number; month: number };
const pad = (value: number) => String(value).padStart(2, "0");
const arabic = (value: number) => value.toLocaleString("ar-SY", { useGrouping: false });
const dayLabels = ["سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع"];
const fullDayLabels = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function monthLabel(year: number, month: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, 1);
  return date.toLocaleString("ar-SY", { calendar: "gregory", month: "long", timeZone: "UTC" });
}
function digits(value: string) {
  return value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/[^0-9]/g, "");
}
function seed(props: Props): Draft {
  const minimum = props.kind !== "start" && props.startsAt ? Math.max(props.now, Date.parse(props.startsAt)) : props.now;
  const current = syriaOfferFields(minimum);
  if (props.mode === "keep" && props.original && Number.isFinite(Date.parse(props.original))) {
    const saved = syriaOfferFields(props.original);
    return { date: saved.date, hour: pad(saved.hour), minute: pad(saved.minute), year: saved.year, month: saved.month };
  }
  if (props.mode === "new") {
    try {
      const day = parseOfferDay(props.date);
      const [hour = "", minute = ""] = props.time.split(":");
      return { date: props.date, hour, minute, year: day.year, month: day.month };
    } catch { /* An incomplete draft opens on the current Syrian month. */ }
  }
  return { date: "", hour: "", minute: "", year: current.year, month: current.month };
}

export function OfferExpirationPicker(props: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const isStart = props.kind === "start";
  let displayed = props.mode === "keep" ? props.original : null;
  if (props.mode === "new") {
    try { displayed = props.selectedInstant ?? syriaOfferInstant(props.date, props.time); }
    catch { /* The field's validation describes an incomplete selection. */ }
  }
  const readable = displayed && Number.isFinite(Date.parse(displayed)) ? formatSyriaOfferTime(displayed) : null;
  return <View style={styles.stack}>
    <Text style={[styles.strong, { color: colors.text }]}>{isStart ? "بداية العرض" : "نهاية العرض"}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={isStart ? "اختيار بداية العرض" : "اختيار نهاية العرض"}
      disabled={props.disabled} accessibilityState={{ disabled: props.disabled }}
      onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.field, { backgroundColor: pressed ? colors.surfacePressed : colors.surface,
        borderColor: props.error ? colors.errorBorder : colors.borderStrong, opacity: props.disabled ? 0.6 : 1 }]}>
      <AppIcon name="calendar-outline" size={22} color={colors.primary} />
      <View style={styles.fieldText}>
        <Text style={[styles.strong, { color: colors.text }]}>
          {props.mode === "none" ? (isStart ? "يبدأ الآن" : "بدون تاريخ انتهاء") : readable ?? "اختر اليوم والوقت"}
        </Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>بتوقيت سوريا · نظام 24 ساعة</Text>
      </View>
      <AppIcon name="chevron-back-outline" size={18} color={colors.textSecondary} />
    </Pressable>
    <View style={styles.choices}>
      {props.allowNone !== false ? <AppButton compact fullWidth={false}
        title={isStart ? "يبدأ الآن" : "بدون تاريخ انتهاء"} variant={props.mode === "none" ? "secondary" : "outline"}
        disabled={props.disabled} onPress={() => props.onSelect({ mode: "none" })} /> : null}
      {props.original ? <AppButton compact fullWidth={false} title="إبقاء الموعد المحفوظ"
        variant={props.mode === "keep" ? "secondary" : "outline"} disabled={props.disabled}
        onPress={() => props.onSelect({ mode: "keep" })} /> : null}
    </View>
    {!isStart && props.original && Date.parse(props.original) <= props.now ?
      <Text style={[styles.caption, { color: colors.warningForeground }]}>الموعد المحفوظ منتهٍ. اختر نهاية مستقبلية أو أوقف العرض.</Text> : null}
    {props.error ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.errorForeground }]}>{props.error}</Text> : null}
    {open ? <ExpirationDialog {...props} close={() => setOpen(false)}
      commit={value => { if (!props.disabled) { props.onSelect(value); setOpen(false); } }} /> : null}
  </View>;
}

function ExpirationDialog(props: Props & { close: () => void; commit: (value: Selection) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => seed(props));
  const [jump, setJump] = useState(false);
  const [yearText, setYearText] = useState(String(draft.year));
  const [error, setError] = useState("");
  const [now] = useState(() => Math.max(props.now, Date.now()));
  const isStart = props.kind === "start";
  const today = syriaOfferFields(now).date;
  const minimumStart = isStart ? undefined : props.startsAt;
  const yearValue = Number(yearText);
  const validYear = /^\d{1,4}$/.test(yearText) && yearValue >= 1 && yearValue <= 9999;
  const monthCells = offerCalendarCells(draft.year, draft.month);
  // Pad the last week so every row has seven identical cells.
  const cells = [...monthCells, ...Array<null>((7 - monthCells.length % 7) % 7).fill(null)];
  const update = (patch: Partial<Draft>) => { setDraft(previous => ({ ...previous, ...patch })); setError(""); };
  const changeMonth = (delta: number) => update(moveOfferMonth(draft.year, draft.month, delta));
  const hourInvalid = draft.hour !== "" && Number(draft.hour) > 23;
  const minuteInvalid = draft.minute !== "" && Number(draft.minute) > 59;
  let summary = "اختر يومًا من التقويم، ثم أدخل الساعة والدقيقة.";
  if (draft.date && draft.hour !== "" && draft.minute !== "" && !hourInvalid && !minuteInvalid) {
    try { summary = formatSyriaOfferTime(syriaOfferInstant(draft.date, `${draft.hour.padStart(2, "0")}:${draft.minute.padStart(2, "0")}`)); }
    catch { summary = "راجع اليوم والوقت المختارين."; }
  }
  const confirm = () => {
    if (props.disabled) return;
    try {
      if (!draft.date) throw new Error("اختر يوم الموعد من التقويم.");
      if (draft.hour === "" || draft.minute === "") throw new Error("أدخل الساعة والدقيقة لإكمال الموعد.");
      const time = `${draft.hour.padStart(2, "0")}:${draft.minute.padStart(2, "0")}`;
      if (props.mode === "keep" && keepsSavedSyriaOfferTime(props.original, draft.date, time)) {
        if (!props.original || (!isStart && Date.parse(props.original) <= Date.now())) throw new Error("الموعد المحفوظ منتهٍ؛ اختر موعدًا جديدًا.");
        if (minimumStart && Date.parse(props.original) <= Date.parse(minimumStart)) throw new Error("يجب أن تكون النهاية بعد بداية العرض.");
        props.commit({ mode: "keep" });
        return;
      }
      const instant = validateSyriaOfferTime(draft.date, time, Math.max(props.now, Date.now()), minimumStart);
      props.commit({ mode: "new", date: draft.date, time, instant });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "راجع اليوم والوقت المختارين."); }
  };

  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={props.close}>
    <View style={[styles.overlay, { backgroundColor: colors.overlayScrim,
      paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.two }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="إلغاء اختيار الموعد" style={StyleSheet.absoluteFill} onPress={props.close} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalHost}>
        <View accessibilityViewIsModal style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={[styles.dialogHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{isStart ? "موعد بداية العرض" : "موعد انتهاء العرض"}</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>بتوقيت سوريا · نظام 24 ساعة</Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent} style={styles.scroll}>
            <View style={styles.monthHeader}>
              <MonthArrow label="الشهر السابق" icon="chevron-forward-outline"
                disabled={props.disabled || draft.year === 1 && draft.month === 1} onPress={() => changeMonth(-1)} />
              <Pressable accessibilityRole="button" accessibilityLabel="اختيار الشهر والسنة" disabled={props.disabled}
                onPress={() => { setYearText(String(draft.year)); setJump(!jump); }} style={styles.monthTitle}>
                <Text style={[styles.strong, { color: colors.text }]}>{monthLabel(draft.year, draft.month)} {arabic(draft.year)}</Text>
                <AppIcon name={jump ? "chevron-up-outline" : "chevron-down-outline"} size={16} color={colors.primary} />
              </Pressable>
              <MonthArrow label="الشهر التالي" icon="chevron-back-outline"
                disabled={props.disabled || draft.year === 9999 && draft.month === 12} onPress={() => changeMonth(1)} />
            </View>
            {jump ? <View style={styles.stack}>
              <AppTextField label="السنة" value={yearText} onChangeText={value => setYearText(digits(value).slice(0, 4))}
                keyboardType="number-pad" maxLength={4} textAlign="center" disabled={props.disabled}
                error={!validYear ? "أدخل سنة صحيحة من 1 إلى 9999." : undefined} />
              <View style={styles.monthGrid}>{Array.from({ length: 12 }, (_, index) => index + 1).map(month =>
                <Pressable key={month} accessibilityRole="button" disabled={props.disabled || !validYear}
                  onPress={() => { update({ year: yearValue, month }); setJump(false); }}
                  style={[styles.monthChoice, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.caption, { color: colors.text }]}>{monthLabel(draft.year, month)}</Text>
                </Pressable>)}</View>
            </View> : <View>
              <View style={styles.weekRow}>{dayLabels.map((label, index) => <View key={label} style={styles.weekCell}>
                <Text accessibilityLabel={fullDayLabels[index]} style={[styles.weekLabel, { color: colors.textSecondary }]}>{label}</Text>
              </View>)}</View>
              {Array.from({ length: cells.length / 7 }, (_, week) => <View key={week} style={styles.weekRow}>
                {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
                  if (day === null) return <View key={column} style={styles.weekCell} />;
                  const date = `${String(draft.year).padStart(4, "0")}-${pad(draft.month)}-${pad(day)}`;
                  const selected = date === draft.date, current = date === today;
                  const disabled = props.disabled || !canSelectSyriaOfferDay(date, now, minimumStart);
                  return <Pressable key={column} accessibilityRole="button"
                    accessibilityLabel={`${arabic(day)} ${monthLabel(draft.year, draft.month)} ${arabic(draft.year)}${current ? "، اليوم" : ""}`}
                    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => update({ date })}
                    style={({ pressed }) => [styles.day, { backgroundColor: selected ? colors.primary : pressed ? colors.surfacePressed : colors.surface,
                      borderColor: current ? colors.primary : selected ? colors.primary : "transparent", opacity: disabled ? 0.4 : 1 }]}>
                    <Text style={[styles.dayNumber, { color: selected ? colors.onPrimary : colors.text }]}>{arabic(day)}</Text>
                    {current ? <View style={[styles.todayDot, { backgroundColor: selected ? colors.onPrimary : colors.primary }]} /> : null}
                  </Pressable>;
                })}
              </View>)}
              <View style={styles.legend}><Text style={[styles.caption, { color: colors.textSecondary }]}>اليوم الحالي بإطار · اليوم المحدد ملوّن</Text></View>
            </View>}
            <View style={[styles.timeSection, { borderColor: colors.borderSubtle }]}>
              <Text style={[styles.strong, { color: colors.text }]}>الوقت</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeField}><AppTextField label="الساعة" value={draft.hour}
                  placeholder="00–23" keyboardType="number-pad" maxLength={2} textAlign="center" disabled={props.disabled}
                  onChangeText={value => update({ hour: digits(value).slice(0, 2) })}
                  error={hourInvalid ? "من 00 إلى 23" : undefined} /></View>
                <View style={styles.timeField}><AppTextField label="الدقيقة" value={draft.minute}
                  placeholder="00–59" keyboardType="number-pad" maxLength={2} textAlign="center" disabled={props.disabled}
                  onChangeText={value => update({ minute: digits(value).slice(0, 2) })}
                  error={minuteInvalid ? "من 00 إلى 59" : undefined} /></View>
              </View>
            </View>
            <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.strong, { color: colors.text }]}>{summary}</Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>بتوقيت سوريا</Text>
            </View>
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.body, { color: colors.errorForeground }]}>{error}</Text> : null}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.footerButton}><AppButton title="تأكيد الموعد" disabled={props.disabled} onPress={confirm} /></View>
            <View style={styles.footerButton}><AppButton title="إلغاء" variant="outline" onPress={props.close} /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

function MonthArrow({ label, icon, disabled, onPress }: {
  label: string; icon: "chevron-forward-outline" | "chevron-back-outline"; disabled: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceSecondary, opacity: disabled ? 0.4 : 1 }]}>
    <AppIcon name={icon} size={20} color={colors.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.two },
  body: { ...Typography.body, textAlign: arabicTextAlign },
  strong: { ...Typography.bodyStrong, textAlign: arabicTextAlign, flexShrink: 1 },
  title: { ...Typography.cardTitle, textAlign: arabicTextAlign },
  caption: { ...Typography.caption, textAlign: arabicTextAlign },
  field: { flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.two, borderWidth: 1,
    borderRadius: Radius.md, padding: Spacing.three, minHeight: 64 },
  fieldText: { flex: 1, minWidth: 0, gap: Spacing.one },
  choices: { flexDirection: arabicRowDirection, flexWrap: "wrap", gap: Spacing.two },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.two },
  modalHost: { width: "100%", maxWidth: 440, maxHeight: "100%", flexShrink: 1 },
  modal: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, maxHeight: "100%", flexShrink: 1, overflow: "hidden" },
  dialogHeader: { padding: Spacing.three, gap: Spacing.half, borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { flexShrink: 1, minHeight: 0 },
  dialogContent: { padding: Spacing.two, gap: Spacing.three },
  monthHeader: { flexDirection: arabicRowDirection, alignItems: "center", gap: Spacing.one },
  monthTitle: { flex: 1, minHeight: 48, flexDirection: arabicRowDirection, flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: Spacing.one },
  arrow: { minWidth: 44, minHeight: 48, borderRadius: Radius.md, justifyContent: "center", alignItems: "center" },
  weekRow: { flexDirection: arabicRowDirection },
  weekCell: { flex: 1, minWidth: 0, minHeight: 40, justifyContent: "center", alignItems: "center" },
  weekLabel: { ...Typography.caption, textAlign: "center" },
  day: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: Spacing.two, borderWidth: 1,
    borderRadius: Radius.md, justifyContent: "center", alignItems: "center" },
  dayNumber: { ...Typography.bodyStrong, textAlign: "center" },
  todayDot: { width: 4, height: 4, borderRadius: Radius.full, marginTop: Spacing.half },
  legend: { marginTop: Spacing.one },
  timeSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  timeRow: { flexDirection: arabicRowDirection, flexWrap: "wrap", gap: Spacing.two },
  timeField: { flexGrow: 1, flexBasis: 100, minWidth: 0 },
  summary: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.one },
  footer: { flexDirection: arabicRowDirection, flexWrap: "wrap", gap: Spacing.two, padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  footerButton: { flexGrow: 1, flexBasis: 130, minWidth: 0 },
  monthGrid: { flexDirection: arabicRowDirection, flexWrap: "wrap", gap: Spacing.one },
  monthChoice: { flexBasis: "30%", flexGrow: 1, minHeight: 48, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.one, justifyContent: "center" },
});
