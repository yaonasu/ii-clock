import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { NasubiClock } from './components/NasubiClock';
import { WidgetsPanel } from './components/WidgetsPanel';
import { SettingsModal, type AppSettings, type BackgroundConfig } from './components/SettingsModal';
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
  // In Landscape:
  // Expected initial: Left half = 3 widgets, Right half = Clock
  // Swapped: Left half = Clock, Right half = 3 widgets
  // In Portrait:
  // Initial: Top half = Clock, Bottom half = 3 widgets
  // Swapped: Top half = 3 widgets, Bottom half = Clock
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  // Screen Brightness:
  // - Active app: 50% brightness
  // - Tap screen: restore 100% brightness for 30s
  // - Background/blur: restore 100% brightness
  const [isFullBrightness, setIsFullBrightness] = useState<boolean>(false);
  const brightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wake Lock (Always enabled for desk clock)
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

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

  // Save background helper with safe localStorage
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
        setIsFullBrightness(true);
        if (brightTimerRef.current) clearTimeout(brightTimerRef.current);
      } else {
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
  // 3. 3-MINUTE 50:50 POSITION SWAP
  // ==========================================================
  useEffect(() => {
    const swapInterval = setInterval(() => {
      setIsSwapped((prev) => !prev);
    }, 3 * 60 * 1000); // 3 minutes!

    return () => clearInterval(swapInterval);
  }, []);

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
      {/* ・横向き期待値: 右半分に時計、左半分に３種の表示 (上下に寄せない) */}
      {/* ・縦向き: 上下に時計と３種の表示を50:50で配置 */}
      {/* ・3分に1回場所を入れ替える */}
      {/* ========================================================== */}
      <div className="relative z-20 w-full h-full overflow-hidden">
        {isPortrait ? (
          /* PORTRAIT: Top / Bottom 50:50 Split */
          <div
            className={`flex flex-col w-full h-full p-1.5 gap-2 overflow-hidden items-center justify-center transition-all duration-700 ${
              isSwapped ? 'flex-col-reverse' : 'flex-col'
            }`}
          >
            {/* Top Half (50% height): Clock */}
            <div className="w-full h-1/2 min-h-0 flex items-center justify-center overflow-hidden">
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={true}
              />
            </div>

            {/* Bottom Half (50% height): 3 Widgets */}
            <div className="w-full h-1/2 min-h-0 flex items-center justify-center overflow-hidden">
              <WidgetsPanel onAlarmTrigger={handleScreenTap} />
            </div>
          </div>
        ) : (
          /* LANDSCAPE: Exactly Left Half = 3 Widgets, Right Half = Clock */
          /* Perfectly centered vertically, no diagonal offset */
          <div
            className={`flex w-full h-full p-2 md:p-4 gap-4 overflow-hidden items-center justify-center transition-all duration-700 ${
              isSwapped ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Left Half (50% width, 100% height): 3 Widgets (Timer, Calendar, Notification) */}
            <div className="w-1/2 h-full min-h-0 flex items-center justify-center overflow-hidden">
              <WidgetsPanel onAlarmTrigger={handleScreenTap} />
            </div>

            {/* Right Half (50% width, 100% height): Clock */}
            <div className="w-1/2 h-full min-h-0 flex items-center justify-center overflow-hidden">
              <NasubiClock
                numeralStyle={settings.numeralStyle}
                showDigital={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* UNIFIED 1-SCREEN SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        currentBg={bgConfig}
        onSaveBackground={handleSaveBackground}
        userEmail={userEmail}
        onLogoutSuccess={() => setUserEmail(null)}
      />
    </div>
  );
}
