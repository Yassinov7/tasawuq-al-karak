import { LiveStatus } from "@/components/ui/LiveStatus";
import { useReadScope } from "@/hooks/useReadScope";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppDialog } from "@/context/AppDialogContext";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { AppEmptyState } from "@/components/ui/AppEmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingState";
import { DeviceNotificationStatus } from "@/components/notifications/DeviceNotificationStatus";
import { ControlSizes, Fonts, MaxContentWidth, Radius, RtlText, Spacing, Typography } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
  AppNotification,
  useNotifications,
} from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";
import { openOwnedNotification } from "@/lib/notification-opening";
import { supabase } from "@/lib/supabase";

export default function NotificationsScreen(){const {user}=useAuth();return <NotificationsOwner key={user?.id??"guest"}/>;}
function NotificationsOwner() {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { colors } = useTheme();
  const { itemCount } = useCart();
  const { user,loading:authLoading } = useAuth();

  const {
    notifications,
    unreadCount,
    syncError,
    liveStatus,
    initialLoading,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  } = useNotifications();

  const [modal, setModal] = useState<"delete" | "clear" | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<
    string | null
  >(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const markLock = useRef(false);
  const refreshLock = useRef(false);
  const [returning, setReturning] = useState(false);
  const openingNotificationIdRef = useRef<string | null>(null);
  const reads=useReadScope(user?.id??"guest");

  const handleBack = async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (returning) return;
    const token=reads.begin();

    setReturning(true);
    try {
      const { data: profile, error } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null, error: null };
      if (error) throw error;
      if(!reads.current(token))return;

      switch (profile?.role) {
        case "merchant":
          router.replace("/merchant/account");
          return;
        case "driver":
          router.replace("/driver/account");
          return;
        case "admin":
          router.replace("/admin");
          return;
        case "customer":
          router.replace("/home/account");
          return;
        default:
          router.replace("/");
      }
    } catch {
      if(reads.current(token))router.replace("/");
    } finally {
      if(reads.current(token))setReturning(false);
    }
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    if (openingNotificationIdRef.current) return;
    if (!user) {
      void alert("انتهت جلسة الدخول", "سجّل الدخول لفتح الإشعار.");
      return;
    }

    openingNotificationIdRef.current = notification.id;
    const token=reads.begin();
    try {
      const href=await openOwnedNotification(user.id,notification.id,()=>reads.current(token));
      if(!reads.current(token))return;
      router.push(href);void refresh().catch(()=>undefined);
    } catch (cause) {
      if(reads.current(token))void alert("تعذر فتح الإشعار", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally {
      setTimeout(() => {
        if (openingNotificationIdRef.current === notification.id) {
          openingNotificationIdRef.current = null;
        }
      }, 400);
    }
  };

  const handleDelete = (notification: AppNotification) => {
    setSelectedNotificationId(notification.id);
    setModal("delete");
  };

  const handleClearAll = () => {
    if (notifications.length === 0) {
      return;
    }

    setModal("clear");
  };

  const handleModalConfirm = async () => {
    if (modalBusy) return;
    setModalBusy(true);
    try {
      if (modal === "delete" && selectedNotificationId) {
        await removeNotification(selectedNotificationId);
      }
      if (modal === "clear") {
        await clearNotifications();
      }
      setModal(null);
      setSelectedNotificationId(null);
    } catch (cause) {
      setModal(null);
      void alert("تعذر حذف الإشعار", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally {
      setModalBusy(false);
    }
  };

  const handleModalCancel = () => {
    if (modalBusy) return;
    setModal(null);
    setSelectedNotificationId(null);
  };

  const handleMarkAsRead = async (id?: string) => {
    if (markLock.current) return;
    markLock.current = true;
    if (id) setMarkingId(id);
    else setMarkingAll(true);
    try {
      if (id) await markAsRead(id);
      else await markAllAsRead();
    } catch {
      void alert("تعذر تعليم الإشعارات كمقروءة", "تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      markLock.current = false;
      setMarkingId(null);
      setMarkingAll(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // The provider preserves the last list and exposes its error.
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };

  if(authLoading)return <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator color={colors.primary}/></View>;
  if(!user)return <View style={[styles.container,{backgroundColor:colors.background,padding:Spacing.five,gap:Spacing.four}]}><Text style={{fontFamily:Fonts.regular,color:colors.text,textAlign:"right"}}>سجّل الدخول لعرض إشعارات حسابك.</Text><AppButton title="تسجيل الدخول" onPress={()=>router.replace("/login")}/></View>;
  const marking = markingAll || markingId !== null;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="الإشعارات" showBack onBack={() => void handleBack()} showNotifications={false}
        cartCount={itemCount} mode="shared" />
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void handleRefresh()}
        ListHeaderComponent={
          <View style={styles.header}>
            <DeviceNotificationStatus />
            <LiveStatus compact hideTimestamp state={liveStatus} />
            {syncError ? (
              <View style={[styles.error, { backgroundColor: colors.errorSurface }]}>
                <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{syncError}</Text>
                <AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline"
                  loading={refreshing} onPress={() => void handleRefresh()} />
              </View>
            ) : null}
            {notifications.length || unreadCount ? (
              <View style={styles.toolbar}>
                <Text style={[styles.count, { color: colors.text }]}>غير المقروءة · {unreadCount.toLocaleString("ar-SY")}</Text>
                <View style={styles.actions}>
                  {unreadCount > 0 ? <NotificationAction label="قراءة الكل" icon="checkmark-done-outline"
                    busy={markingAll} disabled={marking} onPress={() => void handleMarkAsRead()} /> : null}
                  {notifications.length > 0 ? <NotificationAction label="حذف الكل" icon="trash-outline"
                    danger onPress={handleClearAll} /> : null}
                </View>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <NotificationCard notification={item} onPress={() => void handleNotificationPress(item)}
            onMark={() => void handleMarkAsRead(item.id)} onDelete={() => handleDelete(item)}
            marking={marking} markingThis={markingId === item.id} />
        )}
        ListEmptyComponent={initialLoading
          ? <LoadingSkeleton cards={2} label="جارٍ قراءة الإشعارات" />
          : syncError ? null
            : <AppEmptyState icon="notifications-off-outline" title="لا توجد إشعارات" description="ستظهر هنا تحديثات حسابك عند وصولها." />}
      />
      <AppModal
        visible={modal !== null}
        title={modal === "clear" ? "حذف جميع الإشعارات" : "حذف الإشعار"}
        message={modal === "clear" ? "هل تريد حذف جميع الإشعارات؟" : "هل تريد حذف هذا الإشعار؟"}
        icon="trash-outline"
        confirmText={modal === "clear" ? "حذف الكل" : "حذف"}
        cancelText="إلغاء" destructive busy={modalBusy}
        onConfirm={() => void handleModalConfirm()} onCancel={handleModalCancel}
      />
    </View>
  );
}

type Icon = React.ComponentProps<typeof AppIcon>["name"];

function NotificationAction({ label, icon, onPress, danger = false, busy = false, disabled = false }: {
  label: string; icon: Icon; onPress: () => void; danger?: boolean; busy?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const color = disabled && !busy ? colors.disabledForeground : danger ? colors.errorForeground : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || busy, busy }} onPress={onPress} disabled={disabled || busy}
    style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfacePressed }]}>
    {busy ? <ActivityIndicator size="small" color={color} /> : <AppIcon name={icon} size={17} color={color} />}
    <Text style={[styles.caption, { color }]}>{label}</Text>
  </Pressable>;
}

function NotificationCard({ notification, onPress, onMark, onDelete, marking, markingThis }: {
  notification: AppNotification; onPress: () => void; onMark: () => void; onDelete: () => void; marking: boolean; markingThis: boolean;
}) {
  const { colors } = useTheme();
  const event = notification.data?.event ?? "";
  const icon = getNotificationIcon(notification, event);
  const isOffer = notification.type === "offer" || notification.type === "promotion";
  const isException = /cancelled|rejected|exception|removed/.test(event);
  const iconColor = isException ? colors.warningForeground : isOffer ? colors.warningForeground : colors.infoForeground;
  const iconSurface = isException || isOffer ? colors.warningSurface : colors.infoSurface;
  const time = formatNotificationDate(notification.createdAt);

  return <View style={[styles.card, {
    backgroundColor: notification.read ? colors.surface : colors.surfaceSelected,
    borderColor: colors.borderSubtle,
  }]}>
    <Pressable accessibilityRole="button" accessibilityHint="يفتح الوجهة المرتبطة بالإشعار"
      onPress={onPress} style={({ pressed }) => [styles.cardMain, pressed && { backgroundColor: colors.surfacePressed }]}>
      <View style={[styles.icon, { backgroundColor: iconSurface }]} importantForAccessibility="no-hide-descendants">
        <AppIcon name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.title, { color: colors.text }]}>{notification.title}</Text>
        {notification.body ? <Text style={[styles.body, { color: colors.textSecondary }]}>{notification.body}</Text> : null}
        <View style={styles.meta}>
          {!notification.read ? <Text style={[styles.caption, { color: colors.primary }]}>غير مقروء</Text> : null}
          {time ? <Text style={[styles.caption, { color: colors.textMuted }]}>{time}</Text> : null}
        </View>
      </View>
    </Pressable>
    <View style={[styles.cardActions, { borderColor: colors.borderSubtle }]}>
      {!notification.read ? <NotificationAction label="تعليم كمقروء" icon="checkmark-outline"
        busy={markingThis} disabled={marking} onPress={onMark} /> : null}
      <NotificationAction label="حذف" icon="trash-outline" onPress={onDelete} danger />
    </View>
  </View>;
}

function getNotificationIcon(notification: AppNotification, event: string): Icon {
  if (notification.type === "offer") return "pricetag-outline";
  if (notification.type === "promotion") return "megaphone-outline";
  if (/cancelled|rejected|exception|removed/.test(event)) return "alert-circle-outline";
  if (notification.data?.invoiceId) return "document-text-outline";
  if (event.includes("review") || event.startsWith("application-")) return "clipboard-outline";
  if (event.startsWith("task-") || event.startsWith("driver-") || event === "merchant-pickup" || notification.data?.deliveryTaskId) return "bicycle-outline";
  return notification.type === "order" ? "receipt-outline" : "information-circle-outline";
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ar-SY", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    width: "100%", maxWidth: MaxContentWidth, alignSelf: "center",
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.ten,
  },
  header: { gap: Spacing.one, paddingBottom: Spacing.two },
  error: { borderRadius: Radius.md, padding: Spacing.two, gap: Spacing.one, alignItems: "flex-end" },
  toolbar: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: Spacing.two },
  count: { ...Typography.bodyStrong, ...RtlText, flexShrink: 1 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", maxWidth: "100%" },
  action: { minWidth: ControlSizes.touch, minHeight: ControlSizes.touch, maxWidth: "100%", paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one, flexDirection: "row-reverse", alignItems: "center", gap: Spacing.one, borderRadius: Radius.md },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, marginBottom: Spacing.two, overflow: "hidden" },
  cardMain: { flexDirection: "row-reverse", alignItems: "flex-start", gap: Spacing.two, padding: Spacing.three, minHeight: ControlSizes.touch },
  icon: { width: 34, height: 34, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1, minWidth: 0, gap: Spacing.one },
  title: { ...Typography.bodyStrong, ...RtlText },
  body: { ...Typography.body, ...RtlText },
  meta: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  caption: { ...Typography.caption, ...RtlText, flexShrink: 1 },
  cardActions: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
});
