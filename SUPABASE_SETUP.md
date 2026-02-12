# إعداد Supabase للمساعد الافتراضي الذكي

هذا المستند يوضح كيفية إعداد قاعدة بيانات Supabase وتفعيل Realtime لتشغيل المساعد الافتراضي الذكي.

## 1. إنشاء الجداول (SQL)

قم بتنفيذ أوامر SQL التالية في محرر SQL الخاص بـ Supabase (SQL Editor) لإنشاء الجداول المطلوبة:

```sql
-- Table: brain_memory
CREATE TABLE public.brain_memory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL, -- (writing_style / decision / rule / context)
    trigger_keywords text[],
    response text NOT NULL,
    weight integer,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.brain_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access" ON public.brain_memory FOR SELECT USING (true);
CREATE POLICY "Allow authenticated inserts" ON public.brain_memory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated updates" ON public.brain_memory FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated deletes" ON public.brain_memory FOR DELETE USING (auth.role() = 'authenticated');

-- Table: messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role text NOT NULL, -- (user / assistant)
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow authenticated inserts" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

## 2. تفعيل Realtime

لتفعيل Realtime على الجداول `brain_memory` و `messages`، اتبع الخطوات التالية في لوحة تحكم Supabase:

1.  انتقل إلى قسم **Database** في الشريط الجانبي الأيسر.
2.  اختر **Realtime**.
3.  في قسم **Tables to broadcast changes from**، قم بتمكين Realtime لكل من الجدولين:
    *   `brain_memory`
    *   `messages`

## 3. وضع مفاتيح Supabase (API Keys)

يجب وضع مفاتيح Supabase الخاصة بك في ملف `app.js`.

1.  في لوحة تحكم Supabase، انتقل إلى قسم **Project Settings** (رمز الترس).
2.  اختر **API**.
3.  ستجد `Project URL` و `anon public` (أو `public anon key`).
4.  افتح ملف `app.js` في مشروعك.
5.  استبدل القيم النائبة بالقيم الفعلية الخاصة بك:

    ```javascript
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // ضع Project URL هنا
    const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // ضع public anon key هنا

    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    ```

## 4. هيكل الملفات النهائي

بعد إتمام الخطوات، سيكون هيكل ملفات مشروعك كالتالي:

```
Ai-Mad3oom/
├── index.html
├── style.css
├── app.js
├── supabase_schema.sql
└── SUPABASE_SETUP.md
```
