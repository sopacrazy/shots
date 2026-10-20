import { Home, Video, FolderHeart, Settings, User, Zap, X } from 'lucide-react';
import { AppStep } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigateHome: () => void;
  onNavigateProjects: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentStep, onNavigateHome, onNavigateProjects, isOpen, onClose }: SidebarProps) {
  const handleNav = (fn?: () => void) => {
    fn?.();
    onClose();
  };

  return (
    <>
      {/* Overlay mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 border-r border-[#ffffff0a] bg-[#141415]/95 backdrop-blur-3xl
        flex flex-col items-center py-8 shrink-0 transition-transform duration-300
        lg:relative lg:translate-x-0 lg:z-10
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Botão fechar — só mobile */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className="flex items-center gap-2 mb-12 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleNav(onNavigateHome)}
          role="button"
          tabIndex={0}
        >
          <ClipaiLogo className="w-10 h-10" />
          <h1 className="font-display font-semibold text-xl tracking-tight">
            Clip<span className="text-gradient">ai</span>
          </h1>
        </div>

        <nav className="flex-1 w-full px-4 space-y-2">
          <NavItem icon={<Home className="w-5 h-5" />} label="Dashboard" isActive={currentStep === AppStep.DASHBOARD} onClick={() => handleNav(onNavigateHome)} />
          <NavItem icon={<Video className="w-5 h-5" />} label="Projetos" isActive={currentStep === AppStep.PROJECTS} onClick={() => handleNav(onNavigateProjects)} />
          <NavItem icon={<FolderHeart className="w-5 h-5" />} label="Ideias Salvas" isActive={false} />

          <div className="pt-6 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4">Configurações</h3>
          </div>
          <NavItem icon={<Zap className="w-5 h-5" />} label="Integrações" isActive={false} />
          <NavItem icon={<Settings className="w-5 h-5" />} label="Preferências" isActive={false} />
        </nav>

        <div className="w-full px-4 mt-auto">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7B61FF]/10 to-transparent border border-[#7B61FF]/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2A2A2D] flex items-center justify-center">
                <User className="w-4 h-4 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Pro Creator</p>
                <p className="text-xs text-[#00E5FF] truncate">Plano Premium</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function ClipaiLogo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="clipai-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" />
          <stop offset="1" stopColor="#7B61FF" />
        </linearGradient>
      </defs>
      <rect x="2" y="10" width="36" height="24" rx="4" fill="url(#clipai-grad)" />
      <rect x="2" y="10" width="36" height="7" rx="4" fill="rgba(0,0,0,0.35)" />
      <clipPath id="cp-top">
        <rect x="2" y="10" width="36" height="7" rx="4" />
      </clipPath>
      <g clipPath="url(#cp-top)" opacity="0.5">
        <path d="M8 10 L14 17 L8 17Z" fill="white" />
        <path d="M16 10 L22 17 L16 17Z" fill="white" />
        <path d="M24 10 L30 17 L24 17Z" fill="white" />
        <path d="M32 10 L38 17 L32 17Z" fill="white" />
      </g>
      <path d="M16 22 L27 28 L16 34Z" fill="white" />
    </svg>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
        isActive
          ? 'bg-[#7B61FF]/15 text-white border border-[#7B61FF]/30 shadow-[0_0_15px_rgba(123,97,255,0.1)]'
          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-6 bg-[#00E5FF] rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </button>
  );
}
