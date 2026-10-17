import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { Platform } from "react-native";

import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env.local.",
  );
}

const isWebServer = Platform.OS === "web" && typeof window === "undefined";

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      ...(isWebServer
        ? {
            autoRefreshToken: false,
            persistSession: false,
          }
        : {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
          }),
      detectSessionInUrl: false,
    },
  },
);
