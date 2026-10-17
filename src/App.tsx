import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { NasubiClock } from './components/NasubiClock';
import { WidgetsPanel } from './components/WidgetsPanel';
import { BackgroundCropperModal, type BackgroundConfig } from './components/BackgroundCropperModal';
import { SettingsModal, type AppSettings } from './components/SettingsModal';
import { auth } from './services/firebase';

const DEFAULT_SETTINGS: AppSettings = {
  numeralStyle: 'arabic',
  showDigital: true,
};

const DEFAULT_BG_CONFIG: BackgroundConfig = {
  type: 'preset',
  dataUrl: 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)',
  brightness: 1,
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

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('ii_clock_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Background config
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(() => {
    try {
      const saved = localStorage.getItem('ii_clock_bg');
      return saved ? { ...DEFAULT_BG_CONFIG, ...JSON.parse(saved) } : DEFAULT_BG_CONFIG;
    } catch {
      return DEFAULT_BG_CONFIG;
    }
  });

  // 50:50 Area Position State: swaps every 3 minutes!
  // In Landscape: isPanelAFirst === true -> Clock on Left, Widgets on Right
  // In Portrait: isPanelAFirst === true -> Clock on Top, Widgets on Bottom
  // Swapped every 3 minutes!
  const [isPanelAFirst, setIsPanelAFirst] = useState<boolean>(true);

  // Screen Brightness:
  // "・アプリ起動中は輝度を現在の設定の半分にする (50%)"
  // "・アプリが裏にいったり終了したら輝度を元に戻す"
  // "・アプリ起動中にタップした場合は３０秒間輝度を元に戻す"
  const [isFullBrightness, setIsFullBrightness] = useState<boolean>(false);
  const brightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wake Lock (Always enabled for desk clock)
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState<boolean>(false);

  // User auth email
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Save settings helper
  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      localStorage.setItem('ii_clock_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Save background helper
  const handleSaveBackground = (newBg: BackgroundConfig) => {
    setBgConfig(newBg);
    try {
      localStorage.setItem('ii_clock_bg', JSON.stringify(newBg));
    } catch (e) {
      console.warn('Failed to save background to localStorage:', e);
    }
  };

  // ==========================================================
  // 1. SCREEN WAKE LOCK: Always prevent sleep
  // ==========================================================
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wakeLockSentinelRef.current) return;
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        wakeLockSentinelRef.current = null;
      });
    } catch (err) {
      console.warn('Wake Lock request error:', err);
    }
  }, []);

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
  // 2. BRIGHTNESS / DIMMING:
  // - Active app: 50% brightness (overlay opacity 0.5)
  // - Tap screen: restore full brightness (overlay opacity 0) for 30 seconds
  // - Background/blur: restore full brightness (overlay opacity 0)
  // ==========================================================
  const handleScreenTap = useCallback(() => {
    setIsFullBrightness(true);
    if (brightTimerRef.current) clearTimeout(brightTimerRef.current);
    brightTimerRef.current = setTimeout(() => {
      setIsFullBrightness(false);
    }, 30000); // 30 seconds!
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // App in background -> Restore brightness to 100%
        setIsFullBrightness(true);
        if (brightTimerRef.current) clearTimeout(brightTimerRef.current);
      } else {
        // App returns to foreground -> Request wake lock and start at 50% dimming after 30s
        requestWakeLock();
        handleScreenTap();
      }
    };

    const handleWindowBlur = () => {
      setIsFullBrightness(true);
      if (brightTimerRef.current) clearTimeout(brightTimerRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [requestWakeLock, handleScreenTap]);

  // Listen to auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================================
  // 3. 3-MINUTE 50:50 POSITION SWAP (Portrait: Top/Bottom, Landscape: Left/Right)
  // "分割表示した領域は３分に１回場所を入れ替える"
  // ==========================================================
  useEffect(() => {
    const swapInterval = setInterval(() => {
      setIsPanelAFirst((prev) => !prev);
    }, 3 * 60 * 1000); // 3 minutes!

    return () => clearInterval(swapInterval);
  }, []);

  // Background style
  const backgroundStyle: React.CSSProperties = React.useMemo(() => {
    if (bgConfig.type === 'custom' && bgConfig.dataUrl) {
      return {
        backgroundImage: `url(${bgConfig.dataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {
      background: bgConfig.dataUrl || DEFAULT_BG_CONFIG.dataUrl,
    };
  }, [bgConfig]);

  // Brightness overlay: 50% dim when active, 0% when full brightness (tap or background)
  const overlayOpacity = isFullBrightness ? 0 : 0.5;

  return (
    <div
      className="relative w-full h-[100dvh] h-screen overflow-hidden bg-black select-none font-sans text-white touch-manipulation"
      onClick={handleScreenTap}
    >
      {/* Background Layer: supports custom image with transform scale/pan, or preset gradient */}
      {bgConfig.type === 'custom' && bgConfig.dataUrl ? (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none flex items-center justify-center">
          <img
            src={bgConfig.dataUrl}
            alt="カスタム背景"
            className="w-full h-full object-cover pointer-events-none transition-transform duration-200"
            style={{
              transform: `translate(${bgConfig.offsetX || 0}px, ${bgConfig.offsetY || 0}px) scale(${bgConfig.scale || 1})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      ) : (
        <div
          className="fixed inset-0 -z-10 transition-all duration-700 pointer-events-none"
          style={{ background: bgConfig.dataUrl || DEFAULT_BG_CONFIG.dataUrl }}
        />
      )}

      {/* Ambient Dark/Contrast Tint */}
      <div className="fixed inset-0 -z-10 bg-black/35 backdrop-blur-[1px] pointer-events-none" />

      {/* 50% Dimming Overlay (Active = 50% brightness, Tap = 100% for 30s) */}
      <div
        className="fixed inset-0 z-30 bg-black pointer-events-none transition-opacity duration-700 ease-in-out"
        style={{ opacity: overlayOpacity }}
      />

      {/* Subtle Floating Settings Button (Top-Right, no title bar!) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleScreenTap();
          setIsSettingsOpen(true);
        }}
        className="fixed top-2 right-2 z-40 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/70 hover:text-white border border-white/20 transition shadow-lg cursor-pointer active:scale-95"
        title="設定"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* ========================================================== */}
      {/* MAIN CONTAINER: EXACT 50:50 EQUAL SPLIT */}
      {/* ・縦の場合: 上下 50:50 分割 */}
      {/* ・横の場合: 左右 50:50 分割 */}
      {/* ・3分に1回、位置を自動入れ替え */}
      {/* ・1画面にすべて収める (overflow-hidden, zero scrolling) */}
      {/* ========================================================== */}
      <div className="relative z-20 w-full h-full overflow-hidden">
        {isPortrait ? (
          /* PORTRAIT: Top / Bottom 50:50 Split (grid-rows-2) */
          <div className="grid grid-rows-2 w-full h-full p-1.5 gap-2 overflow-hidden transition-all duration-700">
            {/* Panel 1: Clock */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isPanelAFirst ? 'row-start-1' : 'row-start-2'
              }`}
            >
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={settings.showDigital}
              />
            </div>

            {/* Panel 2: Widgets (Timer, Google Calendar, Smartphone Notification) */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isPanelAFirst ? 'row-start-2' : 'row-start-1'
              }`}
            >
              <WidgetsPanel onAlarmTrigger={handleScreenTap} />
            </div>
          </div>
        ) : (
          /* LANDSCAPE: Left / Right 50:50 Split (grid-cols-2) */
          <div className="grid grid-cols-2 w-full h-full p-2 md:p-3 gap-3 overflow-hidden transition-all duration-700">
            {/* Panel 1: Clock */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isPanelAFirst ? 'col-start-1' : 'col-start-2'
              }`}
            >
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={settings.showDigital}
              />
            </div>

            {/* Panel 2: Widgets (Timer, Google Calendar, Smartphone Notification) */}
            <div
              className={`w-full h-full min-h-0 flex items-center justify-center overflow-hidden transition-all duration-700 ${
                isPanelAFirst ? 'col-start-2' : 'col-start-1'
              }`}
            >
              <WidgetsPanel onAlarmTrigger={handleScreenTap} />
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenBackgroundModal={() => setIsBgModalOpen(true)}
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
