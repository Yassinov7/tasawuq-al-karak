import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppModal } from "@/components/ui/AppModal";
import { FontSizes, Fonts, Radius, Spacing } from "@/constants/theme";
import { useCart } from "@/context/CartContext";
import {
  AppNotification,
  NotificationType,
  useNotifications,
} from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { itemCount } = useCart();

  const {
    notifications,
    unreadCount,
    syncError,
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

  const handleNotificationPress = async (notification: AppNotification) => {
    try {
      await markAsRead(notification.id);
    } catch (cause) {
      Alert.alert("تعذر تحديث الإشعار", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
      return;
    }

    const { orderId, productId, storeId, offerId, url } = notification.data ?? {};
    const route = url?.split("?")[0];
    if (route === "/merchant/orders") {
      router.push("/merchant/orders");
      return;
    }
    if (route === "/driver/orders") {
      Alert.alert("الوجهة غير متاحة", "لا تتضمن نسخة التطبيق الحالية شاشة طلبات السائق.");
      return;
    }
    if (orderId) {
      router.push({ pathname: "/order-details", params: { id: orderId } });
      return;
    }
    if (productId) {
      router.push({ pathname: "/product-details", params: { id: productId } });
      return;
    }
    if (storeId) {
      router.push({ pathname: "/store-details", params: { id: storeId } });
      return;
    }
    if (offerId) {
      router.push("/home/offers");
      return;
    }
    if (route === "/home/offers") {
      router.push("/home/offers");
      return;
    }
    Alert.alert("الإشعار غير مرتبط بصفحة", "لا يتضمن هذا الإشعار وجهة صالحة للفتح.");
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

  const handleModalConfirm = () => {
    if (modal === "delete" && selectedNotificationId) {
      void removeNotification(selectedNotificationId).catch((cause: unknown) => {
        Alert.alert("تعذر حذف الإشعار", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
      });
    }

    if (modal === "clear") {
      void clearNotifications().catch((cause: unknown) => {
        Alert.alert("تعذر حذف الإشعارات", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
      });
    }

    setModal(null);
    setSelectedNotificationId(null);
  };

  const handleModalCancel = () => {
    setModal(null);
    setSelectedNotificationId(null);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader title="الإشعارات" showBack cartCount={itemCount} mode="shared" />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          notifications.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {syncError ? (
              <View style={{ gap: Spacing.two, marginBottom: Spacing.three }}>
                <Text accessibilityRole="alert" style={{ color: colors.error, fontFamily: Fonts.regular, fontSize: FontSizes.sm, textAlign: "right" }}>
                  {syncError}
                </Text>
                <AppButton title="إعادة تحميل الإشعارات" variant="outline" onPress={() => void refresh().catch(() => undefined)} />
              </View>
            ) : null}
            {notifications.length > 0 ? (
            <View style={styles.headerActions}>
              <View>
                <Text
                  style={[
                    styles.countTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  الإشعارات
                </Text>

                <Text
                  style={[
                    styles.countText,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {unreadCount > 0
                    ? `${unreadCount} إشعارات غير مقروءة`
                    : "لا توجد إشعارات غير مقروءة"}
                </Text>
              </View>

              <View style={styles.headerButtons}>
                {unreadCount > 0 ? (
                  <Pressable
                    onPress={() => void markAllAsRead().catch((cause: unknown) => {
                      Alert.alert("تعذر تحديث الإشعارات", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
                    })}
                    style={({ pressed }) => [
                      styles.smallAction,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="تحديد الكل كمقروء"
                  >
                    <AppIcon
                      name="checkmark-done-outline"
                      size={17}
                      color={colors.primary}
                    />

                    <Text
                      style={[
                        styles.smallActionText,
                        {
                          color: colors.primary,
                        },
                      ]}
                    >
                      قراءة الكل
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={handleClearAll}
                  style={({ pressed }) => [
                    styles.smallAction,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="حذف جميع الإشعارات"
                >
                  <AppIcon
                    name="trash-outline"
                    size={17}
                    color={colors.error}
                  />

                  <Text
                    style={[
                      styles.smallActionText,
                      {
                        color: colors.error,
                      },
                    ]}
                  >
                    حذف الكل
                  </Text>
                </Pressable>
              </View>
            </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name="notifications-off-outline"
                size={38}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              لا توجد إشعارات
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              عندما يصلك تحديث عن طلباتك أو عروض جديدة، ستظهر هنا.
            </Text>
          </View>
        }
      />

      <AppModal
        visible={modal !== null}
        title={modal === "clear" ? "حذف جميع الإشعارات" : "حذف الإشعار"}
        message={
          modal === "clear"
            ? "هل تريد حذف جميع الإشعارات؟"
            : "هل تريد حذف هذا الإشعار؟"
        }
        icon="trash-outline"
        confirmText={modal === "clear" ? "حذف الكل" : "حذف"}
        cancelText="إلغاء"
        destructive
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </View>
  );
}

type NotificationCardProps = {
  notification: AppNotification;
  onPress: () => void;
  onDelete: () => void;
};

function NotificationCard({
  notification,
  onPress,
  onDelete,
}: NotificationCardProps) {
  const { colors } = useTheme();

  const icon = getNotificationIcon(notification.type);

  const color = getNotificationColor(notification.type, colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        !notification.read && {
          borderColor: colors.primaryLight,
          backgroundColor: colors.primaryLight,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
    >
      <View
        style={[
          styles.notificationIcon,
          {
            backgroundColor: color.background,
          },
        ]}
      >
        <AppIcon name={icon} size={22} color={color.foreground} />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationTop}>
          <Text
            style={[
              styles.notificationTitle,
              {
                color: colors.text,
              },
              !notification.read && styles.unreadTitle,
            ]}
            numberOfLines={2}
          >
            {notification.title}
          </Text>

          {!notification.read ? (
            <View
              style={[
                styles.unreadDot,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            />
          ) : null}
        </View>

        <Text
          style={[
            styles.notificationBody,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {notification.body}
        </Text>

        <View style={styles.notificationFooter}>
          <Text
            style={[
              styles.notificationTime,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {formatNotificationDate(notification.createdAt)}
          </Text>

          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="حذف الإشعار"
          >
            <AppIcon name="trash-outline" size={17} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function getNotificationIcon(
  type: NotificationType,
): React.ComponentProps<typeof AppIcon>["name"] {
  switch (type) {
    case "order":
      return "receipt-outline";

    case "offer":
      return "pricetag-outline";

    case "promotion":
      return "megaphone-outline";

    case "system":
      return "information-circle-outline";
  }
}

function getNotificationColor(
  type: NotificationType,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  switch (type) {
    case "order":
      return {
        background: colors.primaryLight,
        foreground: colors.primary,
      };

    case "offer":
      return {
        background: colors.accentLight,
        foreground: colors.accent,
      };

    case "promotion":
      return {
        background: colors.primaryLight,
        foreground: colors.primary,
      };

    case "system":
      return {
        background: colors.surfaceSecondary,
        foreground: colors.textSecondary,
      };
  }
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  const now = Date.now();
  const difference = Math.max(0, now - date.getTime());

  const minutes = Math.floor(difference / (1000 * 60));

  if (minutes < 1) {
    return "الآن";
  }

  if (minutes < 60) {
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return "أمس";
  }

  if (days < 7) {
    return `منذ ${days} أيام`;
  }

  return date.toLocaleDateString("ar-SY");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.ten,
  },

  emptyList: {
    flexGrow: 1,
  },

  headerActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },

  countTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    textAlign: "right",
  },

  countText: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  headerButtons: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.one,
  },

  smallAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
  },

  smallActionText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
  },

  notificationCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },

  notificationIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  notificationTitle: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.md,
    lineHeight: 23,
    textAlign: "right",
  },

  unreadTitle: {
    fontFamily: Fonts.bold,
  },

  unreadDot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: Radius.full,
  },

  notificationBody: {
    marginTop: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 22,
    textAlign: "right",
  },

  notificationFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
  },

  notificationTime: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
  },

  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.six,
  },

  emptyIcon: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  emptyTitle: {
    marginTop: Spacing.five,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
  },

  emptyText: {
    maxWidth: 320,
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.72,
  },
});
