import React from 'react';
import { X, Moon, Sun, Shuffle, ShieldCheck, Image as ImageIcon, LogOut, Check, Download } from 'lucide-react';
import { logout } from '../services/firebase';

export type OrientationMode =
  | 'landscape-top-right' // 90deg rotation (screen top on right)
  | 'landscape-top-left' // 270deg rotation
  | 'landscape-normal' // horizontal standard
  | 'portrait' // vertical
  | 'auto'; // automatic

export interface AppSettings {
  orientation: OrientationMode;
  autoDimEnabled: boolean;
  minBrightness: number; // 0.1 to 0.5 (10% to 50%)
  autoDimDelaySec: number; // 3, 5, 10
  swapIntervalMin: number; // 3 minutes default
  autoSwapEnabled: boolean;
  numeralStyle: 'arabic' | 'roman' | 'minimal';
  showDigital: boolean;
  wakeLockEnabled: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenBackgroundModal: () => void;
  onManualSwap: () => void;
  swapCountdownSec: number;
  wakeLockActive: boolean;
  userEmail?: string | null;
  onLogoutSuccess?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenBackgroundModal,
  onManualSwap,
  swapCountdownSec,
  wakeLockActive,
  userEmail,
  onLogoutSuccess,
}) => {
  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  const minutesRemaining = Math.floor(swapCountdownSec / 60);
  const secondsRemaining = swapCountdownSec % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-lg max-h-[90vh] bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-base md:text-lg font-bold text-white">置時計の設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-xs md:text-sm">
          {/* 1. BRIGHTNESS & SLEEP */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-purple-200">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>起動中の減光 (省電力・眩しさ防止)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoDimEnabled}
                  onChange={(e) => onUpdateSettings({ autoDimEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="text-xs text-purple-300/70">
              時計の稼働中は画面輝度を最低まで落とします。画面をタップすると一時的に明るくなり、バックグラウンド移行時（他のアプリ使用時）は元の明るさに戻ります。
            </p>

            {settings.autoDimEnabled && (
              <div className="space-y-2 p-3 bg-black/30 rounded-xl border border-purple-500/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-200">最低輝度レベル:</span>
                  <span className="font-mono text-purple-300 font-bold">
                    {Math.round(settings.minBrightness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.45"
                  step="0.05"
                  value={settings.minBrightness}
                  onChange={(e) => onUpdateSettings({ minBrightness: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-purple-400/60">
                  <span>暗い (10%)</span>
                  <span>標準 (25%)</span>
                  <span>見やすい (45%)</span>
                </div>
              </div>
            )}
          </section>

          {/* 3. 3-MINUTE LAYOUT SWITCH */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-purple-200">
                <Shuffle className="w-4 h-4 text-emerald-400" />
                <span>3分ごとの左右切り替え (焼き付き防止)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSwapEnabled}
                  onChange={(e) => onUpdateSettings({ autoSwapEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="text-xs text-purple-300/70">
              時計とウィジェット（タイマー・予定）の左右位置を3分に1回自動で入れ替えます。
            </p>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-purple-500/20">
              <div className="text-xs text-purple-200">
                次の切り替えまで: <span className="font-mono font-bold text-emerald-400">{minutesRemaining}分{secondsRemaining}秒</span>
              </div>
              <button
                onClick={onManualSwap}
                className="px-3 py-1 rounded-lg text-xs bg-purple-600/50 hover:bg-purple-600 text-white transition cursor-pointer"
              >
                今すぐ切替
              </button>
            </div>
          </section>

          {/* 4. BACKGROUND CUSTOMIZATION */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-purple-200">
                <ImageIcon className="w-4 h-4 text-pink-400" />
                <span>背景の変更・カメラ・切り出し</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenBackgroundModal();
                }}
                className="px-3 py-1 rounded-lg text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium transition cursor-pointer"
              >
                背景を設定
              </button>
            </div>
            <p className="text-xs text-purple-300/70">
              デバイスの写真やカメラで撮影した写真をズーム・トリミングして置時計の背景に設定できます。
            </p>
          </section>

          {/* 5. SCREEN WAKE LOCK STATUS */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-purple-200">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>画面スリープ防止 (Wake Lock)</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  wakeLockActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {wakeLockActive ? '常時点灯中' : '未対応/待機中'}
              </span>
            </div>
            <p className="text-xs text-purple-300/70">
              置時計の稼働中、端末の画面が自動ロック（スリープ）されないように制御しています。
            </p>
          </section>

          {/* 6. CLOCK FACE DIAL STYLE */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="font-semibold text-purple-200">時計文字盤の数字スタイル</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'arabic' as const, label: 'アラビア数字 (1..12)' },
                { id: 'roman' as const, label: 'ローマ数字 (I..XII)' },
                { id: 'minimal' as const, label: 'ミニマル (3/6/9/12)' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => onUpdateSettings({ numeralStyle: style.id })}
                  className={`py-2 px-2 rounded-xl text-center text-xs border transition cursor-pointer ${
                    settings.numeralStyle === style.id
                      ? 'bg-purple-600/40 border-purple-400 text-white font-bold'
                      : 'bg-black/30 border-purple-500/20 text-purple-300/70 hover:bg-purple-900/20'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </section>

          {/* 7. GITHUB PROJECT ZIP DOWNLOAD */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-purple-200 flex items-center gap-1.5">
                <span>📦</span>
                <span>GitHub用ファイル一式 (ZIP)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                GitHub Actions対応
              </span>
            </div>
            <p className="text-xs text-purple-300/70">
              GitHubにpushすると自動でAPKがビルドされるワークフロー（.github/workflows）およびAndroidネイティブ構成が含まれています。
            </p>
            <a
              href="/nasubi-clock.zip"
              download="nasubi-clock.zip"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-900/40 transition cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>nasubi-clock.zip をダウンロード</span>
            </a>
          </section>

          {/* 8. GOOGLE ACCOUNT STATUS */}
          {userEmail && (
            <section className="flex items-center justify-between pt-3 border-t border-purple-500/20 text-xs">
              <span className="text-purple-300/80 truncate max-w-[200px]">
                Googleアカウント: <strong className="text-white">{userEmail}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> ログアウト
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
