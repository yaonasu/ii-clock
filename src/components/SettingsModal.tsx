import React from 'react';
import { X, Image as ImageIcon, LogOut, Check } from 'lucide-react';
import { logout } from '../services/firebase';

export interface AppSettings {
  numeralStyle: 'arabic' | 'roman';
  showDigital: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenBackgroundModal: () => void;
  userEmail?: string | null;
  onLogoutSuccess?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenBackgroundModal,
  userEmail,
  onLogoutSuccess,
}) => {
  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-md max-h-[85vh] bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header: タイトル「設定」 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt="ii-clock icon"
              className="w-7 h-7 rounded-full object-cover border border-purple-400/50 shadow"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-base md:text-lg font-bold text-white">設定</h2>
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
          {/* 1. BACKGROUND CUSTOMIZATION */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-purple-200">
                <ImageIcon className="w-4 h-4 text-pink-400" />
                <span>背景画像の変更</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenBackgroundModal();
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition cursor-pointer shadow-md shadow-purple-900/30"
              >
                背景を設定
              </button>
            </div>
            <p className="text-xs text-purple-300/70">
              プリセット背景の選択や、ご自身の写真（縦・横枠に合わせたドラッグ位置調整・拡縮）を設定できます。
            </p>
          </section>

          {/* 2. CLOCK FACE DIAL STYLE (アラビア数字 / ローマ数字 のみ。ミニマル削除) */}
          <section className="space-y-2.5 pt-4 border-t border-purple-500/20">
            <div className="font-semibold text-purple-200">時計文字盤の数字スタイル</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'arabic' as const, label: 'アラビア数字 (1..12)' },
                { id: 'roman' as const, label: 'ローマ数字 (I..XII)' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => onUpdateSettings({ numeralStyle: style.id })}
                  className={`py-2.5 px-3 rounded-xl text-center text-xs border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    settings.numeralStyle === style.id
                      ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-lg shadow-purple-900/40'
                      : 'bg-black/30 border-purple-500/20 text-purple-300/70 hover:bg-purple-900/20'
                  }`}
                >
                  {settings.numeralStyle === style.id && <Check className="w-3.5 h-3.5" />}
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 3. DIGITAL TIME DISPLAY TOGGLE */}
          <section className="flex items-center justify-between pt-4 border-t border-purple-500/20">
            <span className="font-semibold text-purple-200">デジタル時計の表示</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showDigital}
                onChange={(e) => onUpdateSettings({ showDigital: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </section>

          {/* 4. GOOGLE ACCOUNT STATUS */}
          {userEmail && (
            <section className="flex items-center justify-between pt-4 border-t border-purple-500/20 text-xs">
              <span className="text-purple-300/80 truncate max-w-[200px]">
                Google連携中: <strong className="text-white">{userEmail}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 cursor-pointer"
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
