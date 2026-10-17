import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { NasubiClock } from './components/NasubiClock';
import { WidgetsPanel, type AppNotification } from './components/WidgetsPanel';
import { BackgroundCropperModal, type BackgroundConfig } from './components/BackgroundCropperModal';
import { SettingsModal, type AppSettings } from './components/SettingsModal';
import { auth } from './services/firebase';

const DEFAULT_SETTINGS: AppSettings = {
  orientation: 'auto',
  autoDimEnabled: true,
  minBrightness: 0.2, // 20% minimum brightness
  autoDimDelaySec: 5,
  swapIntervalMin: 3,
  autoSwapEnabled: true,
  numeralStyle: 'arabic',
  showDigital: true,
  wakeLockEnabled: true,
};

const DEFAULT_BG_CONFIG: BackgroundConfig = {
  type: 'preset',
  dataUrl: 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)',
  brightness: 0.9,
  blur: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export default function App() {
  // Orientation detection (Portrait vs Landscape)
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

  useEffect(() => {
    const handleOrientationCheck = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleOrientationCheck);
    window.addEventListener('orientationchange', handleOrientationCheck);
    return () => {
      window.removeEventListener('resize', handleOrientationCheck);
      window.removeEventListener('orientationchange', handleOrientationCheck);
    };
  }, []);

  // App Settings with localStorage persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('nasubi_clock_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Background config with localStorage persistence
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(() => {
    try {
      const saved = localStorage.getItem('nasubi_clock_bg');
      return saved ? { ...DEFAULT_BG_CONFIG, ...JSON.parse(saved) } : DEFAULT_BG_CONFIG;
    } catch {
      return DEFAULT_BG_CONFIG;
    }
  });

  // Layout Swap state (3-minute interval)
  // In Landscape: isLeftClock === true: Clock on Left, Widgets on Right; switches every 3 min.
  // In Portrait: No automatic switching; Clock at top, Widgets below with scrolling.
  const [isLeftClock, setIsLeftClock] = useState<boolean>(true);
  const [swapCountdown, setSwapCountdown] = useState<number>(180);

  // Screen Brightness Dimming state
  const [isDimmed, setIsDimmed] = useState<boolean>(true);
  const dimTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wake Lock state
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState<boolean>(false);

  // Notification state
  const [latestNotification, setLatestNotification] = useState<AppNotification | null>(() => {
    return {
      id: 'init-1',
      title: '茄子置時計が起動しました',
      message: '日本標準時 (JST) で時を刻んでいます。',
      time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      type: 'system',
    };
  });

  // User auth email
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Save settings helper
  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      localStorage.setItem('nasubi_clock_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Save background helper
  const handleSaveBackground = (newBg: BackgroundConfig) => {
    setBgConfig(newBg);
    localStorage.setItem('nasubi_clock_bg', JSON.stringify(newBg));
  };

  // ==========================================================
  // 1. SCREEN WAKE LOCK: Keep screen unlocked while running
  // ==========================================================
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || !settings.wakeLockEnabled) return;
    try {
      if (wakeLockSentinelRef.current) {
        return;
      }
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setWakeLockActive(true);

      sentinel.addEventListener('release', () => {
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      setWakeLockActive(false);
    }
  }, [settings.wakeLockEnabled]);

  useEffect(() => {
    requestWakeLock();
    return () => {
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release();
        wakeLockSentinelRef.current = null;
      }
    };
  }, [requestWakeLock]);

  // ==========================================================
  // 2. BRIGHTNESS / DIMMING & VISIBILITY CHANGE
  // ==========================================================
  const wakeUpBrightness = useCallback(() => {
    setIsDimmed(false);
    if (dimTimerRef.current) clearTimeout(dimTimerRef.current);

    if (settings.autoDimEnabled) {
      dimTimerRef.current = setTimeout(() => {
        setIsDimmed(true);
      }, settings.autoDimDelaySec * 1000);
    }
  }, [settings.autoDimEnabled, settings.autoDimDelaySec]);

  // Handle visibility change: Background vs Foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background -> Restore brightness to full / normal
        setIsDimmed(false);
        if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
      } else {
        // App returned to foreground
        requestWakeLock();
        setIsDimmed(false);
        if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
        if (settings.autoDimEnabled) {
          dimTimerRef.current = setTimeout(() => {
            setIsDimmed(true);
          }, 3000);
        }
      }
    };

    const handleWindowBlur = () => {
      setIsDimmed(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [settings.autoDimEnabled, requestWakeLock]);

  // Listen to auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================================
  // 3. LAYOUT SWITCH
  // ・横向きなら現状の仕様通りとする（3分に1回自動切り替え）
  // ・縦向きの場合は画面の自動切り替わりなし
  // ==========================================================
  useEffect(() => {
    // 縦向きの場合は自動切り替えを行わない
    if (isPortrait || !settings.autoSwapEnabled) return;

    const interval = setInterval(() => {
      setSwapCountdown((prev) => {
        if (prev <= 1) {
          setIsLeftClock((curr) => !curr);
          return settings.swapIntervalMin * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPortrait, settings.autoSwapEnabled, settings.swapIntervalMin]);

  const handleManualSwap = () => {
    setIsLeftClock((prev) => !prev);
    setSwapCountdown(settings.swapIntervalMin * 60);
  };

  // Stable notification handler to prevent re-render thrashing
  const handleNewNotification = useCallback((notif: AppNotification) => {
    setLatestNotification(notif);
    wakeUpBrightness();
  }, [wakeUpBrightness]);

  // Render Background
  const backgroundStyle: React.CSSProperties = React.useMemo(() => {
    if (bgConfig.type === 'custom' && bgConfig.dataUrl) {
      return {
        backgroundImage: `url(${bgConfig.dataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: `blur(${bgConfig.blur}px)`,
      };
    }
    return {
      background: bgConfig.dataUrl || DEFAULT_BG_CONFIG.dataUrl,
    };
  }, [bgConfig]);

  // Brightness overlay opacity
  const overlayDarkness = isDimmed && settings.autoDimEnabled ? (1 - settings.minBrightness) : 0;

  return (
    <div
      className={`relative w-full ${isPortrait ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'} bg-black select-none font-sans text-white touch-manipulation`}
      onClick={wakeUpBrightness}
      onMouseMove={wakeUpBrightness}
    >
      {/* Background Layer (Fixed behind everything) */}
      <div
        className="fixed inset-0 -z-10 transition-all duration-700 pointer-events-none"
        style={backgroundStyle}
      />

      {/* Ambient Dark/Contrast Tint */}
      <div className="fixed inset-0 -z-10 bg-black/35 backdrop-blur-[1px] pointer-events-none" />

      {/* Dimming Darkness Overlay */}
      <div
        className="fixed inset-0 z-30 bg-black pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{ opacity: overlayDarkness }}
      />

      {/* Main Container */}
      <div className="relative flex flex-col justify-between w-full h-[100dvh] h-screen overflow-hidden">
        {/* ========================================================== */}
        {/* TOP BAR: Title & Settings Icon */}
        {/* ========================================================== */}
        <header className="relative z-40 flex items-center justify-between px-3 py-1.5 w-full text-xs text-purple-200/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 font-semibold text-white/90 drop-shadow">
              <img
                src="/icon.png"
                alt="茄子マスコット"
                className="w-6 h-6 rounded-full object-cover border border-purple-400/50 shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className="font-medium tracking-wide">茄子置時計</span>
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                wakeUpBrightness();
                setIsSettingsOpen(true);
              }}
              className="p-1.5 rounded-full bg-purple-950/70 hover:bg-purple-800 text-purple-200 hover:text-white border border-purple-400/30 transition shadow-lg cursor-pointer"
              title="茄子置時計の設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ========================================================== */}
        {/* MAIN BODY: １画面にすべて入るレイアウト */}
        {/* ・横向き: 50% / 50% 分割 & 3分に1回自動切り替え */}
        {/* ・縦向き: 上部に時計、下部にタイマー・予定・通知（1画面に収容） */}
        {/* ========================================================== */}
        {isPortrait ? (
          /* PORTRAIT MODE: 1-screen fit without scrolling */
          <main className="relative z-20 flex-1 min-h-0 w-full flex flex-col items-center justify-between px-2 py-1 gap-1.5 overflow-hidden">
            {/* Clock at Top (auto-fits available height) */}
            <div className="flex-1 min-h-0 w-full max-w-[min(90vw,36vh)] flex items-center justify-center shrink">
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={settings.showDigital}
              />
            </div>

            {/* Widgets underneath */}
            <div className="w-full max-w-md shrink-0">
              <WidgetsPanel
                latestNotification={latestNotification}
                onNewNotification={handleNewNotification}
                onClearNotification={() => setLatestNotification(null)}
              />
            </div>
          </main>
        ) : (
          /* LANDSCAPE MODE: 50% / 50% split with 3-minute automatic swap */
          <main className="relative z-20 flex-1 min-h-0 w-full grid grid-cols-2 p-1.5 md:p-3 gap-2 md:gap-4 overflow-hidden items-center justify-center transition-all duration-700">
            {/* Panel A: Clock */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isLeftClock ? 'order-1' : 'order-2'
              }`}
            >
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={settings.showDigital}
              />
            </div>

            {/* Panel B: Widgets */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isLeftClock ? 'order-2' : 'order-1'
              }`}
            >
              <WidgetsPanel
                latestNotification={latestNotification}
                onNewNotification={handleNewNotification}
                onClearNotification={() => setLatestNotification(null)}
              />
            </div>
          </main>
        )}

        {/* Dim Tap Notification hint on screen bottom if dimmed */}
        {isDimmed && settings.autoDimEnabled && (
          <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-[10px] text-purple-300/40 tracking-wider">
            タップで画面を明るく表示
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODALS */}
      {/* ========================================================== */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenBackgroundModal={() => setIsBgModalOpen(true)}
        onManualSwap={handleManualSwap}
        swapCountdownSec={swapCountdown}
        wakeLockActive={wakeLockActive}
        userEmail={userEmail}
        onLogoutSuccess={() => setUserEmail(null)}
      />

      <BackgroundCropperModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        currentConfig={bgConfig}
        onSaveBackground={handleSaveBackground}
      />
    </div>
  );
}
