import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProjectContext } from '../types';
export default function Step2Script({ project, onNext, onBack }: { project: ProjectContext; onNext: () => void; onBack: () => void }) {
  const [title, setTitle] = useState(project.topic);
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scenes, setScenes] = useState([{ description: '', duration_seconds: 8 }]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.projects.get(project.projectId).then(data => {
      if (!active) return;
      if (data.script) { setTitle(data.script.title); setHook(data.script.hook); setBody(data.script.body); setCta(data.script.cta); }
      if (data.scenes.length) setScenes(data.scenes.map(s => ({ description: s.description, duration_seconds: s.duration_seconds })));
      if (data.metadata) { setDescription(data.metadata.description); setHashtags(data.metadata.hashtags.join(' ')); }
    }).catch(e => { if(active) setError(e.message); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [project.projectId]);
  return <form className="manual-panel" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.manual.saveScript(project.projectId, { title, hook, body, cta, description, hashtags, scenes }); onNext(); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao salvar'); } finally { setBusy(false); }
  }}>
    <p>Etapa 2 de 5</p><h2>Seu roteiro</h2>
    {loading ? <p>Carregando...</p> : <fieldset disabled={busy}>
    <label>Título<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>Gancho (opcional)<textarea value={hook} onChange={e => setHook(e.target.value)} /></label>
    <label>Roteiro completo<textarea required rows={6} value={body} onChange={e => setBody(e.target.value)} /></label>
    <label>Encerramento (opcional)<textarea value={cta} onChange={e => setCta(e.target.value)} /></label>
    <h3>Cenas</h3><p>Informe o trecho de cada cena e sua duração. Ao alterar uma cena, a imagem da mesma posição é preservada. Confira se ainda corresponde ao texto.</p>
    {scenes.map((scene, i) => <div className="manual-scene" key={i}>
      <label>Cena {i + 1}<textarea required value={scene.description} onChange={e => setScenes(s => s.map((x,j) => j === i ? { ...x, description: e.target.value } : x))} /></label>
      <label>Duração (segundos)<input type="number" min={1} max={300} step={1} required value={scene.duration_seconds} onChange={e => setScenes(s => s.map((x,j) => j === i ? { ...x, duration_seconds: Number(e.target.value) } : x))} /></label>
      {i === scenes.length - 1 && scenes.length > 1 && <button type="button" onClick={() => setScenes(s => s.slice(0,-1))}>Remover última cena</button>}
    </div>)}
    <button type="button" disabled={scenes.length >= 50} onClick={() => setScenes(s => [...s, { description: '', duration_seconds: 8 }])}>Adicionar cena</button>
    <label>Descrição para publicação<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Hashtags<input value={hashtags} onChange={e => setHashtags(e.target.value)} /></label>
    <p>Salvar alterações exige renderizar o vídeo novamente. Se mudar o texto narrado, envie também um áudio atualizado.</p>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
    <div className="manual-actions"><button type="button" disabled={busy} onClick={onBack}>Voltar</button><button disabled={loading || busy || !!error && !body}>{busy ? 'Salvando...' : 'Salvar e adicionar mídia'}</button></div>
  </form>;
}
