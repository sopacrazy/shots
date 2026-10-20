import ProductStudio from './components/ProductStudio';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AppStep, type ProjectContext } from './types';
import type { ApiProject } from './lib/api';
import { api } from './lib/api';
import type { FolderDefaults } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProjectsView from './components/ProjectsView';
import Step1Topic from './components/Step1Topic';
import Step2Script from './components/Step2Script';
import Step3Production from './components/Step3Production';
import Step4Preview from './components/Step4Preview';
import Step5Export from './components/Step5Export';


export default function App() {
  const [view, setView] = useState<'products' | 'manual'>('products');
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

  if (view === 'products') return <><div className="studio-mode"><button onClick={() => setView('manual')}>Abrir editor de cenas</button></div><ProductStudio /></>;
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ai-dark text-white selection:bg-ai-primary/30">
      <button className="studio-return" onClick={() => setView('products')}>← Vídeos de produtos</button>
      <Sidebar
        currentStep={currentStep}
        onNavigateHome={goToDashboard}
        onNavigateProjects={goToProjects}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 relative overflow-y-auto flex flex-col">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#ffffff0a] bg-[#141415]/80 backdrop-blur sticky top-0 z-20 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7" viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="m-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00E5FF" /><stop offset="1" stopColor="#7B61FF" />
                </linearGradient>
              </defs>
              <rect x="2" y="10" width="36" height="24" rx="4" fill="url(#m-grad)" />
              <rect x="2" y="10" width="36" height="7" rx="4" fill="rgba(0,0,0,0.35)" />
              <clipPath id="m-cp"><rect x="2" y="10" width="36" height="7" rx="4" /></clipPath>
              <g clipPath="url(#m-cp)" opacity="0.5">
                <path d="M8 10 L14 17 L8 17Z" fill="white" />
                <path d="M16 10 L22 17 L16 17Z" fill="white" />
                <path d="M24 10 L30 17 L24 17Z" fill="white" />
                <path d="M32 10 L38 17 L32 17Z" fill="white" />
              </g>
              <path d="M16 22 L27 28 L16 34Z" fill="white" />
            </svg>
            <span className="font-display font-semibold text-base">Clip<span className="text-[#00E5FF]">ai</span></span>
          </div>
          <div className="w-9" />
        </header>

        <div className="flex-1 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-ai-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 min-h-full">
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
        </div>
      </main>
    </div>
  );
}
