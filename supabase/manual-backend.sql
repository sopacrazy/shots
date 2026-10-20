-- Execute após schema.sql, inclusive em bancos já existentes.
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT '#7B61FF',
  default_voice_id TEXT,
  default_language TEXT DEFAULT 'pt',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE folders ADD COLUMN IF NOT EXISTS default_voice_id TEXT;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS default_language TEXT DEFAULT 'pt';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id);

-- Um único commit preserva cenas por posição e invalida o vídeo anterior.
CREATE OR REPLACE FUNCTION save_manual_script(p_project_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE scene JSONB; total INTEGER; current_status TEXT;
BEGIN
  SELECT status INTO current_status FROM projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF current_status = 'rendering' THEN RAISE EXCEPTION 'Aguarde a renderização terminar'; END IF;
  SELECT sum((s->>'duration_seconds')::numeric)::integer INTO total FROM jsonb_array_elements(p_payload->'scenes') s;
  INSERT INTO scripts(project_id,title,hook,body,cta,duration_seconds,voice_tone,narration_speed)
    VALUES(p_project_id,p_payload->>'title',p_payload->>'hook',p_payload->>'body',p_payload->>'cta',total,'manual','manual')
    ON CONFLICT(project_id) DO UPDATE SET title=excluded.title,hook=excluded.hook,body=excluded.body,cta=excluded.cta,duration_seconds=excluded.duration_seconds;
  FOR scene IN SELECT * FROM jsonb_array_elements(p_payload->'scenes') LOOP
    INSERT INTO scenes(project_id,scene_number,description,image_prompt,duration_seconds)
      VALUES(p_project_id,(scene->>'scene_number')::integer,scene->>'description','',(scene->>'duration_seconds')::integer)
      ON CONFLICT(project_id,scene_number) DO UPDATE SET description=excluded.description,duration_seconds=excluded.duration_seconds;
  END LOOP;
  DELETE FROM scenes WHERE project_id=p_project_id AND scene_number > jsonb_array_length(p_payload->'scenes');
  INSERT INTO export_metadata(project_id,video_title,description,hashtags)
    VALUES(p_project_id,p_payload->>'title',p_payload->>'description',ARRAY(SELECT jsonb_array_elements_text(p_payload->'hashtags')))
    ON CONFLICT(project_id) DO UPDATE SET video_title=excluded.video_title,description=excluded.description,hashtags=excluded.hashtags,video_url=NULL;
  UPDATE projects SET title=p_payload->>'title',status='script_ready' WHERE id=p_project_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION save_manual_script(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_manual_script(UUID, JSONB) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES ('audio','audio',true,26214400),('videos','videos',true,262144000)
ON CONFLICT(id) DO NOTHING;
