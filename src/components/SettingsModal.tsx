import React, { useState, useRef, useEffect } from 'react';
import { X, LogOut, Check, ZoomIn, ZoomOut, RotateCcw, Move, Smartphone, ImagePlus, Trash2 } from 'lucide-react';
import { logout } from '../services/firebase';

export interface ImageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface BackgroundConfig {
  type: 'custom' | 'preset';
  dataUrl: string; // If empty string or 'default', it uses なすび宵
  portrait: ImageTransform;
  landscape: ImageTransform;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  brightness?: number;
  blur?: number;
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

export const NASUBI_YOI_GRADIENT = 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)';

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
  // Photo source: if custom, it holds dataUrl; otherwise empty/null
  const [sourceImg, setSourceImg] = useState<string | null>(null);

  // Separate transforms for Portrait and Landscape
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

  // Init when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentBg.type === 'custom' && currentBg.dataUrl) {
        setSourceImg(currentBg.dataUrl);
        setLandscapeTransform(currentBg.landscape || { scale: 1, offsetX: 0, offsetY: 0 });
        setPortraitTransform(currentBg.portrait || { scale: 1, offsetX: 0, offsetY: 0 });
      } else {
        setSourceImg(null);
        setLandscapeTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setPortraitTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      }
    }
  }, [isOpen, currentBg]);

  if (!isOpen) return null;

  const currentTransform = frameOrientation === 'landscape' ? landscapeTransform : portraitTransform;

  const updateCurrentTransform = (updater: (prev: ImageTransform) => ImageTransform) => {
    if (frameOrientation === 'landscape') {
      const next = updater(landscapeTransform);
      setLandscapeTransform(next);
      if (sourceImg) {
        onSaveBackground({
          type: 'custom',
          dataUrl: sourceImg,
          landscape: next,
          portrait: portraitTransform,
        });
      }
    } else {
      const next = updater(portraitTransform);
      setPortraitTransform(next);
      if (sourceImg) {
        onSaveBackground({
          type: 'custom',
          dataUrl: sourceImg,
          landscape: landscapeTransform,
          portrait: next,
        });
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) onLogoutSuccess();
  };

  // Handle selecting an image from file input with canvas downscaling
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

        const newLand = { scale: 1, offsetX: 0, offsetY: 0 };
        const newPort = { scale: 1, offsetX: 0, offsetY: 0 };
        setSourceImg(compressed);
        setLandscapeTransform(newLand);
        setPortraitTransform(newPort);

        // Save immediately to background
        onSaveBackground({
          type: 'custom',
          dataUrl: compressed,
          landscape: newLand,
          portrait: newPort,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Reset to default "なすび宵 (深紫)"
  const handleResetToDefault = () => {
    setSourceImg(null);
    const defTrans = { scale: 1, offsetX: 0, offsetY: 0 };
    setLandscapeTransform(defTrans);
    setPortraitTransform(defTrans);
    onSaveBackground({
      type: 'preset',
      dataUrl: NASUBI_YOI_GRADIENT,
      landscape: defTrans,
      portrait: defTrans,
    });
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!sourceImg) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - currentTransform.offsetX, y: e.clientY - currentTransform.offsetY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !sourceImg) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-lg max-h-[92vh] bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header: 「設定」 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2">
            <img
              src="/icon.png"
              alt="ii-clock"
              className="w-6 h-6 rounded-full object-cover border border-purple-400/50 shadow"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-base font-bold text-white">設定</h2>
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

        {/* Settings Body: 1 single screen with photo adjustment and numeral style */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 text-xs md:text-sm">
          {/* ========================================================== */}
          {/* 1. BACKGROUND PHOTO ADJUSTMENT FRAME */}
          {/* ========================================================== */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-200 flex items-center gap-1.5 text-xs">
                <Move className="w-4 h-4 text-purple-400" />
                <span>写真の位置・拡縮の調整</span>
              </span>

              {/* Orientation toggle */}
              <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-xl border border-purple-500/20 text-[11px]">
                <button
                  onClick={() => setFrameOrientation('landscape')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                    frameOrientation === 'landscape'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  横画面 (16:9)
                </button>
                <button
                  onClick={() => setFrameOrientation('portrait')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
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

            {/* Interactive Frame Box */}
            <div
              className="relative w-full h-52 md:h-60 bg-black rounded-2xl overflow-hidden border border-purple-500/30 flex items-center justify-center select-none touch-none cursor-pointer"
              onClick={() => {
                if (!sourceImg) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <div
                className={`relative overflow-hidden border-2 border-dashed border-amber-400/80 shadow-2xl transition-all duration-300 flex items-center justify-center ${
                  frameOrientation === 'landscape'
                    ? 'w-[92%] aspect-video max-h-[88%]'
                    : 'h-[92%] aspect-[9/16] max-w-[88%]'
                }`}
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {sourceImg ? (
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
                ) : (
                  /* If no custom photo, display なすび宵（深紫）! */
                  <div
                    className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-center p-3"
                    style={{ background: NASUBI_YOI_GRADIENT }}
                  >
                    <ImagePlus className="w-7 h-7 text-purple-300/80 mb-1" />
                    <span className="text-xs font-bold text-white drop-shadow">
                      なすび宵 (深紫)
                    </span>
                    <span className="text-[10px] text-purple-300/80 mt-0.5">
                      タップして写真を選択
                    </span>
                  </div>
                )}

                {sourceImg && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-[10px] text-white/80 flex items-center gap-1 shadow">
                      <Move className="w-3 h-3 text-amber-300" />
                      <span>ドラッグで移動 ({frameOrientation === 'landscape' ? '横' : '縦'})</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Action Controls (when photo is set) */}
            {sourceImg ? (
              <div className="space-y-2">
                {/* Scale slider */}
                <div className="p-2 rounded-xl bg-black/40 border border-purple-500/20 space-y-1">
                  <div className="flex items-center justify-between text-xs text-purple-200">
                    <span className="flex items-center gap-1 font-medium text-[11px]">
                      <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> 拡大・縮小 ({frameOrientation === 'landscape' ? '横画面' : '縦画面'})
                    </span>
                    <span className="font-mono text-purple-300 text-xs">{Math.round(currentTransform.scale * 100)}%</span>
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
                      <ZoomOut className="w-3.5 h-3.5" />
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
                      <ZoomIn className="w-3.5 h-3.5" />
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
                      title="リセット"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Change photo & Remove photo ("設定なし"とできる画面) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 text-xs font-semibold cursor-pointer active:scale-95"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>写真を変更する</span>
                  </button>
                  <button
                    onClick={handleResetToDefault}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 text-xs font-medium cursor-pointer active:scale-95"
                    title="写真を解除してデフォルトのなすび宵に戻す"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>設定なし</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/40 transition cursor-pointer active:scale-98"
              >
                <ImagePlus className="w-4 h-4" />
                <span>写真を選択する</span>
              </button>
            )}
          </section>

          {/* ========================================================== */}
          {/* 2. CLOCK NUMERAL STYLE */}
          {/* ========================================================== */}
          <section className="space-y-2 pt-3 border-t border-purple-500/20">
            <div className="font-semibold text-purple-200 text-xs">時計文字盤の数字スタイル</div>
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

          {/* ========================================================== */}
          {/* 3. GOOGLE ACCOUNT STATUS */}
          {/* ========================================================== */}
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

          {/* Close button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition cursor-pointer active:scale-98"
            >
              設定を閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
