-- ============================================================
-- AstraShorts — Schema Supabase
-- Execute no SQL Editor do painel: https://supabase.com/dashboard
-- ============================================================

-- Habilitar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROJETOS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT,
  topic       TEXT        NOT NULL,
  niche       TEXT,
  status      TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN (
                  'draft','generating_script','script_ready',
                  'generating_narration','narration_ready',
                  'generating_images','images_ready',
                  'rendering','completed','error'
                )),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROTEIROS
-- ============================================================
CREATE TABLE IF NOT EXISTS scripts (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  hook              TEXT        NOT NULL,
  body              TEXT        NOT NULL,
  cta               TEXT        NOT NULL,
  duration_seconds  INTEGER     NOT NULL DEFAULT 45,
  voice_tone        TEXT        NOT NULL DEFAULT 'dramático e envolvente',
  narration_speed   TEXT        NOT NULL DEFAULT 'moderado',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id)
);

-- ============================================================
-- CENAS
-- ============================================================
CREATE TABLE IF NOT EXISTS scenes (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number      INTEGER     NOT NULL,
  description       TEXT        NOT NULL,
  image_prompt      TEXT        NOT NULL,
  image_url         TEXT,
  duration_seconds  INTEGER     NOT NULL DEFAULT 8,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, scene_number)
);

-- ============================================================
-- NARRAÇÕES (áudios gerados pelo ElevenLabs)
-- ============================================================
CREATE TABLE IF NOT EXISTS narrations (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audio_url         TEXT        NOT NULL,
  voice_id          TEXT        NOT NULL,
  script_text       TEXT        NOT NULL,
  duration_seconds  FLOAT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- METADADOS DE EXPORTAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS export_metadata (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  video_title   TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  hashtags      TEXT[]      NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  video_url     TEXT,
  end_card_url  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id)
);

-- Migração: se a tabela já existe, adicionar a coluna end_card_url
ALTER TABLE export_metadata ADD COLUMN IF NOT EXISTS end_card_url TEXT;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scripts_project    ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project     ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_narrations_project ON narrations(project_id);
CREATE INDEX IF NOT EXISTS idx_metadata_project   ON export_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created   ON projects(created_at DESC);

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE: buckets necessários
-- ============================================================
-- Execute no painel Storage → New bucket:
--   Nome: audio  → Public: SIM
--   Nome: videos → Public: SIM

-- ============================================================
-- RLS (Row Level Security) — desabilitado para começar
-- Habilite quando implementar autenticação de usuários
-- ============================================================
ALTER TABLE projects        DISABLE ROW LEVEL SECURITY;
ALTER TABLE scripts         DISABLE ROW LEVEL SECURITY;
ALTER TABLE scenes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE narrations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE export_metadata DISABLE ROW LEVEL SECURITY;
