import { useEffect, useRef } from 'react';
import { ArrowUpRight, CalendarDays, ChevronRight, Clapperboard, Film, Images, LayoutDashboard, Library, MessageCircle, ShoppingBag, X } from 'lucide-react';

export const toolInfo = {
  overview: { label: 'Visão geral', group: 'Seu espaço', description: 'Tudo para criar, organizar e publicar seu conteúdo.' },
  videos: { label: 'Vídeos de produtos', group: 'Criar conteúdo', description: 'Escolha um vídeo, personalize sua marca e revise antes de publicar.' },
  photos: { label: 'Reels com fotos', group: 'Criar conteúdo', description: 'Transforme fotos de produtos em um vídeo com música e movimento.' },
  scenes: { label: 'Editor de cenas', group: 'Criar conteúdo', description: 'Crie um vídeo a partir de um tema, roteiro, imagens e narração.' },
  shopee: { label: 'Garimpo Shopee', group: 'Descobrir', description: 'Encontre produtos e prepare seu próximo conteúdo de afiliado.' },
  scheduler: { label: 'Agendamentos', group: 'Publicar e acompanhar', description: 'Planeje as próximas publicações e acompanhe cada envio.' },
  automation: { label: 'Automação do Instagram', group: 'Publicar e acompanhar', description: 'Configure respostas aos comentários e o envio de links no Direct.' },
  history: { label: 'Minhas edições', group: 'Publicar e acompanhar', description: 'Retome seus vídeos e acompanhe o histórico das edições.' },
} as const;
export type ToolView = keyof typeof toolInfo;
export const toolIcons = { overview: LayoutDashboard, videos: Film, photos: Images, scenes: Clapperboard, shopee: ShoppingBag, scheduler: CalendarDays, automation: MessageCircle, history: Library };

export default function StudioNavigation({ view, onNavigate, isOpen, onClose }: { view: ToolView; onNavigate: (view: ToolView) => void; isOpen: boolean; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = panel.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [isOpen, onClose]);
  const navigate = (next: ToolView) => { onNavigate(next); onClose(); };
  const item = (key: ToolView) => {
    const Icon = toolIcons[key];
    return <button key={key} type="button" className={`workspace-nav-item ${view === key ? 'is-active' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={18}/><span>{toolInfo[key].label}</span>{view === key && <ChevronRight size={14} className="nav-current-arrow"/>}</button>;
  };
  return <>
    {isOpen && <button type="button" className="workspace-overlay" tabIndex={-1} aria-label="Fechar menu" onClick={onClose}/>}
    <aside ref={panel} id="workspace-navigation" className={`workspace-sidebar ${isOpen ? 'is-open' : ''}`} aria-label="Menu principal">
      <div className="workspace-brand-row"><button className="workspace-brand" onClick={() => navigate('overview')} aria-label="Clipai — Visão geral"><span className="brand-symbol"><Clapperboard size={23}/></span><span>Clip<span className="brand-accent">ai</span><small>CONTENT STUDIO</small></span></button><button ref={closeButton} type="button" className="studio-icon mobile-nav-close" aria-label="Fechar menu principal" onClick={onClose}><X size={19}/></button></div>
      <div className="workspace-switcher"><span className="workspace-avatar">C</span><span>Meu estúdio<small>Criação de conteúdo</small></span><ChevronRight size={14}/></div>
      <nav aria-label="Ferramentas do estúdio">
        <div className="workspace-nav-group">{item('overview')}</div>
        <div className="workspace-nav-group"><p>Criar conteúdo</p>{item('videos')}{item('photos')}{item('scenes')}</div>
        <div className="workspace-nav-group"><p>Descobrir</p>{item('shopee')}</div>
        <div className="workspace-nav-group"><p>Publicar e acompanhar</p>{item('scheduler')}{item('automation')}{item('history')}</div>
      </nav>
      <div className="workspace-sidebar-bottom"><div className="workspace-tip"><span className="tip-icon"><Film size={17}/></span><strong>Seu próximo conteúdo começa aqui.</strong><p>Do produto à publicação, uma etapa de cada vez.</p><button onClick={() => navigate('videos')}>Criar um vídeo <ArrowUpRight size={15}/></button></div><div className="workspace-footer"><span className="status-dot"/>Clipai Studio<span>Seu espaço criativo</span></div></div>
    </aside>
  </>;
}
