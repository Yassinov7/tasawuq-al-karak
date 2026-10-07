import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/navigation/AppHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { Fonts, FontSizes, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Currency = "SYP" | "USD";

type Wallet = {
  currency: Currency;
  balance: number;
};

type Transaction = {
  id: string;
  transaction_type: string;
  direction: "credit" | "debit";
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
  currency: Currency;
};

const transactionLabels: Record<string, string> = {
  subscription_initialization: "رصيد افتتاحي",
  funding: "تمويل المحفظة",
  settlement: "حركة تسوية مالية",
  adjustment: "تعديل رصيد",
};

function getTransactionLabel(type: string) {
  return transactionLabels[type] ?? "عملية مالية";
}

function getCurrencyLabel(currency: Currency) {
  return currency === "USD" ? "دولار" : "ل.س";
}

function formatAmount(value: number) {
  return Number(value).toLocaleString("ar-SY", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ar-SY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WalletScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadWallet = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [walletResult, transactionResult] = await Promise.all([
          supabase
            .from("wallets")
            .select("currency,balance")
            .eq("user_id", user.id)
            .order("currency"),

          supabase
            .from("wallet_transactions")
            .select(
              "id,transaction_type,direction,amount,balance_after,note,created_at,currency",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (walletResult.error) {
          throw walletResult.error;
        }

        if (transactionResult.error) {
          throw transactionResult.error;
        }

        setWallets((walletResult.data ?? []) as Wallet[]);
        setTransactions((transactionResult.data ?? []) as Transaction[]);
      } catch {
        setError("تعذر تحميل البيانات المالية. حاول مرة أخرى.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadWallet(), 0);
    return () => clearTimeout(timer);
  }, [loadWallet]);

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text
          style={[
            styles.loadingText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          جارٍ تحميل البيانات المالية...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <AppHeader
        title="المحفظة والعمليات المالية"
        // cartCount={itemCount}
        mode="shared"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWallet("refresh")}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.intro}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            المحفظة
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            الرصيد الحالي وسجل جميع الحركات المالية المرتبطة بحسابك.
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.messageCard,
              {
                backgroundColor: colors.error,
                borderColor: colors.error,
              },
            ]}
          >
            <AppIcon
              name="alert-circle-outline"
              size={19}
              color={colors.surface}
            />

            <Text
              style={[
                styles.messageText,
                {
                  color: colors.surface,
                },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            الأرصدة الحالية
          </Text>

          {wallets.length ? (
            <View style={styles.walletList}>
              {wallets.map((wallet) => (
                <View
                  key={wallet.currency}
                  style={[
                    styles.balanceCard,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <View style={styles.balanceHeader}>
                    <View
                      style={[
                        styles.balanceIcon,
                        {
                          backgroundColor: colors.primaryDark,
                        },
                      ]}
                    >
                      <AppIcon
                        name="wallet-outline"
                        size={21}
                        color={colors.surface}
                      />
                    </View>

                    <Text style={styles.balanceLabel}>
                      {getCurrencyLabel(wallet.currency)}
                    </Text>
                  </View>

                  <Text style={styles.balance}>
                    {formatAmount(Number(wallet.balance))}
                  </Text>

                  <Text style={styles.balanceHint}>الرصيد المتاح حاليًا</Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="wallet-outline"
                size={25}
                color={colors.textMuted}
              />

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                لا توجد محفظة مفعلة
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                لا توجد محفظة مالية مرتبطة بهذا الحساب حاليًا.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              سجل العمليات
            </Text>

            <Text
              style={[
                styles.countText,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              {transactions.length} عملية
            </Text>
          </View>

          {!transactions.length ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppIcon
                name="receipt-outline"
                size={25}
                color={colors.textMuted}
              />

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                لا توجد عمليات مالية
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                ستظهر هنا الحركات المالية المسجلة على الحساب.
              </Text>
            </View>
          ) : (
            <View style={styles.transactionList}>
              {transactions.map((transaction) => {
                const isCredit = transaction.direction === "credit";

                return (
                  <View
                    key={transaction.id}
                    style={[
                      styles.transactionCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.transactionTop}>
                      <View
                        style={[
                          styles.directionIcon,
                          {
                            backgroundColor: isCredit
                              ? colors.primaryLight
                              : colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <AppIcon
                          name={
                            isCredit ? "arrow-down-outline" : "arrow-up-outline"
                          }
                          size={18}
                          color={isCredit ? colors.success : colors.error}
                        />
                      </View>

                      <View style={styles.transactionTitleContent}>
                        <Text
                          style={[
                            styles.transactionTitle,
                            {
                              color: colors.text,
                            },
                          ]}
                        >
                          {getTransactionLabel(transaction.transaction_type)}
                        </Text>

                        <Text
                          style={[
                            styles.transactionDate,
                            {
                              color: colors.textMuted,
                            },
                          ]}
                        >
                          {formatDate(transaction.created_at)}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.transactionAmount,
                          {
                            color: isCredit ? colors.success : colors.error,
                          },
                        ]}
                      >
                        {isCredit ? "+" : "−"}
                        {formatAmount(Number(transaction.amount))}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.transactionDivider,
                        {
                          backgroundColor: colors.border,
                        },
                      ]}
                    />

                    <View style={styles.transactionDetails}>
                      <Text
                        style={[
                          styles.currencyText,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {getCurrencyLabel(transaction.currency)}
                      </Text>

                      <Text
                        style={[
                          styles.balanceAfter,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        الرصيد بعد العملية:{" "}
                        {formatAmount(Number(transaction.balance_after))}{" "}
                        {getCurrencyLabel(transaction.currency)}
                      </Text>
                    </View>

                    {transaction.note ? (
                      <Text
                        style={[
                          styles.note,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {transaction.note}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <AppButton
          title="تحديث البيانات"
          icon="refresh-outline"
          variant="outline"
          loading={refreshing}
          onPress={() => void loadWallet("refresh")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
  },

  loadingText: {
    marginTop: Spacing.three,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  container: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.ten,
    gap: Spacing.five,
  },

  intro: {
    gap: Spacing.two,
  },

  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    textAlign: "right",
  },

  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    lineHeight: 23,
    textAlign: "right",
  },

  section: {
    gap: Spacing.three,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    textAlign: "right",
  },

  countText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  walletList: {
    gap: Spacing.three,
  },

  balanceCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.five,
  },

  balanceHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  balanceIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  balanceLabel: {
    flex: 1,
    color: "white",
    fontFamily: Fonts.medium,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  balance: {
    marginTop: Spacing.three,
    color: "white",
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xxl,
    textAlign: "right",
  },

  balanceHint: {
    marginTop: Spacing.one,
    color: "white",
    opacity: 0.8,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  transactionList: {
    gap: Spacing.two,
  },

  transactionCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },

  transactionTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  directionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  transactionTitleContent: {
    flex: 1,
    alignItems: "flex-end",
  },

  transactionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  transactionDate: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  transactionAmount: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: "right",
  },

  transactionDivider: {
    height: 1,
    marginVertical: Spacing.three,
  },

  transactionDetails: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },

  currencyText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  balanceAfter: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    textAlign: "right",
  },

  note: {
    marginTop: Spacing.two,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },

  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.five,
    alignItems: "center",
    gap: Spacing.two,
  },

  emptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "center",
  },

  messageCard: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.two,
  },

  messageText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.xs,
    lineHeight: 20,
    textAlign: "right",
  },
});
