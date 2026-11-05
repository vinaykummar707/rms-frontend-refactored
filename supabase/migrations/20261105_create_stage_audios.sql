-- ============================================================================
-- Migration: Create stage-audios Storage Bucket, stage_audios Table & RLS
-- Target: Supabase PostgreSQL Database & Storage
-- Description:
--   Manages transit stage announcement clips ('current_stop', 'next_stop', 'arriving_stop')
--   across all supported Edge-TTS languages.
-- ============================================================================

-- 1. Dedicated Supabase Storage Bucket ('stage-audios')
INSERT INTO storage.buckets (id, name, public)
VALUES ('stage-audios', 'stage-audios', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop prior storage policies if any
DROP POLICY IF EXISTS "Public read for stage-audios bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to stage-audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update stage-audios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from stage-audios" ON storage.objects;

-- Storage Policies for 'stage-audios' bucket
CREATE POLICY "Public read for stage-audios bucket"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'stage-audios');

CREATE POLICY "Authenticated users can upload to stage-audios"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'stage-audios');

CREATE POLICY "Authenticated users can update stage-audios"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'stage-audios')
    WITH CHECK (bucket_id = 'stage-audios');

CREATE POLICY "Authenticated users can delete from stage-audios"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'stage-audios');

-- 2. Create stage_audios Table
CREATE TABLE IF NOT EXISTS public.stage_audios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(20) NOT NULL,              -- e.g. 'en-IN', 'kn-IN', 'hi-IN'
    stage_type VARCHAR(30) NOT NULL,            -- 'current_stop' | 'next_stop' | 'arriving_stop'
    stage_label VARCHAR(60) NOT NULL,           -- e.g. 'Next Stop Is', 'Current Stop Is'
    reference_text TEXT NOT NULL,               -- Identification title / slug
    announcement_text TEXT NOT NULL,            -- Spoken speech text synthesized via Edge-TTS
    file_name TEXT NOT NULL,                    -- File name with stage & language prefix
    file_size BIGINT NOT NULL DEFAULT 0,
    file_format VARCHAR(20) NOT NULL DEFAULT 'audio/mpeg',
    url TEXT NOT NULL,                          -- Public streaming URL
    storage_path TEXT NOT NULL,                 -- e.g. 'en-IN/next_stop-1730868200.mp3'
    voice VARCHAR(50) DEFAULT 'en-IN-NeerjaNeural',
    speed VARCHAR(10) DEFAULT '-4%',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Duplicate Validation: Strict Unique Constraint per (language, stage_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_audios_lang_stage_unique 
    ON public.stage_audios (lower(trim(language)), lower(trim(stage_type)));

CREATE INDEX IF NOT EXISTS idx_stage_audios_language 
    ON public.stage_audios (language);

CREATE INDEX IF NOT EXISTS idx_stage_audios_stage_type 
    ON public.stage_audios (stage_type);

-- 4. Automatic updated_at Trigger
CREATE OR REPLACE FUNCTION public.handle_stage_audios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stage_audios_updated_at ON public.stage_audios;
CREATE TRIGGER trigger_stage_audios_updated_at
    BEFORE UPDATE ON public.stage_audios
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_stage_audios_updated_at();

-- 5. Row Level Security (RLS) for public.stage_audios
ALTER TABLE public.stage_audios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stage audios" ON public.stage_audios;
DROP POLICY IF EXISTS "Authenticated users can insert stage audios" ON public.stage_audios;
DROP POLICY IF EXISTS "Authenticated users can update stage audios" ON public.stage_audios;
DROP POLICY IF EXISTS "Authenticated users can delete stage audios" ON public.stage_audios;

CREATE POLICY "Authenticated users can read stage audios"
    ON public.stage_audios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stage audios"
    ON public.stage_audios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update stage audios"
    ON public.stage_audios FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete stage audios"
    ON public.stage_audios FOR DELETE TO authenticated USING (true);

