import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { NasubiClock } from './components/NasubiClock';
import { WidgetsPanel, type AppNotification } from './components/WidgetsPanel';
import { BackgroundCropperModal, type BackgroundConfig } from './components/BackgroundCropperModal';
import { SettingsModal, type AppSettings, type OrientationMode } from './components/SettingsModal';
import { auth } from './services/firebase';

const DEFAULT_SETTINGS: AppSettings = {
  orientation: 'landscape-top-right', // Horizontal fixed: screen top to the right
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
  // isLeftClock === true: Clock is on Left, Widgets on Right.
  // isLeftClock === false: Widgets on Left, Clock on Right.
  const [isLeftClock, setIsLeftClock] = useState<boolean>(true);
  const [swapCountdown, setSwapCountdown] = useState<number>(180); // 3 minutes = 180s

  // Screen Brightness Dimming state
  // "起動中は輝度を最低まで落とす" -> Default dimmed while running
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
      message: '日本標準時 (JST) で時を刻んでいます。左右の配置は3分ごとに切り替わります。',
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
  // "起動中は輝度を最低まで落とす"
  // "バックに行ったら輝度をもとに戻す"
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
        // App went to background -> Restore brightness to full / normal!
        setIsDimmed(false);
        if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
      } else {
        // App returned to foreground
        requestWakeLock();
        // Give user a brief 3s bright glance before dimming to minimum
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
      // Window blurred (user clicked outside or switched window)
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
  // 3. 3-MINUTE LAYOUT SWITCH
  // "左右の表示は３分に１回切り替える"
  // ==========================================================
  useEffect(() => {
    if (!settings.autoSwapEnabled) return;

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
  }, [settings.autoSwapEnabled, settings.swapIntervalMin]);

  const handleManualSwap = () => {
    setIsLeftClock((prev) => !prev);
    setSwapCountdown(settings.swapIntervalMin * 60);
  };

  // ==========================================================
  // 4. ORIENTATION STYLING
  // "画面は縦固定でも、横固定でも、自動でも
  //  横固定（画面上部が右）で表示するようにする"
  // ==========================================================
  // Attempt Screen Orientation lock if browser supports it
  useEffect(() => {
    try {
      const screenOri = window.screen.orientation;
      if (screenOri && 'lock' in screenOri) {
        if (settings.orientation === 'landscape-top-right') {
          (screenOri as unknown as { lock: (mode: string) => Promise<void> }).lock('landscape-secondary').catch(() => {});
        } else if (settings.orientation === 'landscape-normal') {
          (screenOri as unknown as { lock: (mode: string) => Promise<void> }).lock('landscape-primary').catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }, [settings.orientation]);

  // Calculate CSS rotation & dimension styles based on orientation selection
  const orientationContainerStyle: React.CSSProperties = React.useMemo(() => {
    switch (settings.orientation) {
      case 'landscape-top-right': // Screen top is to the right (90deg)
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: '100vh',
          height: '100vw',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          transformOrigin: 'center center',
          overflow: 'hidden',
        };
      case 'landscape-top-left': // Screen top is to the left (270deg)
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: '100vh',
          height: '100vw',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          overflow: 'hidden',
        };
      case 'portrait':
        return {
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
        };
      case 'landscape-normal':
      case 'auto':
      default:
        return {
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
        };
    }
  }, [settings.orientation]);

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
  // When isDimmed is true, dim down to minimum brightness (e.g. 20% brightness = 80% darkness overlay)
  const overlayDarkness = isDimmed && settings.autoDimEnabled ? (1 - settings.minBrightness) : 0;

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden select-none font-sans text-white touch-manipulation"
      onClick={wakeUpBrightness}
      onMouseMove={wakeUpBrightness}
    >
      {/* Rotated Orientation Wrapper */}
      <div style={orientationContainerStyle} className="flex flex-col justify-between">
        {/* Background Layer */}
        <div
          className="absolute inset-0 -z-10 transition-all duration-700"
          style={backgroundStyle}
        />

        {/* Ambient Dark/Contrast Tint */}
        <div className="absolute inset-0 -z-10 bg-black/35 backdrop-blur-[1px]" />

        {/* Dimming Darkness Overlay (Controls active brightness reduction) */}
        <div
          className="absolute inset-0 z-30 bg-black pointer-events-none transition-opacity duration-1000 ease-in-out"
          style={{ opacity: overlayDarkness }}
        />

        {/* ========================================================== */}
        {/* TOP BAR: Controls & Status (Subtle & Non-distracting) */}
        {/* ========================================================== */}
        <header className="relative z-40 flex items-center justify-between px-4 py-2 w-full text-xs text-purple-200/80">
          {/* Left: App Title */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-white/90 drop-shadow">
              🍆 <span className="font-medium tracking-wide">茄子置時計</span>
            </span>
          </div>

          {/* Right: Settings Icon (右上) */}
          <div className="flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                wakeUpBrightness();
                setIsSettingsOpen(true);
              }}
              className="p-1.5 rounded-full bg-purple-950/70 hover:bg-purple-800 text-purple-200 hover:text-white border border-purple-400/30 transition shadow-lg cursor-pointer"
              title="置時計の設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ========================================================== */}
        {/* MAIN BODY: 50% / 50% SPLIT (Swapped every 3 minutes!) */}
        {/* ========================================================== */}
        <main className="relative z-20 flex-1 w-full grid grid-cols-1 md:grid-cols-2 p-2 md:p-4 gap-2 md:gap-4 overflow-hidden items-center justify-center transition-all duration-700">
          {/* Panel A (Left when isLeftClock, Right when !isLeftClock) */}
          <div
            className={`w-full h-full flex items-center justify-center transition-all duration-700 ${
              isLeftClock ? 'md:order-1' : 'md:order-2'
            }`}
          >
            <NasubiClock
              numeralStyle={settings.numeralStyle}
              showDigital={settings.showDigital}
            />
          </div>

          {/* Panel B: Widgets (Right when isLeftClock, Left when !isLeftClock) */}
          <div
            className={`w-full h-full flex items-center justify-center transition-all duration-700 ${
              isLeftClock ? 'md:order-2' : 'md:order-1'
            }`}
          >
            <WidgetsPanel
              latestNotification={latestNotification}
              onNewNotification={(notif) => {
                setLatestNotification(notif);
                wakeUpBrightness();
              }}
              onClearNotification={() => setLatestNotification(null)}
            />
          </div>
        </main>

        {/* Dim Tap Notification hint on screen bottom if dimmed */}
        {isDimmed && settings.autoDimEnabled && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-[10px] text-purple-300/40 tracking-wider">
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
