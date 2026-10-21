import ProductStudio from './components/ProductStudio';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Menu, Plus } from 'lucide-react';
import { AppStep, type ProjectContext } from './types';
import type { ApiProject } from './lib/api';
import { api } from './lib/api';
import type { FolderDefaults } from './types';
import StudioNavigation, { toolInfo, type ToolView } from './components/StudioNavigation';
import WorkflowSteps from './components/WorkflowSteps';
import Dashboard from './components/Dashboard';
import ProjectsView from './components/ProjectsView';
import Step1Topic from './components/Step1Topic';
import Step2Script from './components/Step2Script';
import Step3Production from './components/Step3Production';
import Step4Preview from './components/Step4Preview';
import Step5Export from './components/Step5Export';


export default function App() {
  const readView = (): ToolView => { const hash = window.location.hash.slice(1); return Object.hasOwn(toolInfo, hash) ? hash as ToolView : 'overview'; };
  const [view, setView] = useState<ToolView>(readView);
  const navigate = useCallback((next: ToolView) => { setView(next); if (window.location.hash !== `#${next}`) window.location.hash = next; }, []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useEffect(() => { const onHash = () => { setView(readView()); setSidebarOpen(false); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { document.title = `${toolInfo[view].label} · Clipai Studio`; document.querySelectorAll<HTMLMediaElement>('[hidden] video, [hidden] audio').forEach(media => media.pause()); window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }, [view]);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.DASHBOARD);
  const [project, setProject] = useState<ProjectContext | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [pendingFolderDefaults, setPendingFolderDefaults] = useState<FolderDefaults | null>(null);

  const startNewProject = (defaults?: FolderDefaults) => {
    setProject(null);
    setPendingFolderDefaults(defaults ?? null);
    setCurrentStep(AppStep.TOPIC_SELECTION);
  };

  const goToDashboard = () => {
    setProject(null);
    setCurrentStep(AppStep.DASHBOARD);
  };

  const goToProjects = () => {
    setProject(null);
    setCurrentStep(AppStep.PROJECTS);
  };

  const handleTopicDone = (ctx: ProjectContext) => {
    const defaults = pendingFolderDefaults;
    setProject({ ...ctx, ...defaults ?? {} });
    setPendingFolderDefaults(null);
    if (defaults?.folderId) {
      api.projects.moveToFolder(ctx.projectId, defaults.folderId).catch(() => {});
    }
    setCurrentStep(AppStep.SCRIPT_GENERATION);
  };

  const handleAutoGenerate = (ctx: ProjectContext) => {
    const defaults = pendingFolderDefaults;
    setProject({ ...ctx, ...defaults ?? {} });
    setPendingFolderDefaults(null);
    if (defaults?.folderId) {
      api.projects.moveToFolder(ctx.projectId, defaults.folderId).catch(() => {});
    }
    setCurrentStep(AppStep.SCRIPT_GENERATION);
  };

  // Abre projeto existente direto na etapa de imagens para edição
  const handleEditProject = (p: ApiProject) => {
    setProject({ projectId: p.id, topic: p.topic, niche: p.niche ?? 'curiosidades' });
    setCurrentStep(AppStep.PRODUCTION_ELEMENTS);
  };

  const sceneSteps = [AppStep.TOPIC_SELECTION, AppStep.SCRIPT_GENERATION, AppStep.PRODUCTION_ELEMENTS, AppStep.PREVIEW, AppStep.EXPORT];
  const sceneIndex = sceneSteps.indexOf(currentStep);
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Pular para o conteúdo</a>
      <StudioNavigation
        view={view}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      <main id="main-content" className="workspace-main" tabIndex={-1}>
        <header className="workspace-topbar"><button type="button" className="studio-icon mobile-nav-open" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu principal" aria-expanded={sidebarOpen} aria-controls="workspace-navigation"><Menu size={20}/></button><div className="workspace-breadcrumb"><span>{toolInfo[view].group}</span><ChevronRight size={14}/><strong>{toolInfo[view].label}</strong></div><span className="workspace-topbar-label"><span className="status-dot"/>Estúdio de criação</span></header>
        <div hidden={view === 'scenes'}><ProductStudio view={view} onNavigate={navigate}/></div>
        <div hidden={view !== 'scenes'} className="studio scene-workspace">
          <header className="studio-header"><div><span className="studio-eyebrow">CRIAÇÃO PERSONALIZADA</span><h1>Editor de cenas</h1><p>{toolInfo.scenes.description}</p></div><button className="studio-primary" onClick={() => startNewProject()}><Plus size={17}/>Novo projeto</button></header>
          <nav className="tool-tabs" aria-label="Editor de cenas"><button className={`tool-tab ${currentStep === AppStep.DASHBOARD ? 'is-active' : ''}`} onClick={goToDashboard}>Visão dos projetos</button><button className={`tool-tab ${currentStep === AppStep.PROJECTS ? 'is-active' : ''}`} onClick={goToProjects}>Pastas e projetos</button>{sceneIndex >= 0 && <span className="scene-current-project">{project?.topic || 'Novo projeto'}</span>}</nav>
          {sceneIndex >= 0 && <WorkflowSteps steps={[{ title: 'Tema', description: 'Defina a ideia' }, { title: 'Roteiro', description: 'Escreva a história' }, { title: 'Produção', description: 'Imagens e áudio' }, { title: 'Prévia', description: 'Confira o vídeo' }, { title: 'Exportar', description: 'Salve o resultado' }]} current={sceneIndex} canVisit={index => index === sceneIndex || (index < sceneIndex && !!project)} onChange={index => setCurrentStep(sceneSteps[index])}/>}
          {currentStep === AppStep.DASHBOARD && (
            <Dashboard onStartProject={startNewProject} onEditProject={handleEditProject} />
          )}

          {currentStep === AppStep.PROJECTS && (
            <ProjectsView onStartProject={startNewProject} onEditProject={handleEditProject} />
          )}

          {currentStep === AppStep.TOPIC_SELECTION && (
            <Step1Topic onNext={handleTopicDone} onAutoGenerate={handleAutoGenerate} folderContext={pendingFolderDefaults ?? undefined} />
          )}

          {currentStep === AppStep.SCRIPT_GENERATION && project && (
            <Step2Script
              project={project}
              onNext={() => setCurrentStep(AppStep.PRODUCTION_ELEMENTS)}
              onBack={() => setCurrentStep(AppStep.TOPIC_SELECTION)}
            />
          )}

          {currentStep === AppStep.PRODUCTION_ELEMENTS && project && (
            <Step3Production
              project={project}
              onNext={() => setCurrentStep(AppStep.PREVIEW)}
              onBack={() => setCurrentStep(AppStep.SCRIPT_GENERATION)}
            />
          )}

          {currentStep === AppStep.PREVIEW && project && (
            <Step4Preview
              project={project}
              onNext={() => setCurrentStep(AppStep.EXPORT)}
              onBack={() => setCurrentStep(AppStep.PRODUCTION_ELEMENTS)}
            />
          )}

          {currentStep === AppStep.EXPORT && project && (
            <Step5Export
              project={project}
              onFinish={goToDashboard}
              onBack={() => setCurrentStep(AppStep.PREVIEW)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
