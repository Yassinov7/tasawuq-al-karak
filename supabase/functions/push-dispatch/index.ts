import { createPushDispatcher } from "./handler.ts";

Deno.serve(createPushDispatcher({
 url:Deno.env.get("SUPABASE_URL")??"",
 serviceKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",
 dispatchSecret:Deno.env.get("PUSH_DISPATCH_SECRET")??"",
 expoAccessToken:Deno.env.get("EXPO_ACCESS_TOKEN"),
}));
