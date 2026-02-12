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
