// Remote schema verified: dfpaeiffqkmedftjiqbm, 2026-10-29; Supabase CLI 2.122.0.
// Table relationships, all Views and available-task results use remote generation.
// Preserve CHECK-based profile refinements and SQL-nullable RPC arguments: CLI
// output cannot express those contracts. SYP literals equal currency_code = SYP.
import type {
  ProfileAgeRange,
  ProfileGender,
} from "@/types/profile-demographics";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      merchant_billing_settings: {
        Row: {
          merchant_id: string
          auto_renew: boolean
          updated_at: string
        }
        Insert: {
          merchant_id: string
          auto_renew?: boolean
          updated_at?: string
        }
        Update: {
          merchant_id?: string
          auto_renew?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_billing_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_credit_limits: {
        Row: {
          merchant_id: string
          credit_enabled: boolean
          credit_limit: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          merchant_id: string
          credit_enabled?: boolean
          credit_limit?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          merchant_id?: string
          credit_enabled?: boolean
          credit_limit?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_credit_limits_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_credit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          id: string
          invoice_number: string
          merchant_id: string
          subscription_id: string
          kind: string
          currency: "SYP"
          total_amount: number
          due_at: string | null
          status: string
          idempotency_key: string
          created_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          merchant_id: string
          subscription_id: string
          kind: string
          currency?: "SYP"
          total_amount: number
          due_at?: string | null
          status: string
          idempotency_key: string
          created_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          merchant_id?: string
          subscription_id?: string
          kind?: string
          currency?: "SYP"
          total_amount?: number
          due_at?: string | null
          status?: string
          idempotency_key?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_merchant_id_fkey"
            columns: ["subscription_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id", "merchant_id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          id: string
          merchant_id: string
          currency: "SYP"
          amount: number
          method: string
          external_reference: string | null
          idempotency_key: string
          received_at: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          currency?: "SYP"
          amount: number
          method: string
          external_reference?: string | null
          idempotency_key: string
          received_at: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          currency?: "SYP"
          amount?: number
          method?: string
          external_reference?: string | null
          idempotency_key?: string
          received_at?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_allocations: {
        Row: {
          id: string
          invoice_id: string
          payment_id: string
          amount: number
          created_at: string
          allocation_batch_id: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          payment_id: string
          amount: number
          created_at?: string
          allocation_batch_id?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          payment_id?: string
          amount?: number
          created_at?: string
          allocation_batch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_allocations_allocation_batch_id_fkey"
            columns: ["allocation_batch_id"]
            isOneToOne: false
            referencedRelation: "subscription_payment_allocation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "subscription_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_ledger_entries: {
        Row: {
          id: string
          merchant_id: string
          currency: "SYP"
          effect: string
          source_type: string
          source_id: string
          amount: number
          reversal_of: string | null
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          currency?: "SYP"
          effect: string
          source_type: string
          source_id: string
          amount: number
          reversal_of?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          currency?: "SYP"
          effect?: string
          source_type?: string
          source_id?: string
          amount?: number
          reversal_of?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_ledger_entries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_ledger_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "merchant_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_commissions: {
        Row: {
          id: string
          store_order_id: string
          merchant_id: string
          currency: "SYP"
          commission_rate: number
          base_amount: number
          commission_amount: number
          status: string
          created_at: string
          due_at: string | null
          subscription_id: string | null
          plan_id: string | null
          plan_name_snapshot: string | null
        }
        Insert: {
          id?: string
          store_order_id: string
          merchant_id: string
          currency?: "SYP"
          commission_rate: number
          base_amount: number
          commission_amount: number
          status: string
          created_at?: string
          due_at?: string | null
          subscription_id?: string | null
          plan_id?: string | null
          plan_name_snapshot?: string | null
        }
        Update: {
          id?: string
          store_order_id?: string
          merchant_id?: string
          currency?: "SYP"
          commission_rate?: number
          base_amount?: number
          commission_amount?: number
          status?: string
          created_at?: string
          due_at?: string | null
          subscription_id?: string | null
          plan_id?: string | null
          plan_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_order_commissions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_commissions_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_financial_audit_events: {
        Row: {
          id: string
          merchant_id: string
          actor_id: string | null
          event_type: string
          reason: string | null
          before_data: Json | null
          after_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          actor_id?: string | null
          event_type: string
          reason?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          actor_id?: string | null
          event_type?: string
          reason?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_financial_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_financial_audit_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_allocation_batches: {
        Row: {
          id: string
          payment_id: string
          idempotency_key: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          idempotency_key: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          idempotency_key?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_allocation_batches_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "subscription_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_allocation_batches_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscription_plan_changes: {
        Row: {
          id: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot: "SYP"
          idempotency_key: string
          selected_by: string
          selected_at: string
          superseded_at: string | null
          consumed_by_subscription: string | null
          commission_rate_snapshot: number | null
        }
        Insert: {
          id?: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot?: "SYP"
          idempotency_key: string
          selected_by: string
          selected_at?: string
          superseded_at?: string | null
          consumed_by_subscription?: string | null
          commission_rate_snapshot?: number | null
        }
        Update: {
          id?: string
          merchant_id?: string
          plan_id?: string
          plan_name_snapshot?: string
          duration_months?: number
          price_snapshot?: number
          currency_snapshot?: "SYP"
          idempotency_key?: string
          selected_by?: string
          selected_at?: string
          superseded_at?: string | null
          consumed_by_subscription?: string | null
          commission_rate_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscription_plan_change_consumed_by_subscription_fkey"
            columns: ["consumed_by_subscription"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscription_plan_changes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscription_plan_changes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscription_plan_changes_selected_by_fkey"
            columns: ["selected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_commission_reversals: {
        Row: {
          id: string
          commission_id: string
          merchant_id: string
          currency: "SYP"
          amount: number
          idempotency_key: string
          reason: string
          reversed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          commission_id: string
          merchant_id: string
          currency?: "SYP"
          amount: number
          idempotency_key: string
          reason: string
          reversed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          commission_id?: string
          merchant_id?: string
          currency?: "SYP"
          amount?: number
          idempotency_key?: string
          reason?: string
          reversed_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_commission_reversals_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "store_order_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_commission_reversals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_commission_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_cash_obligations: {
        Row: {
          id: string
          customer_order_id: string
          delivery_task_id: string
          driver_id: string
          currency: "SYP"
          delivered_store_items_amount: number
          delivery_fee_amount: number
          collectible_amount: number
          delivery_zone_id: string | null
          delivery_zone_name_snapshot: string
          delivered_at: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_order_id: string
          delivery_task_id: string
          driver_id: string
          currency?: "SYP"
          delivered_store_items_amount: number
          delivery_fee_amount: number
          collectible_amount: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot: string
          delivered_at: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_order_id?: string
          delivery_task_id?: string
          driver_id?: string
          currency?: "SYP"
          delivered_store_items_amount?: number
          delivery_fee_amount?: number
          collectible_amount?: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string
          delivered_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_cash_obligations_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_cash_obligations_delivery_task_id_fkey"
            columns: ["delivery_task_id"]
            isOneToOne: false
            referencedRelation: "delivery_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_cash_obligations_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_cash_obligations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_delivery_fee_entitlements: {
        Row: {
          id: string
          customer_order_id: string
          delivery_task_id: string
          driver_id: string
          currency: "SYP"
          delivery_fee_amount: number
          delivery_zone_id: string | null
          delivery_zone_name_snapshot: string
          status: string
          delivered_at: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_order_id: string
          delivery_task_id: string
          driver_id: string
          currency?: "SYP"
          delivery_fee_amount: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot: string
          status?: string
          delivered_at: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_order_id?: string
          delivery_task_id?: string
          driver_id?: string
          currency?: "SYP"
          delivery_fee_amount?: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string
          status?: string
          delivered_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_delivery_fee_entitlements_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_delivery_task_id_fkey"
            columns: ["delivery_task_id"]
            isOneToOne: true
            referencedRelation: "delivery_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_order_entitlements: {
        Row: {
          id: string
          store_order_id: string
          merchant_id: string
          commission_id: string
          currency: "SYP"
          gross_items_amount: number
          commission_amount_at_delivery: number
          initial_net_entitlement_amount: number
          status: string
          delivered_at: string
          created_at: string
        }
        Insert: {
          id?: string
          store_order_id: string
          merchant_id: string
          commission_id: string
          currency?: "SYP"
          gross_items_amount: number
          commission_amount_at_delivery: number
          initial_net_entitlement_amount: number
          status?: string
          delivered_at: string
          created_at?: string
        }
        Update: {
          id?: string
          store_order_id?: string
          merchant_id?: string
          commission_id?: string
          currency?: "SYP"
          gross_items_amount?: number
          commission_amount_at_delivery?: number
          initial_net_entitlement_amount?: number
          status?: string
          delivered_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "store_order_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_order_entitlement_adjustments: {
        Row: {
          id: string
          merchant_order_entitlement_id: string
          merchant_id: string
          currency: "SYP"
          amount: number
          effect: string
          source_type: string
          source_id: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_order_entitlement_id: string
          merchant_id: string
          currency?: "SYP"
          amount: number
          effect: string
          source_type: string
          source_id: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_order_entitlement_id?: string
          merchant_id?: string
          currency?: "SYP"
          amount?: number
          effect?: string
          source_type?: string
          source_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlement_ad_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_sale_rows"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_order_entitlement_ad_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlement_positions"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_order_entitlement_ad_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlement_adjustments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_cash_remittances: {
        Row: {
          id: string
          driver_id: string
          currency: "SYP"
          amount: number
          idempotency_key: string
          external_reference: string | null
          note: string
          received_by: string
          received_at: string
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          currency?: "SYP"
          amount: number
          idempotency_key: string
          external_reference?: string | null
          note?: string
          received_by: string
          received_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          currency?: "SYP"
          amount?: number
          idempotency_key?: string
          external_reference?: string | null
          note?: string
          received_by?: string
          received_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_cash_remittances_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_cash_remittances_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_cash_credit_payouts: {
        Row: {
          id: string
          driver_id: string
          currency: "SYP"
          amount: number
          idempotency_key: string
          external_reference: string | null
          note: string
          paid_by: string
          paid_at: string
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          currency?: "SYP"
          amount: number
          idempotency_key: string
          external_reference?: string | null
          note?: string
          paid_by: string
          paid_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          currency?: "SYP"
          amount?: number
          idempotency_key?: string
          external_reference?: string | null
          note?: string
          paid_by?: string
          paid_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_cash_credit_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_cash_credit_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlement_batches: {
        Row: {
          id: string
          merchant_id: string
          currency: "SYP"
          status: string
          period_starts_at: string | null
          period_ends_at: string | null
          idempotency_key: string
          note: string
          created_by: string
          created_at: string
          completed_at: string | null
          completed_by: string | null
        }
        Insert: {
          id?: string
          merchant_id: string
          currency?: "SYP"
          status?: string
          period_starts_at?: string | null
          period_ends_at?: string | null
          idempotency_key: string
          note?: string
          created_by: string
          created_at?: string
          completed_at?: string | null
          completed_by?: string | null
        }
        Update: {
          id?: string
          merchant_id?: string
          currency?: "SYP"
          status?: string
          period_starts_at?: string | null
          period_ends_at?: string | null
          idempotency_key?: string
          note?: string
          created_by?: string
          created_at?: string
          completed_at?: string | null
          completed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlement_batch_entitlements: {
        Row: {
          id: string
          batch_id: string
          merchant_order_entitlement_id: string
          amount_snapshot: number
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          merchant_order_entitlement_id: string
          amount_snapshot: number
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          merchant_order_entitlement_id?: string
          amount_snapshot?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_sale_rows"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlement_positions"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_entitlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_merchant_payout_report_rows"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_entitlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_merchant_settlement_report_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_entitlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_settlement_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_entitlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batch_positions"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_entitlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlement_payments: {
        Row: {
          id: string
          batch_id: string
          merchant_id: string
          currency: "SYP"
          amount: number
          idempotency_key: string
          external_reference: string | null
          note: string
          paid_by: string
          paid_at: string
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          merchant_id: string
          currency?: "SYP"
          amount: number
          idempotency_key: string
          external_reference?: string | null
          note?: string
          paid_by: string
          paid_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          merchant_id?: string
          currency?: "SYP"
          amount?: number
          idempotency_key?: string
          external_reference?: string | null
          note?: string
          paid_by?: string
          paid_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_merchant_payout_report_rows"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_merchant_settlement_report_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_settlement_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batch_positions"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlement_payment_allocations: {
        Row: {
          id: string
          payment_id: string
          batch_entitlement_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          batch_entitlement_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          batch_entitlement_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_payment_allocatio_batch_entitlement_id_fkey"
            columns: ["batch_entitlement_id"]
            isOneToOne: false
            referencedRelation: "admin_merchant_payout_report_rows"
            referencedColumns: ["batch_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_payment_allocatio_batch_entitlement_id_fkey"
            columns: ["batch_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batch_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_payment_allocatio_batch_entitlement_id_fkey"
            columns: ["batch_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_batch_positions"
            referencedColumns: ["batch_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "merchant_settlement_payments"
            referencedColumns: ["id"]
          },
        ]
      }
























      audit_logs: {
        Row: {
          id: number
          actor_id: string | null
          table_name: string
          record_id: string
          action: string
          old_values: Json | null
          new_values: Json | null
          created_at: string
        }
        Insert: {
          id?: never
          actor_id?: string | null
          table_name: string
          record_id: string
          action: string
          old_values?: Json | null
          new_values?: Json | null
          created_at?: string
        }
        Update: {
          id?: never
          actor_id?: string | null
          table_name?: string
          record_id?: string
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          id: string
          customer_id: string
          title: string
          recipient_name: string
          contact_phone: string
          delivery_address: string
          delivery_zone_id: string
          maps_url: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          title: string
          recipient_name: string
          contact_phone: string
          delivery_address: string
          delivery_zone_id: string
          maps_url?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          title?: string
          recipient_name?: string
          contact_phone?: string
          delivery_address?: string
          delivery_zone_id?: string
          maps_url?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cart_items: {
        Row: {
          id: string
          cart_id: string
          product_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          product_id: string
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          product_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "customer_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_rating_summaries"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "customer_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cart_store_notes: {
        Row: {
          cart_id: string
          store_id: string
          note: string
          updated_at: string
        }
        Insert: {
          cart_id: string
          store_id: string
          note?: string
          updated_at?: string
        }
        Update: {
          cart_id?: string
          store_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_cart_store_notes_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "customer_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cart_store_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "customer_cart_store_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cart_offer_selections: {
        Row: {
          cart_id: string
          offer_id: string
          created_at: string
        }
        Insert: {
          cart_id: string
          offer_id: string
          created_at?: string
        }
        Update: {
          cart_id?: string
          offer_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_cart_offer_selections_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "customer_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cart_offer_selections_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "store_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_carts: {
        Row: {
          id: string
          customer_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_totals: {
        Row: {
          customer_order_id: string
          currency: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
          delivery_fee: number
          total: number
        }
        Insert: {
          customer_order_id: string
          currency?: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
          delivery_fee?: number
          total: number
        }
        Update: {
          customer_order_id?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          items_subtotal?: number
          delivery_fee?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_totals_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          id: string
          order_number: number
          customer_id: string
          status: Database["public"]["Enums"]["customer_order_status"]
          recipient_name: string
          contact_phone: string
          delivery_address: string
          delivery_zone_id: string | null
          delivery_zone_name_snapshot: string
          delivery_fee: number
          delivery_currency: Database["public"]["Enums"]["currency_code"]
          payment_method: string
          customer_note: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: never
          customer_id: string
          status?: Database["public"]["Enums"]["customer_order_status"]
          recipient_name: string
          contact_phone: string
          delivery_address: string
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot: string
          delivery_fee: number
          delivery_currency?: Database["public"]["Enums"]["currency_code"]
          payment_method?: string
          customer_note?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: never
          customer_id?: string
          status?: Database["public"]["Enums"]["customer_order_status"]
          recipient_name?: string
          contact_phone?: string
          delivery_address?: string
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string
          delivery_fee?: number
          delivery_currency?: Database["public"]["Enums"]["currency_code"]
          payment_method?: string
          customer_note?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tasks: {
        Row: {
          id: string
          customer_order_id: string
          status: Database["public"]["Enums"]["delivery_task_status"]
          driver_id: string | null
          accepted_at: string | null
          picked_up_at: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_order_id: string
          status?: Database["public"]["Enums"]["delivery_task_status"]
          driver_id?: string | null
          accepted_at?: string | null
          picked_up_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_order_id?: string
          status?: Database["public"]["Enums"]["delivery_task_status"]
          driver_id?: string | null
          accepted_at?: string | null
          picked_up_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tasks_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tasks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          id: string
          name: string
          fixed_fee: number
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          fixed_fee: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          fixed_fee?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          id: string
          user_id: string
          full_name: string
          contact_phone: string
          vehicle_type: string
          contract_duration_months: number
          available_hours: Json
          status: Database["public"]["Enums"]["application_status"]
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          submitted_at: string
          created_at: string
          updated_at: string
          is_available: boolean
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          contact_phone: string
          vehicle_type: string
          contract_duration_months: number
          available_hours: Json
          status?: Database["public"]["Enums"]["application_status"]
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
          is_available?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          contact_phone?: string
          vehicle_type?: string
          contract_duration_months?: number
          available_hours?: Json
          status?: Database["public"]["Enums"]["application_status"]
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
          is_available?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "driver_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          plan_name_snapshot: string
          plan_duration_months_snapshot: number
          plan_price_snapshot: number
          plan_currency_snapshot: Database["public"]["Enums"]["currency_code"]
          contact_phone: string
          store_name: string
          store_description: string
          store_address: string
          status: Database["public"]["Enums"]["application_status"]
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          submitted_at: string
          created_at: string
          updated_at: string
          category_id: string
          plan_commission_rate_snapshot: number | null
          plan_product_limit_snapshot: number | null
          plan_features_snapshot: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          plan_name_snapshot: string
          plan_duration_months_snapshot: number
          plan_price_snapshot: number
          plan_currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          contact_phone: string
          store_name: string
          store_description?: string
          store_address: string
          status?: Database["public"]["Enums"]["application_status"]
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
          category_id: string
          plan_commission_rate_snapshot?: number | null
          plan_product_limit_snapshot?: number | null
          plan_features_snapshot?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          plan_name_snapshot?: string
          plan_duration_months_snapshot?: number
          plan_price_snapshot?: number
          plan_currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          contact_phone?: string
          store_name?: string
          store_description?: string
          store_address?: string
          status?: Database["public"]["Enums"]["application_status"]
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
          category_id?: string
          plan_commission_rate_snapshot?: number | null
          plan_product_limit_snapshot?: number | null
          plan_features_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_applications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscriptions: {
        Row: {
          id: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot: Database["public"]["Enums"]["currency_code"]
          starts_at: string
          expires_at: string
          created_at: string
          commission_rate_snapshot: number | null
        }
        Insert: {
          id?: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          starts_at?: string
          expires_at: string
          created_at?: string
          commission_rate_snapshot?: number | null
        }
        Update: {
          id?: string
          merchant_id?: string
          plan_id?: string
          plan_name_snapshot?: string
          duration_months?: number
          price_snapshot?: number
          currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          starts_at?: string
          expires_at?: string
          created_at?: string
          commission_rate_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          id: string
          owner_user_id: string
          contact_phone: string
          status: Database["public"]["Enums"]["application_status"]
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          contact_phone: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          contact_phone?: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          data: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string
          data?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          data?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      product_media: {
        Row: {
          id: string
          store_id: string
          product_id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          storage_path: string
          display_order: number
          alt_text: string
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          product_id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          storage_path: string
          display_order?: number
          alt_text?: string
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          product_id?: string
          media_type?: Database["public"]["Enums"]["store_media_type"]
          storage_path?: string
          display_order?: number
          alt_text?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_store_id_fkey"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          store_id: string
          category_id: string
          title: string
          description: string
          price: number
          selling_unit: string
          minimum_quantity: number
          quantity_step: number
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          category_id: string
          title: string
          description?: string
          price: number
          selling_unit?: string
          minimum_quantity?: number
          quantity_step?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          category_id?: string
          title?: string
          description?: string
          price?: number
          selling_unit?: string
          minimum_quantity?: number
          quantity_step?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          id: string
          store_order_id: string
          store_id: string
          purchased_product_id: string
          product_id: string | null
          product_title_snapshot: string
          customer_id: string
          rating: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_order_id: string
          store_id: string
          purchased_product_id: string
          product_id?: string | null
          product_title_snapshot: string
          customer_id: string
          rating: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_order_id?: string
          store_id?: string
          purchased_product_id?: string
          product_id?: string | null
          product_title_snapshot?: string
          customer_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_rating_summaries"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["account_role"]
          created_at: string
          updated_at: string
          age_range: ProfileAgeRange | null
          gender: ProfileGender | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: Database["public"]["Enums"]["account_role"]
          created_at?: string
          updated_at?: string
          age_range?: ProfileAgeRange | null
          gender?: ProfileGender | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["account_role"]
          created_at?: string
          updated_at?: string
          age_range?: ProfileAgeRange | null
          gender?: ProfileGender | null
        }
        Relationships: []
      }
      store_categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      store_offer_media: {
        Row: {
          id: string
          store_id: string
          offer_id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          storage_path: string
          display_order: number
          alt_text: string
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          offer_id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          storage_path: string
          display_order?: number
          alt_text?: string
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          offer_id?: string
          media_type?: Database["public"]["Enums"]["store_media_type"]
          storage_path?: string
          display_order?: number
          alt_text?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_offer_media_offer_id_store_id_fkey"
            columns: ["offer_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_offers"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      store_offer_products: {
        Row: {
          id: string
          store_id: string
          offer_id: string
          product_id: string
          item_role: Database["public"]["Enums"]["offer_product_role"]
          quantity: number
        }
        Insert: {
          id?: string
          store_id: string
          offer_id: string
          product_id: string
          item_role: Database["public"]["Enums"]["offer_product_role"]
          quantity: number
        }
        Update: {
          id?: string
          store_id?: string
          offer_id?: string
          product_id?: string
          item_role?: Database["public"]["Enums"]["offer_product_role"]
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_offer_products_offer_id_store_id_fkey"
            columns: ["offer_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_offers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "store_offer_products_product_id_store_id_fkey"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      store_offers: {
        Row: {
          id: string
          store_id: string
          title: string
          description: string
          offer_type: Database["public"]["Enums"]["store_offer_type"]
          discount_method: | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value: number | null
          bundle_price: number | null
          starts_at: string
          ends_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          title: string
          description?: string
          offer_type: Database["public"]["Enums"]["store_offer_type"]
          discount_method?: | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value?: number | null
          bundle_price?: number | null
          starts_at?: string
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          title?: string
          description?: string
          offer_type?: Database["public"]["Enums"]["store_offer_type"]
          discount_method?: | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value?: number | null
          bundle_price?: number | null
          starts_at?: string
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_offers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_offers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_items: {
        Row: {
          id: string
          store_order_id: string
          product_id: string | null
          product_title_snapshot: string
          selling_unit_snapshot: string
          quantity: number
          unit_price_snapshot: number
          currency: Database["public"]["Enums"]["currency_code"]
          line_total: number
          created_at: string
          offer_snapshot: Json | null
        }
        Insert: {
          id?: string
          store_order_id: string
          product_id?: string | null
          product_title_snapshot: string
          selling_unit_snapshot: string
          quantity: number
          unit_price_snapshot: number
          currency?: Database["public"]["Enums"]["currency_code"]
          line_total: number
          created_at?: string
          offer_snapshot?: Json | null
        }
        Update: {
          id?: string
          store_order_id?: string
          product_id?: string | null
          product_title_snapshot?: string
          selling_unit_snapshot?: string
          quantity?: number
          unit_price_snapshot?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          line_total?: number
          created_at?: string
          offer_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_rating_summaries"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "store_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_status_history: {
        Row: {
          id: number
          store_order_id: string
          from_status: Database["public"]["Enums"]["store_order_status"] | null
          to_status: Database["public"]["Enums"]["store_order_status"]
          actor_id: string | null
          note: string
          created_at: string
        }
        Insert: {
          id?: never
          store_order_id: string
          from_status?: Database["public"]["Enums"]["store_order_status"] | null
          to_status: Database["public"]["Enums"]["store_order_status"]
          actor_id?: string | null
          note?: string
          created_at?: string
        }
        Update: {
          id?: never
          store_order_id?: string
          from_status?: Database["public"]["Enums"]["store_order_status"] | null
          to_status?: Database["public"]["Enums"]["store_order_status"]
          actor_id?: string | null
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_status_history_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_totals: {
        Row: {
          store_order_id: string
          currency: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
        }
        Insert: {
          store_order_id: string
          currency?: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
        }
        Update: {
          store_order_id?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          items_subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_totals_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          id: string
          customer_order_id: string
          store_id: string
          status: Database["public"]["Enums"]["store_order_status"]
          customer_note: string
          rejection_reason: string | null
          reviewed_at: string | null
          ready_at: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_order_id: string
          store_id: string
          status?: Database["public"]["Enums"]["store_order_status"]
          customer_note?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          ready_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_order_id?: string
          store_id?: string
          status?: Database["public"]["Enums"]["store_order_status"]
          customer_note?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          ready_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          id: string
          merchant_id: string
          name: string
          description: string
          phone: string
          address: string
          status: Database["public"]["Enums"]["application_status"]
          created_at: string
          category_id: string
        }
        Insert: {
          id?: string
          merchant_id: string
          name: string
          description?: string
          phone: string
          address: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string
          category_id: string
        }
        Update: {
          id?: string
          merchant_id?: string
          name?: string
          description?: string
          phone?: string
          address?: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_reviews: {
        Row: {
          id: string
          store_order_id: string
          store_id: string
          customer_id: string
          rating: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_order_id: string
          store_id: string
          customer_id: string
          rating: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_order_id?: string
          store_id?: string
          customer_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_reviews_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          duration_months: number
          price: number
          description: string
          is_active: boolean
          created_at: string
          updated_at: string
          commission_rate: number | null
          product_limit: number | null
          features: Json | null
        }
        Insert: {
          id?: string
          name: string
          duration_months: number
          price: number
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          commission_rate?: number | null
          product_limit?: number | null
          features?: Json | null
        }
        Update: {
          id?: string
          name?: string
          duration_months?: number
          price?: number
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          commission_rate?: number | null
          product_limit?: number | null
          features?: Json | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          id: string
          user_id: string
          currency: Database["public"]["Enums"]["currency_code"]
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          direction: Database["public"]["Enums"]["wallet_direction"]
          amount: number
          balance_after: number
          note: string
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          currency?: Database["public"]["Enums"]["currency_code"]
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          direction: Database["public"]["Enums"]["wallet_direction"]
          amount: number
          balance_after: number
          note?: string
          recorded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          transaction_type?: Database["public"]["Enums"]["wallet_transaction_type"]
          direction?: Database["public"]["Enums"]["wallet_direction"]
          amount?: number
          balance_after?: number
          note?: string
          recorded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallets: {
        Row: {
          user_id: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_cash_movement_events: {
        Row: {
          amount: number | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          direction: string | null
          event_type: string | null
          id: string | null
          note: string | null
          occurred_at: string | null
          party_id: string | null
          reference: string | null
        }
        Relationships: []
      }
      admin_delivery_fee_report_rows: {
        Row: {
          currency: Database["public"]["Enums"]["currency_code"] | null
          customer_order_id: string | null
          delivered_at: string | null
          delivery_fee_amount: number | null
          delivery_task_id: string | null
          delivery_zone_id: string | null
          delivery_zone_name_snapshot: string | null
          driver_id: string | null
        }
        Insert: {
          currency?: Database["public"]["Enums"]["currency_code"] | null
          customer_order_id?: string | null
          delivered_at?: string | null
          delivery_fee_amount?: number | null
          delivery_task_id?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string | null
          driver_id?: string | null
        }
        Update: {
          currency?: Database["public"]["Enums"]["currency_code"] | null
          customer_order_id?: string | null
          delivered_at?: string | null
          delivery_fee_amount?: number | null
          delivery_task_id?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string | null
          driver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_delivery_fee_entitlements_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_delivery_task_id_fkey"
            columns: ["delivery_task_id"]
            isOneToOne: true
            referencedRelation: "delivery_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_delivery_fee_entitlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_merchant_financial_report_events: {
        Row: {
          amount: number | null
          batch_id: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          event_type: string | null
          id: string | null
          merchant_id: string | null
          occurred_at: string | null
          paid_amount: number | null
          reference: string | null
          remaining_amount: number | null
          status: string | null
          store_order_id: string | null
        }
        Relationships: []
      }
      admin_merchant_payout_report_rows: {
        Row: {
          batch_entitlement_id: string | null
          batch_id: string | null
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_entitlement_amount: number | null
          delivered_at: string | null
          merchant_id: string | null
          merchant_order_entitlement_id: string | null
          paid_amount: number | null
          remaining_amount: number | null
          status: string | null
          store_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlements_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_sale_rows"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlement_positions"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_merchant_settlement_report_batches: {
        Row: {
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          entitlement_amount: number | null
          id: string | null
          merchant_id: string | null
          paid_amount: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          entitlement_amount?: never
          id?: string | null
          merchant_id?: string | null
          paid_amount?: never
          status?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          entitlement_amount?: never
          id?: string | null
          merchant_id?: string | null
          paid_amount?: never
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_platform_revenue_report_events: {
        Row: {
          amount: number | null
          commission_id: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          event_type: string | null
          id: string | null
          invoice_id: string | null
          merchant_id: string | null
          occurred_at: string | null
          payment_id: string | null
          reference: string | null
          store_order_id: string | null
        }
        Relationships: []
      }
      driver_cash_custody_positions: {
        Row: {
          cash_collected_amount: number | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          custody_remaining_amount: number | null
          delivery_fee_entitled_amount: number | null
          driver_credit_amount: number | null
          driver_credit_paid_amount: number | null
          driver_id: string | null
          net_custody_due_amount: number | null
          office_received_amount: number | null
        }
        Relationships: []
      }
      merchant_account_sale_rows: {
        Row: {
          adjustment_amount: number | null
          base_amount: number | null
          commission_amount_at_delivery: number | null
          commission_id: string | null
          commission_rate: number | null
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_entitlement_amount: number | null
          delivered_at: string | null
          gross_items_amount: number | null
          initial_net_entitlement_amount: number | null
          merchant_id: string | null
          merchant_order_entitlement_id: string | null
          net_commission_amount: number | null
          order_number: number | null
          paid_amount: number | null
          remaining_amount: number | null
          reserved_amount: number | null
          settlement_status: string | null
          status: string | null
          store_order_id: string | null
          unbatched_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "store_order_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_account_settlement_rows: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          id: string | null
          idempotency_key: string | null
          merchant_id: string | null
          note: string | null
          paid_amount: number | null
          period_ends_at: string | null
          period_starts_at: string | null
          remaining_amount: number | null
          settlement_status: string | null
          status: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_settlement_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_financial_positions: {
        Row: {
          booked_exposure: number | null
          commissions_due: number | null
          credit_available: number | null
          credit_enabled: boolean | null
          credit_limit: number | null
          credit_used: number | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          effective_exposure: number | null
          invoice_outstanding: number | null
          invoices_total: number | null
          merchant_id: string | null
          payments_allocated: number | null
          payments_recorded: number | null
          unapplied_payment_balance: number | null
        }
        Relationships: []
      }
      merchant_order_entitlement_positions: {
        Row: {
          adjustment_amount: number | null
          commission_amount_at_delivery: number | null
          commission_id: string | null
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_entitlement_amount: number | null
          delivered_at: string | null
          gross_items_amount: number | null
          initial_net_entitlement_amount: number | null
          merchant_id: string | null
          merchant_order_entitlement_id: string | null
          status: string | null
          store_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlements_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "store_order_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_entitlements_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_settlement_batch_positions: {
        Row: {
          batch_entitlement_id: string | null
          batch_id: string | null
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          current_entitlement_amount: number | null
          delivered_at: string | null
          merchant_id: string | null
          merchant_order_entitlement_id: string | null
          paid_amount: number | null
          remaining_amount: number | null
          status: string | null
          store_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_entitlements_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_account_sale_rows"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlement_positions"
            referencedColumns: ["merchant_order_entitlement_id"]
          },
          {
            foreignKeyName: "merchant_settlement_batch_ent_merchant_order_entitlement_i_fkey"
            columns: ["merchant_order_entitlement_id"]
            isOneToOne: false
            referencedRelation: "merchant_order_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_settlement_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_public_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          product_id: string | null
          product_title_snapshot: string | null
          rating: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_rating_summaries"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_rating_summaries: {
        Row: {
          average_rating: number | null
          product_id: string | null
          rating_count: number | null
        }
        Relationships: []
      }
      store_public_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          rating: number | null
          store_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_rating_summaries"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_rating_summaries: {
        Row: {
          average_rating: number | null
          rating_count: number | null
          store_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      require_review_customer: {
        Args: never
        Returns: string
      }
      allocate_subscription_payment: {
        Args: {
          target_payment: string
          allocation_input: Json
          allocation_idempotency_key: string
        }
        Returns: string
      }
      store_accepts_new_orders: {
        Args: {
          target_store: string
        }
        Returns: boolean
      }
      subscription_renewal_internal: {
        Args: {
          target_merchant: string
          renewal_idempotency_key: string
          require_credit: boolean
          audit_actor: string
          audit_event_type: string
          audit_reason?: string | null
        }
        Returns: string
      }
      renew_merchant_subscription: {
        Args: {
          target_merchant: string
          renewal_idempotency_key: string
          renewal_reason?: string | null
        }
        Returns: string
      }
      schedule_merchant_subscription_plan_change: {
        Args: {
          target_merchant: string
          target_plan: string
          change_idempotency_key: string
          change_reason?: string | null
        }
        Returns: string
      }
      set_merchant_auto_renew: {
        Args: {
          target_merchant: string
          enabled: boolean
          change_reason?: string | null
        }
        Returns: undefined
      }
      process_due_merchant_subscription_renewals: {
        Args: {
          batch_limit?: number
        }
        Returns: { renewed_count: number; skipped_count: number }[]
      }
      accrue_store_order_commission: {
        Args: {
          target_store_order: string
          delivered_at_value: string
        }
        Returns: undefined
      }
      reconcile_subscription_commission_rate: {
        Args: {
          target_subscription: string
          reconciled_commission_rate: number
          reconciliation_reason: string
        }
        Returns: undefined
      }
      reverse_store_order_commission: {
        Args: {
          target_commission: string
          reversal_amount: number
          reversal_idempotency_key: string
          reversal_reason: string
        }
        Returns: string
      }
      create_delivered_order_cash_foundations: {
        Args: {
          target_customer_order: string
        }
        Returns: undefined
      }




      record_subscription_payment: {
        Args: {
          target_merchant: string
          payment_amount: number
          payment_method: string
          payment_idempotency_key: string
          allocation_input?: Json
          payment_external_reference?: string | null
          payment_received_at?: string | null
        }
        Returns: string
      }
      set_merchant_credit_limit: {
        Args: {
          target_merchant: string
          credit_is_enabled: boolean
          credit_amount: number
          change_reason?: string | null
        }
        Returns: undefined
      }
      record_driver_cash_remittance: {
        Args: {
          target_driver: string
          remittance_amount: number
          remittance_idempotency_key: string
          remittance_reference?: string | null
          remittance_note?: string | null
        }
        Returns: string
      }
      pay_driver_cash_credit: {
        Args: {
          target_driver: string
          payout_amount: number
          payout_idempotency_key: string
          payout_reference?: string | null
          payout_note?: string | null
        }
        Returns: string
      }
      create_merchant_settlement_batch: {
        Args: {
          target_merchant: string
          entitlement_ids: string[]
          batch_idempotency_key: string
          period_start_value?: string | null
          period_end_value?: string | null
          batch_note?: string | null
        }
        Returns: string
      }
      record_merchant_settlement_payment: {
        Args: {
          target_batch: string
          payment_amount: number
          payment_allocations: Json
          payment_idempotency_key: string
          payment_reference?: string | null
          payment_note?: string | null
        }
        Returns: string
      }
      admin_financial_report: {
        Args: {
          report_kind: string
          period_from?: string | null
          period_until?: string | null
          movement_type?: string | null
          target_driver?: string | null
          zone_snapshot?: string | null
          page_number?: number
        }
        Returns: Json
      }
      admin_sales_revenue_report: {
        Args: {
          report_kind: string
          period_from?: string | null
          period_until?: string | null
          target_merchant?: string | null
          detail_type?: string | null
          settlement_state?: string | null
          page_number?: number
        }
        Returns: Json
      }
      merchant_financial_account: {
        Args: {
          section_name?: string
          period_from?: string | null
          period_until?: string | null
          selected_status?: string | null
          order_search?: string | null
          record_id?: string | null
          page_number?: number
          payments_page?: number
        }
        Returns: Json
      }

      accept_delivery_task: {
        Args: { target_customer_order: string }
        Returns: undefined
      }
      can_manage_store_media_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_view_customer_order: {
        Args: { target_order: string }
        Returns: boolean
      }
      can_view_delivery_task: {
        Args: { target_task: string }
        Returns: boolean
      }
      can_view_store_order: {
        Args: { target_store_order: string }
        Returns: boolean
      }
      cancel_customer_order: {
        Args: { target_customer_order: string }
        Returns: undefined
      }
      create_order_from_cart: {
        Args: {
          input_contact_phone: string
          input_customer_note?: string
          input_delivery_address: string
          input_delivery_zone: string
          input_recipient_name: string
        }
        Returns: string
      }
      add_customer_cart_offer: {
        Args: { target_offer: string }
        Returns: undefined
      }
      delete_customer_address: {
        Args: { target_address: string }
        Returns: undefined
      }
      delete_store_offer: { Args: { target_offer: string }; Returns: undefined }
      create_product_review: {
        Args: {
          input_comment?: string | null
          input_rating: number
          target_product: string
          target_store_order: string
        }
        Returns: string
      }
      create_store_review: {
        Args: {
          input_comment?: string | null
          input_rating: number
          target_store_order: string
        }
        Returns: string
      }
      delete_product_review: { Args: { target_review: string }; Returns: undefined }
      delete_store_review: { Args: { target_review: string }; Returns: undefined }
      get_my_product_review: {
        Args: { target_product: string; target_store_order: string }
        Returns: { comment: string | null; id: string; rating: number }[]
      }
      get_my_store_review: {
        Args: { target_store_order: string }
        Returns: { comment: string | null; id: string; rating: number }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_available_driver: { Args: never; Returns: boolean }
      is_approved_driver: { Args: never; Returns: boolean }
      is_store_owner: { Args: { target_store: string }; Returns: boolean }
      record_wallet_transaction: {
        Args: {
          operation: Database["public"]["Enums"]["wallet_transaction_type"]
          operation_amount: number
          operation_direction: Database["public"]["Enums"]["wallet_direction"]
          operation_note?: string
          target_user: string
        }
        Returns: string
      }
      refresh_customer_order_status: {
        Args: { target_order: string }
        Returns: undefined
      }
      remove_customer_cart_offer: {
        Args: { target_offer: string }
        Returns: undefined
      }
      review_driver_application: {
        Args: {
          decision: Database["public"]["Enums"]["application_status"]
          decision_note?: string
          target_application: string
        }
        Returns: undefined
      }
      save_customer_address: {
        Args: {
          input_contact_phone: string
          input_delivery_address: string
          input_delivery_zone: string
          input_is_default: boolean
          input_maps_url: string
          input_recipient_name: string
          input_title: string
          target_address: string | null
        }
        Returns: string
      }
      set_default_customer_address: {
        Args: { target_address: string }
        Returns: undefined
      }
      set_driver_availability: {
        Args: { input_available: boolean }
        Returns: boolean
      }
      list_available_delivery_tasks: {
        Args: never
        Returns: {
          created_at: string
          customer_order_id: string
          delivery_zone_name_snapshot: string
          order_number: number
          store_count: number
          task_id: string
        }[]
      }
      review_merchant_application: {
        Args: {
          decision: Database["public"]["Enums"]["application_status"]
          decision_note?: string
          target_application: string
        }
        Returns: undefined
      }
      save_store_offer: {
        Args: {
          input_bundle_price: number | null
          input_description: string
          input_discount_method: Database["public"]["Enums"]["offer_discount_method"] | null
          input_discount_value: number | null
          input_ends_at: string | null
          input_is_active: boolean
          input_items: Json
          input_title: string
          input_type: Database["public"]["Enums"]["store_offer_type"]
          selected_offer: string | null
        }
        Returns: string
      }
      submit_driver_application: {
        Args: {
          input_available_hours: Json
          input_contact_phone: string
          input_contract_duration_months: number
          input_full_name: string
          input_vehicle_type: string
        }
        Returns: string
      }
      submit_merchant_application: {
        Args: {
          input_contact_phone: string
          input_store_address: string
          input_store_description: string
          input_store_name: string
          selected_plan: string
          selected_store_category: string
        }
        Returns: string
      }
      update_delivery_task_status: {
        Args: {
          next_status: Database["public"]["Enums"]["delivery_task_status"]
          target_customer_order: string
        }
        Returns: undefined
      }
      update_store_order_status: {
        Args: {
          next_status: Database["public"]["Enums"]["store_order_status"]
          reason?: string
          target_store_order: string
        }
        Returns: undefined
      }
      update_product_review: {
        Args: { input_comment?: string | null; input_rating: number; target_review: string }
        Returns: undefined
      }
      update_store_review: {
        Args: { input_comment?: string | null; input_rating: number; target_review: string }
        Returns: undefined
      }
    }
    Enums: {
      account_role: "customer" | "merchant" | "driver" | "admin"
      application_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "changes_requested"
      currency_code: "SYP"
      customer_order_status:
        | "submitted"
        | "in_progress"
        | "ready_for_delivery"
        | "out_for_delivery"
        | "delivered"
        | "partially_cancelled"
        | "cancelled"
      delivery_task_status:
        | "pending_stores"
        | "available"
        | "accepted"
        | "picked_up"
        | "delivered"
        | "cancelled"
      offer_discount_method: "percentage" | "fixed_amount"
      offer_product_role: "discounted" | "bundle" | "buy" | "reward"
      store_media_type: "image" | "video"
      store_offer_type: "discount" | "bundle" | "buy_x_get_y"
      store_order_status:
        | "awaiting_review"
        | "preparing"
        | "ready_for_pickup"
        | "handed_to_driver"
        | "delivered"
        | "rejected"
        | "cancelled"
      wallet_direction: "credit" | "debit"
      wallet_transaction_type:
        | "subscription_initialization"
        | "funding"
        | "settlement"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_role: ["customer", "merchant", "driver", "admin"],
      application_status: [
        "pending",
        "accepted",
        "rejected",
        "changes_requested",
      ],
      currency_code: ["SYP"],
      customer_order_status: [
        "submitted",
        "in_progress",
        "ready_for_delivery",
        "out_for_delivery",
        "delivered",
        "partially_cancelled",
        "cancelled",
      ],
      delivery_task_status: [
        "pending_stores",
        "available",
        "accepted",
        "picked_up",
        "delivered",
        "cancelled",
      ],
      offer_discount_method: ["percentage", "fixed_amount"],
      offer_product_role: ["discounted", "bundle", "buy", "reward"],
      store_media_type: ["image", "video"],
      store_offer_type: ["discount", "bundle", "buy_x_get_y"],
      store_order_status: [
        "awaiting_review",
        "preparing",
        "ready_for_pickup",
        "handed_to_driver",
        "delivered",
        "rejected",
        "cancelled",
      ],
      wallet_direction: ["credit", "debit"],
      wallet_transaction_type: [
        "subscription_initialization",
        "funding",
        "settlement",
        "adjustment",
      ],
    },
  },
} as const
