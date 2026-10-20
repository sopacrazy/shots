import { useState } from 'react';
import { api } from '../lib/api';
import type { ProjectContext, FolderDefaults } from '../types';
export default function Step1Topic({ onNext }: { onNext: (p: ProjectContext) => void; onAutoGenerate?: (p: ProjectContext) => void; folderContext?: FolderDefaults }) {
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="manual-panel" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { const p = await api.projects.create(topic.trim(), niche.trim()); onNext({ projectId: p.id, topic: p.topic, niche: p.niche ?? undefined }); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao criar projeto'); } finally { setBusy(false); }
  }}>
    <p>Etapa 1 de 5</p><h2>Novo vídeo</h2>
    <p>Escreva o tema. Nas próximas etapas, adicione seu roteiro, imagens e áudio.</p>
    <label>Tema<input required maxLength={200} value={topic} onChange={e => setTopic(e.target.value)} /></label>
    <label>Categoria (opcional)<input maxLength={100} value={niche} onChange={e => setNiche(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}<button disabled={busy || !topic.trim()}>{busy ? 'Criando...' : 'Criar projeto'}</button>
  </form>;
}
