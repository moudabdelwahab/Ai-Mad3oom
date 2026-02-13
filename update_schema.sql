-- 1. Update user_model to Personality Vector
ALTER TABLE public.user_model 
ADD COLUMN IF NOT EXISTS thinking_style text DEFAULT 'analytical', -- (analytical | intuitive)
ADD COLUMN IF NOT EXISTS risk_profile float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS execution_bias float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS control_drive float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS long_term_focus float DEFAULT 0.5,
-- Rename existing columns if they don't match the new naming (optional, but for consistency with request)
-- Keeping existing columns for backward compatibility if needed, or mapping them.
DROP COLUMN IF EXISTS creativity_score,
DROP COLUMN IF EXISTS risk_tolerance,
DROP COLUMN IF EXISTS emotional_variability;

-- 2. Update brain_memory for advanced features
ALTER TABLE public.brain_memory
ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fail_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used timestamp with time zone DEFAULT now(),
ALTER COLUMN weight TYPE float;

-- 3. Ensure ai_state is ready for evolveAI
-- Existing columns: age_level, intelligence_score, confidence_score, independence_score, learning_speed
-- No changes needed here based on the request, but ensure they exist.

-- 4. Enable RLS and Policies (Ensure they are updated for new columns if necessary)
-- Already handled in initial setup, but good to keep in mind.
