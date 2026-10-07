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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
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
      customer_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cart_store_notes: {
        Row: {
          cart_id: string
          note: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cart_id: string
          note?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cart_id?: string
          note?: string
          store_id?: string
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
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_carts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
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
          currency: Database["public"]["Enums"]["currency_code"]
          customer_order_id: string
          delivery_fee: number
          items_subtotal: number
          total: number
        }
        Insert: {
          currency: Database["public"]["Enums"]["currency_code"]
          customer_order_id: string
          delivery_fee?: number
          items_subtotal: number
          total: number
        }
        Update: {
          currency?: Database["public"]["Enums"]["currency_code"]
          customer_order_id?: string
          delivery_fee?: number
          items_subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_totals_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          contact_phone: string
          created_at: string
          customer_id: string
          customer_note: string
          delivery_address: string
          delivery_currency: Database["public"]["Enums"]["currency_code"]
          delivery_fee: number
          delivery_zone_id: string | null
          delivery_zone_name_snapshot: string
          id: string
          order_number: number
          payment_method: string
          recipient_name: string
          status: Database["public"]["Enums"]["customer_order_status"]
          updated_at: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          customer_id: string
          customer_note?: string
          delivery_address: string
          delivery_currency?: Database["public"]["Enums"]["currency_code"]
          delivery_fee: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot: string
          id?: string
          order_number?: never
          payment_method?: string
          recipient_name: string
          status?: Database["public"]["Enums"]["customer_order_status"]
          updated_at?: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          customer_id?: string
          customer_note?: string
          delivery_address?: string
          delivery_currency?: Database["public"]["Enums"]["currency_code"]
          delivery_fee?: number
          delivery_zone_id?: string | null
          delivery_zone_name_snapshot?: string
          id?: string
          order_number?: never
          payment_method?: string
          recipient_name?: string
          status?: Database["public"]["Enums"]["customer_order_status"]
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
          accepted_at: string | null
          created_at: string
          customer_order_id: string
          delivered_at: string | null
          driver_id: string | null
          id: string
          picked_up_at: string | null
          status: Database["public"]["Enums"]["delivery_task_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_order_id: string
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          picked_up_at?: string | null
          status?: Database["public"]["Enums"]["delivery_task_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_order_id?: string
          delivered_at?: string | null
          driver_id?: string | null
          id?: string
          picked_up_at?: string | null
          status?: Database["public"]["Enums"]["delivery_task_status"]
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
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          fixed_fee: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          fixed_fee: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          fixed_fee?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          available_hours: Json
          contact_phone: string
          contract_duration_months: number
          created_at: string
          full_name: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          available_hours: Json
          contact_phone: string
          contract_duration_months: number
          created_at?: string
          full_name: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
          vehicle_type: string
        }
        Update: {
          available_hours?: Json
          contact_phone?: string
          contract_duration_months?: number
          created_at?: string
          full_name?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
          vehicle_type?: string
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
          category_id: string
          contact_phone: string
          created_at: string
          id: string
          plan_currency_snapshot: Database["public"]["Enums"]["currency_code"]
          plan_duration_months_snapshot: number
          plan_id: string
          plan_name_snapshot: string
          plan_price_snapshot: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          store_address: string
          store_description: string
          store_name: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          contact_phone: string
          created_at?: string
          id?: string
          plan_currency_snapshot: Database["public"]["Enums"]["currency_code"]
          plan_duration_months_snapshot: number
          plan_id: string
          plan_name_snapshot: string
          plan_price_snapshot: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_address: string
          store_description?: string
          store_name: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          contact_phone?: string
          created_at?: string
          id?: string
          plan_currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          plan_duration_months_snapshot?: number
          plan_id?: string
          plan_name_snapshot?: string
          plan_price_snapshot?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_address?: string
          store_description?: string
          store_name?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          currency_snapshot: Database["public"]["Enums"]["currency_code"]
          duration_months: number
          expires_at: string
          id: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          price_snapshot: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          currency_snapshot: Database["public"]["Enums"]["currency_code"]
          duration_months: number
          expires_at: string
          id?: string
          merchant_id: string
          plan_id: string
          plan_name_snapshot: string
          price_snapshot: number
          starts_at?: string
        }
        Update: {
          created_at?: string
          currency_snapshot?: Database["public"]["Enums"]["currency_code"]
          duration_months?: number
          expires_at?: string
          id?: string
          merchant_id?: string
          plan_id?: string
          plan_name_snapshot?: string
          price_snapshot?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
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
          contact_phone: string
          created_at: string
          id: string
          owner_user_id: string
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          contact_phone: string
          created_at?: string
          id?: string
          owner_user_id: string
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          contact_phone?: string
          created_at?: string
          id?: string
          owner_user_id?: string
          status?: Database["public"]["Enums"]["application_status"]
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
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
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
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_media: {
        Row: {
          alt_text: string
          created_at: string
          display_order: number
          id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          product_id: string
          storage_path: string
          store_id: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          product_id: string
          storage_path: string
          store_id: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          media_type?: Database["public"]["Enums"]["store_media_type"]
          product_id?: string
          storage_path?: string
          store_id?: string
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
          category_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          id: string
          is_available: boolean
          minimum_quantity: number
          price: number
          quantity_step: number
          selling_unit: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          id?: string
          is_available?: boolean
          minimum_quantity?: number
          price: number
          quantity_step?: number
          selling_unit?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          id?: string
          is_available?: boolean
          minimum_quantity?: number
          price?: number
          quantity_step?: number
          selling_unit?: string
          store_id?: string
          title?: string
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
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["account_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Relationships: []
      }
      store_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      store_offer_media: {
        Row: {
          alt_text: string
          created_at: string
          display_order: number
          id: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          offer_id: string
          storage_path: string
          store_id: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          media_type: Database["public"]["Enums"]["store_media_type"]
          offer_id: string
          storage_path: string
          store_id: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: string
          media_type?: Database["public"]["Enums"]["store_media_type"]
          offer_id?: string
          storage_path?: string
          store_id?: string
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
          item_role: Database["public"]["Enums"]["offer_product_role"]
          offer_id: string
          product_id: string
          quantity: number
          store_id: string
        }
        Insert: {
          id?: string
          item_role: Database["public"]["Enums"]["offer_product_role"]
          offer_id: string
          product_id: string
          quantity: number
          store_id: string
        }
        Update: {
          id?: string
          item_role?: Database["public"]["Enums"]["offer_product_role"]
          offer_id?: string
          product_id?: string
          quantity?: number
          store_id?: string
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
          bundle_price: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          discount_method:
            | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value: number | null
          ends_at: string | null
          id: string
          is_active: boolean
          offer_type: Database["public"]["Enums"]["store_offer_type"]
          starts_at: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          bundle_price?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          discount_method?:
            | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          offer_type: Database["public"]["Enums"]["store_offer_type"]
          starts_at?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          bundle_price?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          discount_method?:
            | Database["public"]["Enums"]["offer_discount_method"]
            | null
          discount_value?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          offer_type?: Database["public"]["Enums"]["store_offer_type"]
          starts_at?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          line_total: number
          product_id: string | null
          product_title_snapshot: string
          quantity: number
          selling_unit_snapshot: string
          store_order_id: string
          unit_price_snapshot: number
        }
        Insert: {
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          line_total: number
          product_id?: string | null
          product_title_snapshot: string
          quantity: number
          selling_unit_snapshot: string
          store_order_id: string
          unit_price_snapshot: number
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          line_total?: number
          product_id?: string | null
          product_title_snapshot?: string
          quantity?: number
          selling_unit_snapshot?: string
          store_order_id?: string
          unit_price_snapshot?: number
        }
        Relationships: [
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
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["store_order_status"] | null
          id: number
          note: string
          store_order_id: string
          to_status: Database["public"]["Enums"]["store_order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["store_order_status"] | null
          id?: never
          note?: string
          store_order_id: string
          to_status: Database["public"]["Enums"]["store_order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["store_order_status"] | null
          id?: never
          note?: string
          store_order_id?: string
          to_status?: Database["public"]["Enums"]["store_order_status"]
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
          currency: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
          store_order_id: string
        }
        Insert: {
          currency: Database["public"]["Enums"]["currency_code"]
          items_subtotal: number
          store_order_id: string
        }
        Update: {
          currency?: Database["public"]["Enums"]["currency_code"]
          items_subtotal?: number
          store_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_totals_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          created_at: string
          customer_note: string
          customer_order_id: string
          delivered_at: string | null
          id: string
          ready_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["store_order_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_note?: string
          customer_order_id: string
          delivered_at?: string | null
          id?: string
          ready_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["store_order_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_note?: string
          customer_order_id?: string
          delivered_at?: string | null
          id?: string
          ready_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["store_order_status"]
          store_id?: string
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
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          category_id: string
          created_at: string
          description: string
          id: string
          merchant_id: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          address: string
          category_id: string
          created_at?: string
          description?: string
          id?: string
          merchant_id: string
          name: string
          phone: string
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          address?: string
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          merchant_id?: string
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["application_status"]
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
      subscription_plans: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          duration_months: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          duration_months: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          direction: Database["public"]["Enums"]["wallet_direction"]
          id: string
          note: string
          recorded_by: string
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          direction: Database["public"]["Enums"]["wallet_direction"]
          id?: string
          note?: string
          recorded_by: string
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          direction?: Database["public"]["Enums"]["wallet_direction"]
          id?: string
          note?: string
          recorded_by?: string
          transaction_type?: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id?: string
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
            foreignKeyName: "wallet_transactions_user_id_currency_fkey"
            columns: ["user_id", "currency"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["user_id", "currency"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      delete_store_offer: { Args: { target_offer: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_approved_driver: { Args: never; Returns: boolean }
      is_store_owner: { Args: { target_store: string }; Returns: boolean }
      record_wallet_transaction: {
        Args: {
          operation: Database["public"]["Enums"]["wallet_transaction_type"]
          operation_amount: number
          operation_direction: Database["public"]["Enums"]["wallet_direction"]
          operation_note?: string
          target_currency: Database["public"]["Enums"]["currency_code"]
          target_user: string
        }
        Returns: string
      }
      refresh_customer_order_status: {
        Args: { target_order: string }
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
          input_bundle_price: number
          input_currency: Database["public"]["Enums"]["currency_code"]
          input_description: string
          input_discount_method: Database["public"]["Enums"]["offer_discount_method"]
          input_discount_value: number
          input_ends_at: string
          input_is_active: boolean
          input_items: Json
          input_title: string
          input_type: Database["public"]["Enums"]["store_offer_type"]
          selected_offer: string
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
    }
    Enums: {
      account_role: "customer" | "merchant" | "driver" | "admin"
      application_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "changes_requested"
      currency_code: "SYP" | "USD"
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
      currency_code: ["SYP", "USD"],
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
