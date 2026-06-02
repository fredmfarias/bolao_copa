'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-[#1e1e2e] border border-white/10 px-4 py-3 shadow-2xl md:left-auto md:right-6 md:max-w-sm">
      <img src="/icons/icon-72x72.png" alt="Bolão Trovão" className="h-10 w-10 rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">Instalar Bolão Trovão</p>
        <p className="text-xs text-white/60 leading-tight">Acesso rápido na tela inicial</p>
      </div>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 active:scale-95 transition-all"
      >
        <Download size={13} />
        Instalar
      </button>
      <button
        onClick={handleDismiss}
        className="rounded-lg p-1 text-white/40 hover:text-white/70 transition-colors"
        aria-label="Fechar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
