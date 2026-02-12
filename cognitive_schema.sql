-- Table: ai_state
CREATE TABLE public.ai_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    age_level integer DEFAULT 1,
    intelligence_score float DEFAULT 0.1,
    confidence_score float DEFAULT 0.1,
    independence_score float DEFAULT 0.1,
    learning_speed float DEFAULT 0.05,
    last_evolution timestamp with time zone DEFAULT now()
);

-- Table: user_model
CREATE TABLE public.user_model (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    decisiveness_score float DEFAULT 0.5,
    creativity_score float DEFAULT 0.5,
    risk_tolerance float DEFAULT 0.5,
    consistency_score float DEFAULT 0.5,
    emotional_variability float DEFAULT 0.5,
    last_updated timestamp with time zone DEFAULT now()
);

-- Table: event_log
CREATE TABLE public.event_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    related_message text,
    inferred_pattern text,
    impact_score float,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read ai_state" ON public.ai_state FOR SELECT USING (true);
CREATE POLICY "Public read user_model" ON public.user_model FOR SELECT USING (true);
CREATE POLICY "Public read event_log" ON public.event_log FOR SELECT USING (true);

CREATE POLICY "Authenticated update ai_state" ON public.ai_state FOR ALL USING (true);
CREATE POLICY "Authenticated update user_model" ON public.user_model FOR ALL USING (true);
CREATE POLICY "Authenticated insert event_log" ON public.event_log FOR INSERT WITH CHECK (true);

-- Initial Data for AI State
INSERT INTO public.ai_state (age_level, intelligence_score, confidence_score, independence_score, learning_speed)
VALUES (1, 0.1, 0.1, 0.1, 0.05);

-- Initial Data for User Model
INSERT INTO public.user_model (decisiveness_score, creativity_score, risk_tolerance, consistency_score, emotional_variability)
VALUES (0.5, 0.5, 0.5, 0.5, 0.5);
