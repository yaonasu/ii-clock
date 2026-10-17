import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw, Check, X, ArrowLeft, Move, Smartphone } from 'lucide-react';

export interface BackgroundConfig {
  type: 'custom' | 'preset';
  dataUrl: string;
  brightness: number;
  blur: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface BackgroundCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: BackgroundConfig;
  onSaveBackground: (config: BackgroundConfig) => void;
}

// Preset backgrounds
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

export const BackgroundCropperModal: React.FC<BackgroundCropperModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveBackground,
}) => {
  // Mode: 'preset' or 'positioning'
  const [mode, setMode] = useState<'preset' | 'positioning'>('preset');

  // Selected image for positioning
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);

  // Frame orientation for preview: 'landscape' (16:9) or 'portrait' (9:16)
  const [frameOrientation, setFrameOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      if (currentConfig.type === 'custom' && currentConfig.dataUrl.startsWith('data:image')) {
        setSourceImg(currentConfig.dataUrl);
        setScale(currentConfig.scale || 1);
        setOffsetX(currentConfig.offsetX || 0);
        setOffsetY(currentConfig.offsetY || 0);
      }
      setMode('preset');
    }
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  // Handle selecting a custom image from file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSourceImg(result);
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setMode('positioning');
    };
    reader.readAsDataURL(file);
    // Reset file input value
    e.target.value = '';
  };

  // Drag handlers for image positioning
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Save selected custom image
  const handleSaveCustom = () => {
    if (!sourceImg) return;
    onSaveBackground({
      type: 'custom',
      dataUrl: sourceImg,
      brightness: 1, // No brightness filter
      blur: 0, // No blur filter
      scale,
      offsetX,
      offsetY,
    });
    onClose();
  };

  // Select a preset directly
  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    onSaveBackground({
      type: 'preset',
      dataUrl: preset.dataUrl,
      brightness: 1,
      blur: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-xl max-h-[92vh] bg-slate-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header (No tabs!) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2">
            {mode === 'positioning' ? (
              <button
                onClick={() => setMode('preset')}
                className="p-1 rounded-lg hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer mr-1"
                title="プリセット一覧に戻る"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">
              {mode === 'positioning' ? '写真の位置・拡縮の調整' : '背景画像の設定'}
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

        {/* Content Body */}
        {mode === 'preset' ? (
          /* PRESET VIEW (Default screen) */
          <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
            {/* Primary Action Button: 自分の写真・画像を使用する */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 border border-purple-400/40 transition cursor-pointer active:scale-98"
            >
              <ImageIcon className="w-5 h-5" />
              <span>自分の写真・画像を使用する</span>
            </button>

            {/* If user previously had a custom image */}
            {sourceImg && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-purple-500/20 text-xs">
                <span className="text-purple-200">設定中のカスタム写真があります</span>
                <button
                  onClick={() => setMode('positioning')}
                  className="px-3 py-1 rounded-lg bg-purple-700/60 hover:bg-purple-600 text-white font-medium cursor-pointer"
                >
                  位置・拡縮を再調整
                </button>
              </div>
            )}

            {/* Preset Tiles */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-purple-300/80">プリセット背景から選ぶ</div>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((p) => {
                  const isSelected = currentConfig.type === 'preset' && currentConfig.dataUrl === p.dataUrl;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`relative flex flex-col items-center justify-center h-24 rounded-2xl border transition overflow-hidden cursor-pointer shadow group ${
                        isSelected
                          ? 'border-purple-400 ring-2 ring-purple-500'
                          : 'border-purple-500/20 hover:border-purple-500/60'
                      }`}
                      style={{ background: p.dataUrl }}
                    >
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                      <span className="relative z-10 font-bold text-xs text-white drop-shadow-md">
                        {p.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* POSITIONING VIEW (Image behind orientation frame with drag & scale) */
          <div className="flex flex-col flex-1 p-4 md:p-5 space-y-3 overflow-y-auto">
            {/* Orientation Frame Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-200 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-purple-400" />
                <span>画面枠の基準:</span>
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

            {/* Interactive Preview Canvas / Container with Frame */}
            <div className="relative w-full h-64 md:h-72 bg-black rounded-2xl overflow-hidden border border-purple-500/30 flex items-center justify-center select-none touch-none">
              {/* Screen Frame Border */}
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
                {/* Background Image placed behind */}
                {sourceImg && (
                  <img
                    src={sourceImg}
                    alt="カスタム背景"
                    className="absolute pointer-events-none max-w-none transition-transform duration-75"
                    style={{
                      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                      transformOrigin: 'center center',
                    }}
                    draggable={false}
                  />
                )}

                {/* Helpful drag indicator overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-[10px] text-white/80 flex items-center gap-1 shadow">
                    <Move className="w-3 h-3 text-amber-300" />
                    <span>ドラッグで移動</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scale / Zoom Slider & Controls (No brightness or blur!) */}
            <div className="p-3 rounded-2xl bg-black/40 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-purple-200">
                <span className="flex items-center gap-1 font-medium">
                  <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> 拡大・縮小
                </span>
                <span className="font-mono text-purple-300">{Math.round(scale * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(1))))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                  title="縮小"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <button
                  onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.1).toFixed(1))))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                  title="拡大"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setScale(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                  title="位置とサイズをリセット"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setMode('preset')}
                className="w-1/3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition cursor-pointer"
              >
                戻る
              </button>
              <button
                onClick={handleSaveCustom}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>この位置で背景に設定</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
