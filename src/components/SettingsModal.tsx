import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, LogOut, Check, ZoomIn, ZoomOut, RotateCcw, Move, Smartphone, ArrowLeft } from 'lucide-react';
import { logout } from '../services/firebase';

export interface ImageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface BackgroundConfig {
  type: 'custom' | 'preset';
  dataUrl: string;
  portrait: ImageTransform;
  landscape: ImageTransform;
  brightness?: number;
  blur?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface AppSettings {
  numeralStyle: 'arabic' | 'roman';
  showDigital?: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  currentBg: BackgroundConfig;
  onSaveBackground: (bg: BackgroundConfig) => void;
  userEmail?: string | null;
  onLogoutSuccess?: () => void;
}

const PRESETS = [
  {
    id: 'deep-purple',
    name: 'なすび宵 (深紫)',
    dataUrl: 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)',
  },
  {
    id: 'starry-sky',
    name: '星空ギャラクシー',
    dataUrl: 'radial-gradient(ellipse at 80% 20%, #312e81 0%, #0f172a 50%, #020617 100%)',
  },
  {
    id: 'warm-desk',
    name: '琥珀ウッド',
    dataUrl: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #451a03 100%)',
  },
  {
    id: 'tokyo-night',
    name: 'ミッドナイトブラック',
    dataUrl: 'linear-gradient(135deg, #030712 0%, #111827 50%, #1e293b 100%)',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentBg,
  onSaveBackground,
  userEmail,
  onLogoutSuccess,
}) => {
  // Background positioning state (integrated directly)
  const [isPositioningBg, setIsPositioningBg] = useState<boolean>(false);
  const [sourceImg, setSourceImg] = useState<string | null>(null);

  // SEPARATE TRANSFORMS FOR PORTRAIT AND LANDSCAPE
  // "背景に写真を選ぶ場合、縦と横で拡縮や位置は別で保持する"
  const [landscapeTransform, setLandscapeTransform] = useState<ImageTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [portraitTransform, setPortraitTransform] = useState<ImageTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [frameOrientation, setFrameOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize transforms from currentBg
  useEffect(() => {
    if (isOpen) {
      if (currentBg.type === 'custom' && currentBg.dataUrl) {
        setSourceImg(currentBg.dataUrl);
        setLandscapeTransform(
          currentBg.landscape || {
            scale: currentBg.scale || 1,
            offsetX: currentBg.offsetX || 0,
            offsetY: currentBg.offsetY || 0,
          }
        );
        setPortraitTransform(
          currentBg.portrait || {
            scale: currentBg.scale || 1,
            offsetX: currentBg.offsetX || 0,
            offsetY: currentBg.offsetY || 0,
          }
        );
      }
      setIsPositioningBg(false);
    }
  }, [isOpen, currentBg]);

  if (!isOpen) return null;

  const currentTransform = frameOrientation === 'landscape' ? landscapeTransform : portraitTransform;

  const updateCurrentTransform = (updater: (prev: ImageTransform) => ImageTransform) => {
    if (frameOrientation === 'landscape') {
      setLandscapeTransform(updater);
    } else {
      setPortraitTransform(updater);
    }
  };

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  // Handle selecting an image from file input with canvas compression
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);

        setSourceImg(compressed);
        setLandscapeTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setPortraitTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setIsPositioningBg(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - currentTransform.offsetX, y: e.clientY - currentTransform.offsetY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    updateCurrentTransform((prev) => ({
      ...prev,
      offsetX: newX,
      offsetY: newY,
    }));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Save selected custom image with SEPARATE landscape & portrait transforms
  const handleSaveCustom = () => {
    if (!sourceImg) return;
    onSaveBackground({
      type: 'custom',
      dataUrl: sourceImg,
      portrait: portraitTransform,
      landscape: landscapeTransform,
      scale: landscapeTransform.scale,
      offsetX: landscapeTransform.offsetX,
      offsetY: landscapeTransform.offsetY,
      brightness: 1,
      blur: 0,
    });
    setIsPositioningBg(false);
    onClose(); // Close modal immediately so user sees background applied to the clock!
  };

  // Select a preset directly
  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    onSaveBackground({
      type: 'preset',
      dataUrl: preset.dataUrl,
      portrait: { scale: 1, offsetX: 0, offsetY: 0 },
      landscape: { scale: 1, offsetX: 0, offsetY: 0 },
      brightness: 1,
      blur: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    onClose(); // Close modal immediately so user sees background applied to the clock!
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-lg max-h-[90vh] bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header: タイトル「設定」 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2">
            {isPositioningBg && (
              <button
                onClick={() => setIsPositioningBg(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer mr-1"
                title="設定一覧に戻る"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <img
              src="/icon.png"
              alt="ii-clock"
              className="w-6 h-6 rounded-full object-cover border border-purple-400/50 shadow"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-base font-bold text-white">
              {isPositioningBg ? '写真の位置・拡縮の調整' : '設定'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 text-xs md:text-sm">
          {isPositioningBg ? (
            /* ========================================================== */
            /* INTEGRATED BACKGROUND POSITIONING PANEL */
            /* ========================================================== */
            <div className="space-y-3">
              {/* Orientation Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-200 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-purple-400" />
                  <span>編集する向き:</span>
                </span>
                <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-purple-500/20 text-xs">
                  <button
                    onClick={() => setFrameOrientation('landscape')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg transition cursor-pointer font-medium ${
                      frameOrientation === 'landscape'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    横画面 (16:9)
                  </button>
                  <button
                    onClick={() => setFrameOrientation('portrait')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg transition cursor-pointer font-medium ${
                      frameOrientation === 'portrait'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    縦画面 (9:16)
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-purple-300/70">
                ※ 縦向き・横向きそれぞれ個別に位置と拡縮を調整・保持できます
              </div>

              {/* Preview Box with Frame */}
              <div className="relative w-full h-56 md:h-64 bg-black rounded-2xl overflow-hidden border border-purple-500/30 flex items-center justify-center select-none touch-none">
                <div
                  className={`relative overflow-hidden border-2 border-dashed border-amber-400/80 shadow-2xl transition-all duration-300 flex items-center justify-center ${
                    frameOrientation === 'landscape'
                      ? 'w-[90%] aspect-video max-h-[85%]'
                      : 'h-[90%] aspect-[9/16] max-w-[85%]'
                  }`}
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  {sourceImg && (
                    <img
                      src={sourceImg}
                      alt="カスタム背景"
                      className="absolute pointer-events-none max-w-none transition-transform duration-75"
                      style={{
                        transform: `translate(${currentTransform.offsetX}px, ${currentTransform.offsetY}px) scale(${currentTransform.scale})`,
                        transformOrigin: 'center center',
                      }}
                      draggable={false}
                    />
                  )}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-[10px] text-white/80 flex items-center gap-1 shadow">
                      <Move className="w-3 h-3 text-amber-300" />
                      <span>ドラッグで位置調整 ({frameOrientation === 'landscape' ? '横' : '縦'})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scale Zoom Controls for active orientation */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-purple-200">
                  <span className="flex items-center gap-1 font-medium">
                    <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> 拡大・縮小 ({frameOrientation === 'landscape' ? '横画面' : '縦画面'})
                  </span>
                  <span className="font-mono text-purple-300">{Math.round(currentTransform.scale * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateCurrentTransform((prev) => ({
                        ...prev,
                        scale: Math.max(0.5, Number((prev.scale - 0.1).toFixed(1))),
                      }))
                    }
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={currentTransform.scale}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateCurrentTransform((prev) => ({ ...prev, scale: val }));
                    }}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      updateCurrentTransform((prev) => ({
                        ...prev,
                        scale: Math.min(3.0, Number((prev.scale + 0.1).toFixed(1))),
                      }))
                    }
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      updateCurrentTransform(() => ({
                        scale: 1,
                        offsetX: 0,
                        offsetY: 0,
                      }))
                    }
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                    title="位置とサイズをリセット"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setIsPositioningBg(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition cursor-pointer"
                >
                  戻る
                </button>
                <button
                  onClick={handleSaveCustom}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>この設定で背景に適用</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* UNIFIED MAIN SETTINGS VIEW */
            /* ========================================================== */
            <>
              {/* 1. BACKGROUND SETTINGS */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-purple-200">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  <span>背景画像の設定</span>
                </div>

                {/* Button: 自分の写真・画像を使用する */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-900/30 border border-purple-400/40 transition cursor-pointer active:scale-98"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>自分の写真・画像を使用する</span>
                </button>

                {currentBg.type === 'custom' && currentBg.dataUrl && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-xs">
                    <span className="text-purple-200">カスタム写真が適用中</span>
                    <button
                      onClick={() => {
                        setSourceImg(currentBg.dataUrl);
                        setLandscapeTransform(
                          currentBg.landscape || {
                            scale: currentBg.scale || 1,
                            offsetX: currentBg.offsetX || 0,
                            offsetY: currentBg.offsetY || 0,
                          }
                        );
                        setPortraitTransform(
                          currentBg.portrait || {
                            scale: currentBg.scale || 1,
                            offsetX: currentBg.offsetX || 0,
                            offsetY: currentBg.offsetY || 0,
                          }
                        );
                        setIsPositioningBg(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-700/60 hover:bg-purple-600 text-white text-[11px] font-medium cursor-pointer"
                    >
                      位置・サイズ再調整
                    </button>
                  </div>
                )}

                {/* Preset Tiles */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-purple-300/80">プリセット背景から選ぶ</div>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map((p) => {
                      const isSelected = currentBg.type === 'preset' && currentBg.dataUrl === p.dataUrl;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPreset(p)}
                          className={`relative flex flex-col items-center justify-center h-16 rounded-xl border transition overflow-hidden cursor-pointer shadow group ${
                            isSelected
                              ? 'border-purple-400 ring-2 ring-purple-500'
                              : 'border-purple-500/20 hover:border-purple-500/60'
                          }`}
                          style={{ background: p.dataUrl }}
                        >
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                          <span className="relative z-10 font-bold text-[11px] text-white drop-shadow-md">
                            {p.name}
                          </span>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 2. CLOCK NUMERAL STYLE */}
              <section className="space-y-2 pt-3 border-t border-purple-500/20">
                <div className="font-semibold text-purple-200">時計文字盤の数字スタイル</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'arabic' as const, label: 'アラビア数字 (1..12)' },
                    { id: 'roman' as const, label: 'ローマ数字 (I..XII)' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => onUpdateSettings({ numeralStyle: style.id })}
                      className={`py-2 px-3 rounded-xl text-center text-xs border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        settings.numeralStyle === style.id
                          ? 'bg-purple-600 border-purple-400 text-white font-bold shadow'
                          : 'bg-black/30 border-purple-500/20 text-purple-300/70 hover:bg-purple-900/20'
                      }`}
                    >
                      {settings.numeralStyle === style.id && <Check className="w-3.5 h-3.5" />}
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 3. GOOGLE ACCOUNT STATUS */}
              {userEmail && (
                <section className="flex items-center justify-between pt-3 border-t border-purple-500/20 text-xs">
                  <span className="text-purple-300/80 truncate max-w-[200px]">
                    Google連携中: <strong className="text-white">{userEmail}</strong>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" /> ログアウト
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
