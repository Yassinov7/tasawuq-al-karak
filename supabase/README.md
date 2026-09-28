# Supabase setup

This folder contains the local Supabase configuration and the initial PostgreSQL migration.

## Apply to a Supabase project

1. Install the Supabase CLI using the official method for your operating system.
2. From the Expo project root, run `supabase login` and `supabase link --project-ref <project-ref>`.
3. Review the linked project, then apply the migration with `supabase db push`.
4. In Supabase Auth settings, enable phone/password sign-in and configure an SMS provider if phone confirmation is enabled for production.
5. Create the first administrator by granting the `admin` role to a trusted profile in the SQL editor. Never expose the service role key in the Expo app.

The migration intentionally creates delivery zones as admin-managed data and leaves subscription plans unpublished at zero price until an administrator sets real prices. No exchange-rate or inventory tables are included.
