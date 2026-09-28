-- Initial category directory for the merchant catalog UI.
insert into public.categories (name, slug, sort_order)
values
  ('سوبرماركت', 'supermarkets', 10),
  ('خضار وفواكه', 'vegetables', 20),
  ('ملاحم', 'meat', 30),
  ('محامص', 'roastery', 40),
  ('مخابز', 'bakery', 50),
  ('قهوة ومشروبات', 'coffee', 60),
  ('عصائر وحلويات', 'juice', 70),
  ('مطاعم', 'restaurants', 80),
  ('صيدليات', 'pharmacy', 90),
  ('عناية وتجميل', 'cosmetics', 100),
  ('عطور', 'perfume', 110),
  ('ألبسة', 'clothing', 120),
  ('أحذية', 'shoes', 130),
  ('إلكترونيات', 'electronics', 140),
  ('منزل وأدوات', 'home', 150),
  ('عدد وأدوات', 'hardware', 160),
  ('قرطاسية', 'stationery', 170),
  ('كتب', 'books', 180),
  ('ورد وهدايا', 'flowers', 190),
  ('موبايلات', 'mobile', 200),
  ('سيارات', 'auto', 210),
  ('مغاسل', 'laundry', 220),
  ('مستلزمات الحيوانات', 'pets', 230),
  ('أطفال وأمومة', 'baby', 240)
on conflict (slug) do nothing;
