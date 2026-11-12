// Local migration contract after invoice-finance cutover. Based on the preserved
// historical types plus an isolated PostgreSQL catalog; NOT hosted schema generation.
// Regenerate against the owner database after applying the migration.
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
      catalog_categories: {
        Row: { id: string; scope: "store" | "product"; name: string; slug: string; parent_id: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; scope: "store" | "product"; name: string; slug: string; parent_id?: string | null; is_active?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: Partial<Database["public"]["Tables"]["catalog_categories"]["Insert"]>
        Relationships: []
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

          wage_policy: Json | null
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

          wage_policy?: Json | null
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

          wage_policy?: Json | null
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

          additional_store_fee: number
          pricing_version: number
        }
        Insert: {
          id?: string
          name: string
          fixed_fee: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string

          additional_store_fee?: number
          pricing_version?: number
        }
        Update: {
          id?: string
          name?: string
          fixed_fee?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string

          additional_store_fee?: number
          pricing_version?: number
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          id: string
          public_reference: string
          user_id: string
          full_name: string
          contact_phone: string
          vehicle_type: string
          contract_duration_months: number | null
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
          public_reference?: string
          id?: string
          user_id: string
          full_name: string
          contact_phone: string
          vehicle_type: string
          contract_duration_months?: number | null
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
          public_reference?: string
          user_id?: string
          full_name?: string
          contact_phone?: string
          vehicle_type?: string
          contract_duration_months?: number | null
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
          public_reference: string
          user_id: string
          plan_id: string | null
          plan_name_snapshot: string | null
          plan_duration_months_snapshot: number | null
          plan_price_snapshot: number | null
          plan_currency_snapshot: Database["public"]["Enums"]["currency_code"] | null
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
          public_reference?: string
          id?: string
          user_id: string
          plan_id?: string | null
          plan_name_snapshot?: string | null
          plan_duration_months_snapshot?: number | null
          plan_price_snapshot?: number | null
          plan_currency_snapshot?: Database["public"]["Enums"]["currency_code"] | null
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
          public_reference?: string
          user_id?: string
          plan_id?: string | null
          plan_name_snapshot?: string | null
          plan_duration_months_snapshot?: number | null
          plan_price_snapshot?: number | null
          plan_currency_snapshot?: Database["public"]["Enums"]["currency_code"] | null
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
      merchants: {
        Row: {
          id: string
          owner_user_id: string
          contact_phone: string
          status: Database["public"]["Enums"]["application_status"]
          created_at: string

          public_reference: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          contact_phone: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string

          public_reference?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          contact_phone?: string
          status?: Database["public"]["Enums"]["application_status"]
          created_at?: string

          public_reference?: string
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

          public_reference: string
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

          public_reference?: string
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

          public_reference?: string
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
          birth_date: string | null
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
          birth_date?: string | null
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
          birth_date?: string | null
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

          public_reference: string
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

          public_reference?: string
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

          public_reference?: string
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

          public_reference: string
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

          public_reference?: string
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

          public_reference?: string
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

      // Local cutover migration contract; not generated from a hosted database.
      commerce_references: {
        Row: {
          kind: string
          record_id: string
          reference: string
        }
        Insert: {
          kind: string
          record_id: string
          reference: string
        }
        Update: {
          kind?: string
          record_id?: string
          reference?: string
        }
        Relationships: []
      }
      customer_order_requests: {
        Row: {
          customer_id: string
          request_key: string
          canonical_input: Json
          state: string
          failure_code: string | null
          customer_order_id: string | null
        }
        Insert: {
          customer_id: string
          request_key: string
          canonical_input: Json
          state?: string
          failure_code?: string | null
          customer_order_id?: string | null
        }
        Update: {
          customer_id?: string
          request_key?: string
          canonical_input?: Json
          state?: string
          failure_code?: string | null
          customer_order_id?: string | null
        }
        Relationships: []
      }
      delivery_store_pickups: {
        Row: {
          task_id: string
          store_order_id: string
          driver_id: string
          reference: string
          picked_up_at: string
        }
        Insert: {
          task_id: string
          store_order_id: string
          driver_id: string
          reference: string
          picked_up_at?: string
        }
        Update: {
          task_id?: string
          store_order_id?: string
          driver_id?: string
          reference?: string
          picked_up_at?: string
        }
        Relationships: []
      }
      merchant_terms: {
        Row: {
          id: string
          merchant_id: string
          plan_id: string | null
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot: string
          commission_rate_snapshot: number
          product_limit: number
          starts_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          plan_id?: string | null
          plan_name_snapshot: string
          duration_months: number
          price_snapshot: number
          currency_snapshot?: string
          commission_rate_snapshot: number
          product_limit: number
          starts_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          plan_id?: string | null
          plan_name_snapshot?: string
          duration_months?: number
          price_snapshot?: number
          currency_snapshot?: string
          commission_rate_snapshot?: number
          product_limit?: number
          starts_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      money_accounts: {
        Row: {
          owner_id: string
          reference: string
          created_at: string
        }
        Insert: {
          owner_id: string
          reference: string
          created_at?: string
        }
        Update: {
          owner_id?: string
          reference?: string
          created_at?: string
        }
        Relationships: []
      }
      money_allocations: {
        Row: {
          settlement_id: string
          due_id: string
          amount: number
        }
        Insert: {
          settlement_id: string
          due_id: string
          amount: number
        }
        Update: {
          settlement_id?: string
          due_id?: string
          amount?: number
        }
        Relationships: []
      }
      money_attempts: {
        Row: {
          actor: string
          key: string
          input: Json
          result: Json
        }
        Insert: {
          actor: string
          key: string
          input: Json
          result: Json
        }
        Update: {
          actor?: string
          key?: string
          input?: Json
          result?: Json
        }
        Relationships: []
      }
      money_delivery_attempts: {
        Row: {
          actor: string
          key: string
          task_id: string
          version: number
          result: Json
        }
        Insert: {
          actor: string
          key: string
          task_id: string
          version: number
          result: Json
        }
        Update: {
          actor?: string
          key?: string
          task_id?: string
          version?: number
          result?: Json
        }
        Relationships: []
      }
      money_driver_policies: {
        Row: {
          driver_id: string
          mode: string
          value: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          driver_id: string
          mode: string
          value: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          driver_id?: string
          mode?: string
          value?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      money_dues: {
        Row: {
          id: string
          invoice_id: string
          owner_id: string
          purpose: string
          direction: string
          amount: number
        }
        Insert: {
          id?: string
          invoice_id: string
          owner_id: string
          purpose: string
          direction: string
          amount: number
        }
        Update: {
          id?: string
          invoice_id?: string
          owner_id?: string
          purpose?: string
          direction?: string
          amount?: number
        }
        Relationships: []
      }
      money_invoices: {
        Row: {
          id: string
          reference: string
          kind: string
          owner_id: string
          title: string
          source_key: string
          customer_order_id: string | null
          store_order_id: string | null
          task_id: string | null
          amount: number
          details: Json
          status: string
          cash_direction: string | null
          corrects: string | null
          created_by: string | null
          created_at: string
          confirmed_at: string | null
          voided_by: string | null
        }
        Insert: {
          id?: string
          reference: string
          kind: string
          owner_id: string
          title: string
          source_key: string
          customer_order_id?: string | null
          store_order_id?: string | null
          task_id?: string | null
          amount: number
          details?: Json
          status?: string
          cash_direction?: string | null
          corrects?: string | null
          created_by?: string | null
          created_at?: string
          confirmed_at?: string | null
          voided_by?: string | null
        }
        Update: {
          id?: string
          reference?: string
          kind?: string
          owner_id?: string
          title?: string
          source_key?: string
          customer_order_id?: string | null
          store_order_id?: string | null
          task_id?: string | null
          amount?: number
          details?: Json
          status?: string
          cash_direction?: string | null
          corrects?: string | null
          created_by?: string | null
          created_at?: string
          confirmed_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      money_salary_periods: {
        Row: {
          driver_id: string
          period: string
          invoice_id: string
        }
        Insert: {
          driver_id: string
          period: string
          invoice_id: string
        }
        Update: {
          driver_id?: string
          period?: string
          invoice_id?: string
        }
        Relationships: []
      }
      order_pricing_current: {
        Row: {
          customer_order_id: string
          version: number
          active_store_count: number
          items_amount: number
          delivery_fee: number
          total: number
          review_required: boolean
          updated_at: string
        }
        Insert: {
          customer_order_id: string
          version: number
          active_store_count: number
          items_amount: number
          delivery_fee: number
          total: number
          review_required?: boolean
          updated_at?: string
        }
        Update: {
          customer_order_id?: string
          version?: number
          active_store_count?: number
          items_amount?: number
          delivery_fee?: number
          total?: number
          review_required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      order_pricing_revisions: {
        Row: {
          id: string
          customer_order_id: string
          version: number
          source_store_order_id: string | null
          before_amounts: Json
          proposed_amounts: Json
          applied: boolean
          reason: string
          actor_id: string
          recorded_at: string
        }
        Insert: {
          id?: string
          customer_order_id: string
          version: number
          source_store_order_id?: string | null
          before_amounts: Json
          proposed_amounts: Json
          applied: boolean
          reason: string
          actor_id: string
          recorded_at?: string
        }
        Update: {
          id?: string
          customer_order_id?: string
          version?: number
          source_store_order_id?: string | null
          before_amounts?: Json
          proposed_amounts?: Json
          applied?: boolean
          reason?: string
          actor_id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      order_pricing_snapshots: {
        Row: {
          customer_order_id: string
          zone_id: string
          zone_name: string
          base_fee: number
          additional_store_fee: number
          original_store_count: number
          original_items_amount: number
          original_delivery_fee: number
          approved_total: number
          zone_version: number
          policy_version: string
          decided_at: string
        }
        Insert: {
          customer_order_id: string
          zone_id: string
          zone_name: string
          base_fee: number
          additional_store_fee: number
          original_store_count: number
          original_items_amount: number
          original_delivery_fee: number
          approved_total: number
          zone_version: number
          policy_version?: string
          decided_at?: string
        }
        Update: {
          customer_order_id?: string
          zone_id?: string
          zone_name?: string
          base_fee?: number
          additional_store_fee?: number
          original_store_count?: number
          original_items_amount?: number
          original_delivery_fee?: number
          approved_total?: number
          zone_version?: number
          policy_version?: string
          decided_at?: string
        }
        Relationships: []
      }
      customer_home_ads: {
        Row: {
          id: string
          title: string
          body: string
          advertiser: string
          admin_note: string
          target_kind: "store" | "product" | "offer"
          target_id: string
          media_kind: "image" | "video"
          media_path: string
          thumbnail_path: string | null
          starts_at: string
          ends_at: string
          is_active: boolean
          priority: number
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["customer_home_ads"]["Row"], "updated_at" | "thumbnail_path"> & { thumbnail_path?: string | null }
        Update: Partial<Database["public"]["Tables"]["customer_home_ads"]["Insert"]>
        Relationships: []
      }
      store_branding_assets: {
        Row: {
          id: string
          store_id: string
          kind: string
          storage_path: string
          mime_type: string
          byte_size: number
          state: string
          is_current: boolean
          storage_object_id: string | null
          storage_updated_at: string | null
          created_at: string
          retired_at: string | null
        }
        Insert: {
          id: string
          store_id: string
          kind: string
          storage_path: string
          mime_type: string
          byte_size: number
          state?: string
          is_current?: boolean
          storage_object_id?: string | null
          storage_updated_at?: string | null
          created_at?: string
          retired_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          kind?: string
          storage_path?: string
          mime_type?: string
          byte_size?: number
          state?: string
          is_current?: boolean
          storage_object_id?: string | null
          storage_updated_at?: string | null
          created_at?: string
          retired_at?: string | null
        }
        Relationships: []
      }

      // Local cutover migration contract; not generated from a hosted database.

      // Local cutover migration contract; not generated from a hosted database.
}
    Views: {
      selectable_catalog_categories: {
        Row: Pick<Database["public"]["Tables"]["catalog_categories"]["Row"], "id" | "scope" | "parent_id" | "name" | "slug" | "sort_order">
        Relationships: []
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
      read_customer_home_discovery: { Args: { seed_value: string }; Returns: Json };
      read_customer_home_ads: { Args: Record<never, never>; Returns: {
        id: string; title: string; body: string; target_kind: "store" | "product" | "offer";
        target_id: string; media_kind: "image" | "video"; media_path: string; ends_at: string; thumbnail_path: string | null;
      }[] };
      // Local onboarding migration contract; regenerate from the deployed schema after application.
      get_signup_capabilities: { Args: Record<PropertyKey, never>; Returns: number }
      submit_professional_onboarding: { Args: { input_application: Json; input_birth_date: string }; Returns: string }
      require_review_customer: {
        Args: never
        Returns: string
      }
      store_accepts_new_orders: {
        Args: {
          target_store: string
        }
        Returns: boolean
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
      search_driver_task_references: {
        Args: { search_value: string; view_value: string; page_offset: number; page_size: number }
        Returns: { task_id: string; reference: string }[]
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
    },
  },
} as const
