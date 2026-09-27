import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

export type NotificationType = "order" | "offer" | "promotion" | "system";

export type NotificationData = {
  orderId?: string;
  productId?: string;
  storeId?: string;
  offerId?: string;
  url?: string;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  createdAt: string;
  externalPushReady: boolean;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  addNotification: (
    notification: Omit<AppNotification, "id" | "createdAt" | "read">,
  ) => void;
};

const initialNotifications: AppNotification[] = [
  {
    id: "notification-1",
    type: "order",
    title: "تم تأكيد طلبك",
    body: "تم استلام طلبك وسيتم تجهيزه من المتجر.",
    data: {
      orderId: "ORD-1001",
    },
    read: false,
    createdAt: new Date().toISOString(),
    externalPushReady: true,
  },
  {
    id: "notification-2",
    type: "offer",
    title: "عرض جديد بانتظارك",
    body: "هناك عروض جديدة على منتجات مختارة من متاجر منطقتك.",
    data: {
      offerId: "OFFER-1001",
    },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    externalPushReady: true,
  },
  {
    id: "notification-3",
    type: "promotion",
    title: "عرض من أسواق الكرك",
    body: "اكتشف المنتجات والعروض الجديدة من أسواق الكرك.",
    data: {
      storeId: "store-1",
    },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    externalPushReady: true,
  },
];

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification,
      ),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback(
    (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      const newNotification: AppNotification = {
        ...notification,
        id: `notification-${Date.now()}`,
        createdAt: new Date().toISOString(),
        read: false,
      };

      setNotifications((current) => [newNotification, ...current]);
    },
    [],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearNotifications,
      addNotification,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearNotifications,
      addNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications must be used inside NotificationProvider",
    );
  }

  return context;
}
