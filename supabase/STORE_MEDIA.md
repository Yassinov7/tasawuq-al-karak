# Store media: native Database + Storage

Pending migration: migrations/20261102000100_store_branding.sql. Owner confirmed it has not been applied. No remote inspection or application was performed. It intentionally fails if the table/buckets already exist.

Separate store_branding_assets rows preserve immutable per-attempt paths and previous versions without altering stores/products. Two private buckets: store-logos (JPEG/PNG/WebP, 4 MiB); store-videos (MP4, 50 MiB). There is no decoder, Edge Function, WASM, worker or additional service. No pixel/duration/codec/security-scan guarantee. Storage enforces upload byte limits and allowed MIME; MIME is not proof of file content. Client signature checks only reject obvious mismatches and can be bypassed by a custom client. No dimension/duration limit is claimed. Project-wide Storage limits also apply.

Use registerBranding -> uploadBranding -> publishBranding. Fixed owner-scoped attempt ID is persisted; uncertain upload is never blindly overwritten/reuploaded. Publish reads Storage metadata, locks the store, compares expected-current ID, and atomically retires the predecessor. A failed upload/publication leaves the predecessor current. After a lost response read the same attempt. resumeBrandingAttempt restores it. unpublishBranding logically removes a current file or cancels a registered attempt; finishBrandingAttempt clears confirmed terminal local state. Retired files cannot be republished. Storage UPDATE/DELETE is denied to clients. Physical old/abandoned objects remain (storage usage); no cleanup service is installed. Administrative deletion, if ever needed, must follow reference review via Storage UI, never raw storage.objects DELETE. Signed URLs last 60 seconds for logos and 10 minutes for videos and are not persisted; previously issued URLs may remain usable until expiry.

## Dashboard-only deployment on the current main project

1. Verify the intended project name/reference in Dashboard. In SQL Editor inspect supabase_migrations.schema_migrations for version 20261102000100, to_regclass('public.store_branding_assets'), and storage.buckets for store-logos/store-videos. If anything already exists, stop; do not overwrite an applied migration.
2. Verify predecessor objects: public.stores(id,merchant_id), public.merchants(id,owner_user_id), public.is_admin(), public.store_accepts_new_orders(uuid). Their definitions are present in repository predecessors, but live compatibility has NOT been checked.
3. Paste the entire pending migration into SQL Editor and run once. It is transactional, contains explicit grants and restrictive policies, and changes no product/offer bucket. Dashboard execution does not automatically record a CLI migration version: retain the execution record and do not subsequently replay it with CLI blindly. No migration-history repair is included.
4. In Storage confirm both buckets remain private, MIME/size restrictions, and restrictive no-update/no-delete policies. Do not disable these policies or manually overwrite objects.
5. Run the rollback-only SQL in tests/store_branding_security.dashboard.sql after substituting your existing owner/store and a distinct ordinary user. It uses synthetic rows, not real file uploads. Review before running on the main project. RLS, RPC ownership, missing uploads, stale replacement, retirement and video metadata paths are covered. A single SQL session does not prove concurrent-session races.
6. Test through authenticated app/Storage requests using your own small files: logo and MP4 upload, size rejection, wrong-owner registration/read of draft, overwrite/upsert/copy/move/delete denial, failed replacement retaining predecessor, lost acknowledgement/reopening, two simultaneous publications with the same predecessor (one wins). No fake customer data is required. Do not treat SQL catalog fixtures as real Storage upload verification.
7. Generate/review types later from the applied schema; store-branding-contract.ts is explicitly provisional. No remote operation has been performed in this phase.

Local check: node scripts/test-store-branding.cjs. These are offline client/source assertions, not PostgreSQL/RLS/Storage execution proof.

### Read-only Dashboard preflight

```sql
select version from supabase_migrations.schema_migrations where version='20261102000100';
select to_regclass('public.store_branding_assets') as branding_table,
       to_regclass('public.stores') as stores, to_regclass('public.merchants') as merchants,
       to_regprocedure('public.is_admin()') as admin_helper,
       to_regprocedure('public.store_accepts_new_orders(uuid)') as eligibility_helper;
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id in ('store-logos','store-videos');
```

The migration version/table/buckets must be absent and all predecessor objects present. A missing migration-history table needs manual project-history review, not an assumption that nothing was applied.
