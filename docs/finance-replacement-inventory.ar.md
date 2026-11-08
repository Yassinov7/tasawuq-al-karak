# جرد استبدال الماليات — ملحق مصدر آلي

تاريخ الجرد: 9 نوفمبر 2026. لا اتصال بقاعدة البيانات ولا حذف منفذ.

هذا فهرس مصدر، وليس نتيجة pg_depend أو سجلًا لما هو منشور. التصنيف يحكم التنفيذ القديم داخل الملف، وليس إذنًا بحذف الملف كاملًا. تفاصيل الاستيرادات والتبعيات المباشرة وتصريحات SQL في JSON المرافق.

## استبدال التنفيذ المالي القديم

- `src/app/admin/commission-details.tsx`
- `src/app/admin/commissions.tsx`
- `src/app/admin/create-merchant-settlement.tsx`
- `src/app/admin/credit-details.tsx`
- `src/app/admin/credit.tsx`
- `src/app/admin/driver-custody-details.tsx`
- `src/app/admin/driver-custody-report.tsx`
- `src/app/admin/driver-custody.tsx`
- `src/app/admin/finance-reconciliation.tsx`
- `src/app/admin/finance-transition.tsx`
- `src/app/admin/finance.tsx`
- `src/app/admin/financial-indicators.tsx`
- `src/app/admin/financial-reports.tsx`
- `src/app/admin/invoice-details.tsx`
- `src/app/admin/invoices.tsx`
- `src/app/admin/ledger-details.tsx`
- `src/app/admin/ledger.tsx`
- `src/app/admin/merchant-finance.tsx`
- `src/app/admin/merchant-settlement-details.tsx`
- `src/app/admin/merchant-settlements.tsx`
- `src/app/admin/payment-details.tsx`
- `src/app/admin/payments.tsx`
- `src/app/admin/subscription-details.tsx`
- `src/app/admin/subscriptions.tsx`
- `src/app/admin/treasury.tsx`
- `src/app/invoice.tsx`
- `src/app/merchant/finance.tsx`
- `src/app/merchant/financial-ledger-details.tsx`
- `src/app/merchant/financial-ledger.tsx`
- `src/app/merchant/financial-sale-details.tsx`
- `src/app/merchant/financial-sales.tsx`
- `src/app/merchant/sales-commissions.tsx`
- `src/app/merchant/settlement-details.tsx`
- `src/app/merchant/settlements.tsx`
- `src/app/merchant/subscription-invoice-details.tsx`
- `src/app/merchant/subscription-invoices.tsx`
- `src/app/merchant/subscription-payment-details.tsx`
- `src/app/merchant/subscription-payments.tsx`
- `src/app/merchant/subscription.tsx`
- `src/app/wallet.tsx`
- `src/components/admin/DriverWageAdministration.tsx`
- `src/components/admin/FinanceTransitionReview.tsx`
- `src/components/admin/FinancialReconciliation.tsx`
- `src/components/admin/FinancialReportScreen.tsx`
- `src/components/admin/MerchantSettlementAdministration.tsx`
- `src/components/admin/SubscriptionAdministration.tsx`
- `src/components/admin/TreasuryControl.tsx`
- `src/components/admin/TreasuryFinanceWorkflow.tsx`
- `src/components/driver/DriverCustodyPanel.tsx`
- `src/components/driver/DriverWagePanel.tsx`
- `src/components/driver/WageOperationControls.tsx`
- `src/components/merchant/FinancialDatePicker.tsx`
- `src/components/merchant/MerchantFinancialCards.tsx`
- `src/components/merchant/MerchantFinancialScreen.tsx`
- `src/components/merchant/MerchantSettlementPanel.tsx`
- `src/components/merchant/SubscriptionAccountPanel.tsx`
- `src/components/ui/FinancialAmount.tsx`
- `src/components/ui/FinancialOperationControls.tsx`
- `src/components/ui/FinancialStatus.tsx`
- `src/hooks/useCustodyRead.ts`
- `src/hooks/useFinancialOperation.ts`
- `src/hooks/useWageOperation.ts`
- `src/lib/admin-finance.ts`
- `src/lib/admin-financial-reports.ts`
- `src/lib/admin-subscription-plans.ts`
- `src/lib/driver-custody-c5.ts`
- `src/lib/driver-wages-c6.ts`
- `src/lib/finance-c2-contract.ts`
- `src/lib/finance-integration-contract.ts`
- `src/lib/finance-transition.ts`
- `src/lib/financial-decimal.ts`
- `src/lib/financial-input.ts`
- `src/lib/financial-operation.ts`
- `src/lib/financial-reader.ts`
- `src/lib/financial-reconciliation.ts`
- `src/lib/financial-transport.ts`
- `src/lib/merchant-financial-account.ts`
- `src/lib/merchant-financial-details.ts`
- `src/lib/merchant-financial-dto.ts`
- `src/lib/merchant-settlements-c7.ts`
- `src/lib/merchant-settlements.ts`
- `src/lib/settlement-attempt.ts`
- `src/lib/subscription-accounts.ts`
- `src/lib/treasury-control.ts`
- `src/lib/treasury-finance.ts`

## مختلط: استخراج التشغيل واستبدال الماليات

- `src/lib/c3-order-contract.ts`
- `src/lib/c3-orders.ts`
- `src/lib/delivery-collection-attempt.ts`
- `src/lib/driver-cash.ts`
- `src/lib/driver-collection.ts`
- `src/lib/driver-deliveries.ts`
- `src/lib/legacy-delivery-collection.ts`
- `src/lib/store-pickups.ts`

## حفظ الوظيفة العامة ومراجعة العقد

- `src/components/ui/DocumentReference.tsx`
- `src/components/ui/OperationFeedback.tsx`
- `src/lib/money.ts`

## حفظ مع إصلاح نقاط التكامل

- `src/app/addresses.tsx`
- `src/app/admin/application-details.tsx`
- `src/app/admin/cash-movement-report.tsx`
- `src/app/admin/delivery-fees-report.tsx`
- `src/app/admin/index.tsx`
- `src/app/admin/merchant-payouts-report.tsx`
- `src/app/admin/more.tsx`
- `src/app/admin/order-details.tsx`
- `src/app/admin/orders.tsx`
- `src/app/admin/plan-form.tsx`
- `src/app/admin/plans.tsx`
- `src/app/admin/platform-revenue-report.tsx`
- `src/app/admin/requests.tsx`
- `src/app/application-status.tsx`
- `src/app/cart.tsx`
- `src/app/checkout.tsx`
- `src/app/driver/account.tsx`
- `src/app/driver/cash-account.tsx`
- `src/app/driver/index.tsx`
- `src/app/driver/orders.tsx`
- `src/app/driver-application.tsx`
- `src/app/favorites.tsx`
- `src/app/home/account.tsx`
- `src/app/home/index.tsx`
- `src/app/home/offers.tsx`
- `src/app/home/search.tsx`
- `src/app/merchant/account.tsx`
- `src/app/merchant/catalog.tsx`
- `src/app/merchant/offer-editor.tsx`
- `src/app/merchant/offers.tsx`
- `src/app/merchant/orders.tsx`
- `src/app/merchant/personal-info.tsx`
- `src/app/merchant/product-editor.tsx`
- `src/app/merchant/products.tsx`
- `src/app/merchant/security.tsx`
- `src/app/merchant/settings.tsx`
- `src/app/merchant/store-info.tsx`
- `src/app/merchant-application-review.tsx`
- `src/app/merchant-application.tsx`
- `src/app/notifications.tsx`
- `src/app/offer-details.tsx`
- `src/app/order-details.tsx`
- `src/app/orders.tsx`
- `src/app/personal-info.tsx`
- `src/app/product-details.tsx`
- `src/app/security.tsx`
- `src/app/settings.tsx`
- `src/app/store-details.tsx`
- `src/app/stores.tsx`
- `src/app/_layout.tsx`
- `src/components/account/DriverProfessionalInfo.tsx`
- `src/components/account/PersonalInfoScreen.tsx`
- `src/components/account/SecurityScreen.tsx`
- `src/components/account/SettingsScreen.tsx`
- `src/components/account/SharedAccountParts.tsx`
- `src/components/admin/C3DeliverySettings.tsx`
- `src/components/admin/CashHandoverQueue.tsx`
- `src/components/application-status/model.ts`
- `src/components/driver/DeliveryTaskCard.tsx`
- `src/components/driver/StorePickupPanel.tsx`
- `src/components/marketplace/CustomerCatalogStatus.tsx`
- `src/components/marketplace/OfferCard.tsx`
- `src/components/marketplace/ProductCard.tsx`
- `src/components/marketplace/StoreCard.tsx`
- `src/components/marketplace/StoreDetailsHero.tsx`
- `src/components/merchant/MerchantAccountScreens.tsx`
- `src/components/merchant/MerchantAddProduct.tsx`
- `src/components/merchant/MerchantCatalogPanel.tsx`
- `src/components/merchant/MerchantEditProduct.tsx`
- `src/components/merchant/MerchantOfferEditor.tsx`
- `src/components/merchant/MerchantOfferForm.tsx`
- `src/components/merchant/MerchantStoreBranding.tsx`
- `src/components/orders/OrderTracking.tsx`
- `src/components/search/SearchResults.tsx`
- `src/context/CartContext.tsx`
- `src/context/CustomerCatalogContext.tsx`
- `src/hooks/useOnboardingDraft.ts`
- `src/hooks/usePersonalAccount.ts`
- `src/lib/admin-orders.ts`
- `src/lib/customer-offers.ts`
- `src/lib/customer-orders.ts`
- `src/lib/local-cache.ts`
- `src/lib/merchant-account.ts`
- `src/lib/merchant-catalog-api.ts`
- `src/lib/merchant-catalog.ts`
- `src/lib/merchant-offer-editor-api.ts`
- `src/lib/merchant-offer-editor.ts`
- `src/lib/merchant-orders.ts`
- `src/lib/offer-presentation.ts`
- `src/lib/order-item-groups.ts`
- `src/lib/personal-account.ts`
- `src/lib/public-catalog.ts`

## حفظ واختبار عدم التأثر

- `src/app/about.tsx`
- `src/app/admin/applications.tsx`
- `src/app/admin/driver-details.tsx`
- `src/app/admin/drivers.tsx`
- `src/app/admin/store-details.tsx`
- `src/app/admin/stores.tsx`
- `src/app/admin/_layout.tsx`
- `src/app/driver/_layout.tsx`
- `src/app/home/_layout.tsx`
- `src/app/index.tsx`
- `src/app/login.tsx`
- `src/app/merchant/index.tsx`
- `src/app/merchant/_layout.tsx`
- `src/app/privacy.tsx`
- `src/app/reset-password.tsx`
- `src/app/signup.tsx`
- `src/app/terms.tsx`
- `src/app/verify-email.tsx`
- `src/components/about/AboutContent.tsx`
- `src/components/about/AboutFeatureList.tsx`
- `src/components/about/AboutHeader.tsx`
- `src/components/account/AccountMenuItem.tsx`
- `src/components/account/AccountProfileHeader.tsx`
- `src/components/account/AccountSection.tsx`
- `src/components/account/AccountShell.tsx`
- `src/components/application-status/ApplicationStatusEmptyState.tsx`
- `src/components/application-status/styles.ts`
- `src/components/auth/DraftExitModal.tsx`
- `src/components/auth/OnboardingFrame.tsx`
- `src/components/auth/RoleRouteGuard.tsx`
- `src/components/brand/BrandMark.tsx`
- `src/components/home/CustomerHomeHero.tsx`
- `src/components/home/CustomerHomePromo.tsx`
- `src/components/legal/LegalPageLayout.tsx`
- `src/components/legal/LegalRelatedDocument.tsx`
- `src/components/legal/LegalSection.tsx`
- `src/components/login/ForgotPasswordSection.tsx`
- `src/components/login/LoginFooter.tsx`
- `src/components/login/LoginForm.tsx`
- `src/components/login/LoginHeader.tsx`
- `src/components/marketplace/CategoryChip.tsx`
- `src/components/marketplace/ProductMediaGallery.tsx`
- `src/components/marketplace/ProductMediaPreview.tsx`
- `src/components/marketplace/RatingsSection.tsx`
- `src/components/marketplace/RatingStars.tsx`
- `src/components/marketplace/ReviewCard.tsx`
- `src/components/marketplace/ReviewForm.tsx`
- `src/components/merchant/MerchantCategorySelect.tsx`
- `src/components/merchant/MerchantProductForm.tsx`
- `src/components/merchant/OfferExpirationPicker.tsx`
- `src/components/merchant/SellingUnitSelect.tsx`
- `src/components/navigation/AppBottomNav.tsx`
- `src/components/navigation/AppHeader.tsx`
- `src/components/search/ProductRefinements.tsx`
- `src/components/search/SearchControls.tsx`
- `src/components/search/SearchEmptyState.tsx`
- `src/components/search/searchStyles.ts`
- `src/components/signup/SignupCredentialsStep.tsx`
- `src/components/signup/SignupErrorNotice.tsx`
- `src/components/signup/SignupIntroStep.tsx`
- `src/components/signup/SignupProgress.tsx`
- `src/components/signup/SignupRoleStep.tsx`
- `src/components/ui/AppBadge.tsx`
- `src/components/ui/AppButton.tsx`
- `src/components/ui/AppEmptyState.tsx`
- `src/components/ui/AppIcon.tsx`
- `src/components/ui/AppModal.tsx`
- `src/components/ui/AppSearchBar.tsx`
- `src/components/ui/AppSectionHeader.tsx`
- `src/components/ui/AppTextField.tsx`
- `src/components/ui/SyriaFlag.tsx`
- `src/constants/catalog.ts`
- `src/constants/fonts.ts`
- `src/constants/selling-units.ts`
- `src/constants/theme.ts`
- `src/context/AuthContext.tsx`
- `src/context/FavoritesContext.tsx`
- `src/context/MerchantWorkspaceContext.tsx`
- `src/context/NotificationContext.tsx`
- `src/context/SettingsContext.tsx`
- `src/context/ThemeContext.tsx`
- `src/hooks/useAccountDraftGuard.tsx`
- `src/hooks/useLogin.ts`
- `src/hooks/useMerchantLoad.ts`
- `src/hooks/useOnboardingExit.ts`
- `src/hooks/useOrderRealtime.ts`
- `src/hooks/useSignup.ts`
- `src/lib/account-routing.ts`
- `src/lib/admin-applications.ts`
- `src/lib/admin-drivers.ts`
- `src/lib/admin-stores.ts`
- `src/lib/catalog-quantity.ts`
- `src/lib/customer-reviews.ts`
- `src/lib/customer-search.ts`
- `src/lib/merchant-application-draft.ts`
- `src/lib/merchant-home.ts`
- `src/lib/merchant-navigation.ts`
- `src/lib/merchant-product-create-api.ts`
- `src/lib/merchant-product-create.ts`
- `src/lib/merchant-product-edit-api.ts`
- `src/lib/merchant-product-edit.ts`
- `src/lib/merchant-store.ts`
- `src/lib/notification-routing.ts`
- `src/lib/offer-expiration.ts`
- `src/lib/password-recovery.ts`
- `src/lib/personal-account-model.ts`
- `src/lib/purchase-availability.ts`
- `src/lib/store-branding-contract.ts`
- `src/lib/store-branding-flow.ts`
- `src/lib/store-branding-view.ts`
- `src/lib/store-branding.ts`
- `src/lib/supabase.ts`
- `src/types/database.ts`
- `src/types/profile-demographics.ts`

## جداول المصدر بحسب القرار

### 20260930000100_accounts_roles_applications_wallets.sql

- `public.profiles`: KEEP_OPERATIONAL
- `public.subscription_plans`: REPLACE_WITH_SIMPLE_TERMS
- `public.merchant_applications`: KEEP_OPERATIONAL
- `public.driver_applications`: KEEP_OPERATIONAL
- `public.merchants`: KEEP_OPERATIONAL
- `public.stores`: KEEP_OPERATIONAL
- `public.merchant_subscriptions`: REPLACE_WITH_SIMPLE_TERMS
- `public.wallets`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.wallet_transactions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.audit_logs`: KEEP_OPERATIONAL

### 20260930000200_store_catalog_offers.sql

- `public.product_categories`: KEEP_OPERATIONAL
- `public.products`: KEEP_OPERATIONAL
- `public.product_media`: KEEP_OPERATIONAL
- `public.store_offers`: KEEP_OPERATIONAL
- `public.store_offer_products`: KEEP_OPERATIONAL
- `public.store_offer_media`: KEEP_OPERATIONAL

### 20260930000400_store_categories_notifications.sql

- `public.store_categories`: KEEP_OPERATIONAL
- `public.notifications`: KEEP_OPERATIONAL

### 20261001000200_customer_orders_cart_delivery.sql

- `public.delivery_zones`: KEEP_OPERATIONAL
- `public.customer_carts`: KEEP_OPERATIONAL
- `public.customer_cart_items`: KEEP_OPERATIONAL
- `public.customer_cart_store_notes`: KEEP_OPERATIONAL
- `public.customer_orders`: KEEP_OPERATIONAL
- `public.store_orders`: KEEP_OPERATIONAL
- `public.store_order_items`: KEEP_OPERATIONAL
- `public.store_order_totals`: KEEP_OPERATIONAL
- `public.customer_order_totals`: KEEP_OPERATIONAL
- `public.store_order_status_history`: KEEP_OPERATIONAL
- `public.delivery_tasks`: KEEP_OPERATIONAL

### 20261007000100_customer_purchase_experience.sql

- `public.customer_addresses`: KEEP_OPERATIONAL
- `public.customer_cart_offer_selections`: KEEP_OPERATIONAL

### 20261017000100_ratings_and_reviews.sql

- `public.store_reviews`: KEEP_OPERATIONAL
- `public.product_reviews`: KEEP_OPERATIONAL

### 20261018000100_financial_foundation.sql

- `public.merchant_billing_settings`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_credit_limits`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_invoices`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_payments`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.invoice_payment_allocations`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_ledger_entries`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.store_order_commissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_financial_audit_events`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018000300_subscription_payments_allocations_credit.sql

- `public.subscription_payment_allocation_batches`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018000400_merchant_subscription_renewals.sql

- `public.merchant_subscription_plan_changes`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018000500_store_order_commissions.sql

- `public.store_order_commission_reversals`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018000800_cash_order_financial_foundation.sql

- `public.customer_order_cash_obligations`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_delivery_fee_entitlements`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_order_entitlements`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_order_entitlement_adjustments`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018000900_driver_cash_custody_office_remittances.sql

- `public.driver_cash_remittances`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_cash_credit_payouts`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261018001000_merchant_sales_settlements.sql

- `public.merchant_settlement_batches`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_settlement_batch_entitlements`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_settlement_payments`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_settlement_payment_allocations`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261102000100_store_branding.sql

- `public.store_branding_assets`: KEEP_OPERATIONAL

### 20261105000100_finance_c2_foundation.sql

- `public.financial_document_references`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.financial_account_definitions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.financial_accounts`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.financial_operations`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.financial_events`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.journal_entries`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.journal_lines`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.order_lifecycle_events`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE

### 20261106000100_finance_c3_delivery_pricing.sql

- `public.order_pricing_snapshots`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE
- `public.order_pricing_current`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE
- `public.order_pricing_revisions`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE
- `public.customer_order_requests`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE

### 20261107000200_c4_store_pickups_review_gate.sql

- `finance_private.c4_rollout`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c4_order_births`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.order_financial_modes`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.delivery_pickup_workflows`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE
- `public.delivery_store_pickups`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE

### 20261107000300_c4_atomic_delivery_collection.sql

- `public.delivery_collection_results`: REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE

### 20261108000100_finance_c5_driver_cash_handover.sql

- `finance_private.c5_rollout`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c5_cash_receivers`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_cash_handover_requests`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_cash_handover_attempts`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261109000100_finance_c6_driver_wages.sql

- `finance_private.c6_control`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c6_treasury_mutex`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c6_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_wage_policies`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c6_task_births`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.delivery_wage_snapshots`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_wage_entitlements`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_cash_receipt_allocations`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_wage_payments`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.driver_wage_payment_items`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261110000100_finance_c7_merchant_settlements.sql

- `finance_private.c7_control`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c7_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_delivery_positions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_settlement_documents`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.merchant_settlement_document_items`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.c7_merchant_settlement_payments`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261111000100_finance_c8_subscriptions.sql

- `finance_private.c8_control`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c8_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_plan_versions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_memberships`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_account_events`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_billing_documents`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.subscription_cash_receipts`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.subscription_job_failures`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261112000100_finance_c9_treasury.sql

- `finance_private.c9_control`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c9_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.treasury_control_documents`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261112000200_finance_c9_posting.sql

- `finance_private.c9_system_owners`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.treasury_finance_requests`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.treasury_finance_events`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `public.treasury_finance_postings`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261113000100_finance_c10_reconciliation.sql

- `finance_private.c10_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

### 20261114000100_finance_c11_safe_transition.sql

- `finance_private.c11_permissions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c11_gates`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c11_gate_audit`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c11_order_contracts`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT
- `finance_private.c11_subscription_transitions`: REMOVE_OLD_FINANCE_AFTER_REPLACEMENT

## اختبارات ووثائق مرشحة للتحديث أو الإحالة التاريخية

- `scripts/finance-c10-source.cjs`
- `scripts/finance-c11-inventory.cjs`
- `scripts/finance-c2-test-guard.cjs`
- `scripts/finance-c3-test-session.cjs`
- `scripts/financial-test-loader.cjs`
- `scripts/test-finance-c10-jwt.cjs`
- `scripts/test-finance-c10-postgres.cjs`
- `scripts/test-finance-c10.cjs`
- `scripts/test-finance-c11-jwt.cjs`
- `scripts/test-finance-c11-postgres.cjs`
- `scripts/test-finance-c11.cjs`
- `scripts/test-finance-c12-readonly.cjs`
- `scripts/test-finance-c2-guard.cjs`
- `scripts/test-finance-c2-postgres.cjs`
- `scripts/test-finance-c2.cjs`
- `scripts/test-finance-c3-postgres.cjs`
- `scripts/test-finance-c3.cjs`
- `scripts/test-finance-c4-postgres.cjs`
- `scripts/test-finance-c4.cjs`
- `scripts/test-finance-c5-postgres.cjs`
- `scripts/test-finance-c5.cjs`
- `scripts/test-finance-c6-postgres.cjs`
- `scripts/test-finance-c6.cjs`
- `scripts/test-finance-c7-postgres.cjs`
- `scripts/test-finance-c7.cjs`
- `scripts/test-finance-c8-postgres.cjs`
- `scripts/test-finance-c8.cjs`
- `scripts/test-finance-c9-completion-postgres.cjs`
- `scripts/test-finance-c9-completion.cjs`
- `scripts/test-finance-c9-jwt.cjs`
- `scripts/test-finance-c9-postgres.cjs`
- `scripts/test-finance-c9.cjs`
- `scripts/test-financial-reports.cjs`
- `scripts/test-merchant-finance-workflow.cjs`
- `scripts/test-merchant-financial-account.cjs`
- `scripts/test-merchant-settlement-render.cjs`
- `supabase/tests/finance_c10_integration.sql`
- `supabase/tests/finance_c11_transition.sql`
- `supabase/tests/finance_c2_foundation.sql`
- `supabase/tests/finance_c3_delivery_pricing.sql`
- `supabase/tests/finance_c4_decimal_pickups.sql`
- `supabase/tests/finance_c4_zero_delivery.sql`
- `supabase/tests/finance_c5_driver_cash_handover.sql`
- `supabase/tests/finance_c6_driver_wages.sql`
- `supabase/tests/finance_c7_merchant_settlements.sql`
- `supabase/tests/finance_c8_subscriptions.sql`
- `supabase/tests/finance_c9_completion.sql`
- `supabase/tests/finance_c9_opening.sql`
- `supabase/tests/finance_c9_treasury.sql`
- `supabase/tests/phase_9_7_driver_custody_regression.sql`
- `supabase/verification/finance_c10_readiness.sql`
- `supabase/verification/finance_c11_readiness.sql`
- `supabase/verification/finance_c12_cron_readonly.sql`
- `supabase/verification/finance_c12_test_readonly.sql`
- `supabase/verification/finance_c3_readiness.sql`
- `docs/finance-c10-integration.md`
- `docs/finance-c11-safe-transition.md`
- `docs/finance-c11-source-inventory.json`
- `docs/finance-c12-supabase-test-runbook.md`
- `docs/finance-c12-validation-results.json`
- `docs/finance-c12-validation.md`
- `docs/finance-c2-foundation.md`
- `docs/finance-c3-delivery-pricing.md`
- `docs/finance-c4-pickups-and-cash-cutover.md`
- `docs/finance-c5-driver-custody.md`
- `docs/finance-c6-driver-wages.md`
- `docs/finance-c7-merchant-settlements.md`
- `docs/finance-c8-subscriptions.md`
- `docs/finance-c9-treasury.md`
- `docs/subscriptions/01_CURRENT_STATE_AUDIT_AR.md`
- `docs/subscriptions/02_BUSINESS_RULES_AR.md`
- `docs/subscriptions/03_DATA_MODEL_PROPOSAL_AR.md`
- `docs/subscriptions/04_FINANCIAL_FLOWS_AR.md`
- `docs/subscriptions/05_RLS_RPC_SECURITY_AR.md`
- `docs/subscriptions/06_MIGRATION_STRATEGY_AR.md`
- `docs/subscriptions/07_TEST_MATRIX_AR.md`
- `docs/subscriptions/08_IMPLEMENTATION_PLAN_AR.md`
- `docs/subscriptions/09_PRODUCTION_SCHEMA_VERIFICATION_AR.md`
- `docs/subscriptions/10_FINANCIAL_FOUNDATION_DESIGN_AR.md`
- `docs/subscriptions/11_CREDIT_POLICY_AR.md`
- `docs/subscriptions/12_MIGRATION_REVIEW_AR.md`
- `docs/subscriptions/13_PHASE_7_3_REVIEW_NOTES_AR.md`
- `docs/subscriptions/phase-10-1-migration-readiness.md`
- `docs/subscriptions/phase-10-4-review-views-security.md`
- `docs/subscriptions/phase-9-4-financial-reports.md`
- `docs/subscriptions/phase-9-5-merchant-financial-account.md`
- `docs/subscriptions/phase-9-6-safe-product-removal.md`
- `docs/subscriptions/phase-9-7-security-review.md`
- `docs/subscriptions/sql_drafts/20261018_financial_foundation_transactional_tests.sql`
- `docs/subscriptions/sql_drafts/20261018_financial_foundation_verification_readonly.sql`
- `docs/subscriptions/sql_drafts/20261018_merchant_approval_initial_invoice_transactional_tests.sql`
- `docs/subscriptions/sql_drafts/20261018_order_delivery_metadata_readonly.sql`
