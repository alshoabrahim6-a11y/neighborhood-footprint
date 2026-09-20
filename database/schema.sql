-- ============================================================================
--  بصمة الحي (Neighborhood Footprint) — قاعدة البيانات
-- ============================================================================
-- هاد الملف بتشغّله مرة وحدة بس، جوا مشروع Supabase تبعك:
--   1) افتح مشروعك على supabase.com
--   2) من القائمة الجانبية: SQL Editor
--   3) اعمل New query، الصق كل محتوى هاد الملف، واضغط Run
--
-- الملف بيعمل: جدولين (neighborhoods و reports) + صلاحيات أمان بسيطة (RLS)
-- ============================================================================

-- تفعيل إضافة uuid (عشان نقدر نولّد id عشوائي وفريد لكل صف)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) جدول الأحياء (neighborhoods)
--    كل حي إله "نقاط بيئية" (eco_points) بتبدأ 100 وبتنزل كل ما انبلّغ عن
--    تلوث فيه، وبترجع تزيد تدريجيًا لما ما يكون في بلاغات جديدة.
-- ----------------------------------------------------------------------------
create table if not exists neighborhoods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- اسم الحي، لازم يكون فريد
  eco_points    numeric not null default 100,  -- من 0 لـ 100
  last_report_at timestamptz,                  -- آخر مرة انبلّغ فيها عن تلوث بهاد الحي
  created_at    timestamptz not null default now()
);

comment on table neighborhoods is 'الأحياء ونقاطها البيئية (eco score من 0 إلى 100)';

-- بذرة أولية: بضع أحياء تجريبية عشان تقدر تجرب النظام فورًا.
-- غيّر هاي الأسماء لأحياء حقيقية بمنطقتك وقت العرض.
insert into neighborhoods (name) values
  ('حي النزهة'),
  ('حي الزهور'),
  ('حي الأمل')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 2) جدول البلاغات (reports)
--    كل صف = بلاغ تلوث واحد رفعه مستخدم: صورة + موقع + نوع التلوث (من AI)
-- ----------------------------------------------------------------------------
create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  neighborhood_id  uuid references neighborhoods(id) on delete set null,
  image_url        text not null,               -- رابط الصورة على Supabase Storage
  latitude         double precision not null,
  longitude        double precision not null,
  pollution_type   text not null default 'unknown', -- النوع اللي حدده الذكاء الاصطناعي
  ai_confidence    numeric,                      -- درجة ثقة الذكاء الاصطناعي (0 إلى 1)
  ai_raw_labels    jsonb,                        -- كل نتائج التصنيف (لأغراض الشفافية/التقرير)
  description      text,                         -- ملاحظة اختيارية من المستخدم
  status           text not null default 'pending', -- pending / reviewed (للمستقبل)
  user_id          uuid references auth.users(id) on delete set null, -- صاحب البلاغ (لو كان مسجّل دخول وقتها)
  user_email       text,                         -- نسخة من الإيميل وقت الإرسال (أسهل للعرض بدون join)
  created_at       timestamptz not null default now()
);

comment on table reports is 'بلاغات التلوث المرفوعة من المستخدمين';

-- فهرسة (index) عشان الاستعلامات اللي بتجيب البلاغات حسب الحي أو التاريخ تكون أسرع
create index if not exists idx_reports_neighborhood on reports(neighborhood_id);
create index if not exists idx_reports_created_at on reports(created_at desc);

-- ----------------------------------------------------------------------------
-- 3) صلاحيات الأمان (Row Level Security)
--    السيرفر تبعنا (Express backend) بيتوصل بقاعدة البيانات بمفتاح خاص
--    (service role key) وهاد المفتاح بتخطى كل هاي القواعد تلقائيًا.
--    القواعد تحت هي حماية إضافية بس، تمنع أي حدا يوصل مباشرة لقاعدة البيانات
--    من المتصفح بمفتاح public (anon key) من قراءة/تعديل شي مش المفروض.
-- ----------------------------------------------------------------------------
alter table neighborhoods enable row level security;
alter table reports enable row level security;

-- القراءة العامة مسموحة لعرض الخريطة ولوحة النقاط لأي زائر
drop policy if exists "public read neighborhoods" on neighborhoods;
create policy "public read neighborhoods" on neighborhoods
  for select using (true);

drop policy if exists "public read reports" on reports;
create policy "public read reports" on reports
  for select using (true);

-- ما في أي INSERT/UPDATE/DELETE مسموح من anon key — كل الكتابة بتصير
-- فقط من طريق السيرفر تبعنا (اللي بيستخدم service role key ويتخطى RLS).

-- ----------------------------------------------------------------------------
-- 4) جدول الأدمنية (admins) — لوحة الإدارة
--    أي حساب (user_id) موجود بهاد الجدول يقدر يفتح لوحة الإدارة ويوافق/
--    يرفض البلاغات. الإضافة بتصير من سكريبت backend/scripts/make-admin.js،
--    مش يدويًا من هون عادة.
-- ----------------------------------------------------------------------------
create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- ما في أي policy عامة هون بقصد — بس السيرفر الخلفي (service role) يقدر
-- يقرأ هاد الجدول، وهاد بالضبط يلي بدنا ياه (حتى الفرونت إند ما يقدر
-- يوصله مباشرة بأي حال).

-- الموافقة تلقائيًا على أي بلاغات قديمة كانت موجودة قبل تفعيل ميزة لوحة
-- الإدارة، عشان ما تختفي من الخريطة العامة فجأة.
update reports set status = 'approved' where status = 'pending';

-- ----------------------------------------------------------------------------
-- 5) جدول التقارير الدورية المحفوظة (report_snapshots) — التقارير الدورية
--    التلقائية: كل أسبوع (عبر node-cron بملف backend/server.js) بيتحسب
--    ملخص إحصائي للبلاغات وبينحفظ هون تلقائيًا، عشان يضل عندنا "أرشيف"
--    تاريخي حتى لو تغيّرت البيانات بعدين. الأدمن كمان يقدر يولّد تقرير
--    فوري يدويًا بدون ما ينتظر الموعد الأسبوعي.
-- ----------------------------------------------------------------------------
create table if not exists report_snapshots (
  id            uuid primary key default gen_random_uuid(),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  total_reports integer not null default 0,
  summary       jsonb not null,   -- كل تفاصيل التقرير (توزيع حسب الحي/النوع، المقارنة...)
  created_at    timestamptz not null default now()
);

alter table report_snapshots enable row level security;
-- ما في policy عامة هون بقصد — بس السيرفر الخلفي (service role) يقدر يوصله.

-- ============================================================================
-- خلصنا! رجع عالتطبيق واستمر بخطوات ملف README.md
-- ============================================================================
