-- Ensure the merchant catalog media bucket exists, including on databases
-- where the catalog migration was previously applied but the bucket is absent.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-media',
  'store-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
