import { useEffect, useState } from 'react';
import { api, type ApiScene } from '../lib/api';
import type { ProjectContext } from '../types';
export default function Step3Production({ project, onNext, onBack }: { project: ProjectContext; onNext: () => void; onBack: () => void }) {
  const [scenes, setScenes] = useState<ApiScene[]>([]);
  const [audio, setAudio] = useState('');
  const [endcard, setEndcard] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api.projects.get(project.projectId).then(d => { setScenes(d.scenes); setAudio((d.narration as { audio_url?: string })?.audio_url ?? ''); setEndcard(d.metadata?.end_card_url ?? ''); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [project.projectId]);
  const upload = async (file: File | undefined, kind: 'scene' | 'audio' | 'endcard', sceneId?: string) => {
    if (!file) return; setBusy(true); setError('');
    try {
      const data = await api.manual.file(file);
      if (kind === 'scene') { const s = await api.manual.image(project.projectId, sceneId!, data); setScenes(prev => prev.map(x => x.id === s.id ? s : x)); }
      if (kind === 'audio') { const n = await api.manual.audio(project.projectId, data); setAudio(n.audio_url); }
      if (kind === 'endcard') { const r = await api.manual.endcard(project.projectId, data); setEndcard(r.url); }
    } catch(e) { setError(e instanceof Error ? e.message : 'Falha no upload'); } finally { setBusy(false); }
  };
  return <section className="manual-panel"><p>Etapa 3 de 5</p><h2>Imagens e áudio</h2>
    <p>Use imagens PNG, JPEG ou WebP e áudio MP3 ou WAV. Limite de 25 MB por arquivo.</p>
    {loading && <p>Carregando...</p>}
    {scenes.map(s => <div key={s.id} className="manual-scene">
      <h3>Cena {s.scene_number} · {s.duration_seconds}s</h3><p>{s.description}</p>
      {s.image_url && <img className="manual-image" src={s.image_url} alt={`Cena ${s.scene_number}`} />}
      <label>Enviar imagem<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || loading} onChange={e => { void upload(e.target.files?.[0], 'scene', s.id); e.target.value = ''; }} /></label>
    </div>)}
    {!loading && !scenes.length && <p>Volte para escrever e salvar as cenas primeiro.</p>}
    <label>Narração (opcional)<input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" disabled={busy || loading || !scenes.length} onChange={e => { void upload(e.target.files?.[0], 'audio'); e.target.value = ''; }} /></label>
    {audio && <audio controls src={audio} />}
    <label>Cartão final (opcional, 5 segundos)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || loading || !scenes.length} onChange={e => { void upload(e.target.files?.[0], 'endcard'); e.target.value = ''; }} /></label>
    {endcard && <img className="manual-image" src={endcard} alt="Cartão final" />}
    {busy && <p role="status">Enviando arquivo...</p>}{error && <p role="alert">{error}</p>}
    <div className="manual-actions"><button disabled={busy} onClick={onBack}>Editar roteiro</button><button disabled={busy || loading || !scenes.length || scenes.some(s => !s.image_url)} onClick={onNext}>Avançar para renderização</button></div>
  </section>;
}
