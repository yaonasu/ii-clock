import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw, Check, X, SwitchCamera, Sliders, Sparkles } from 'lucide-react';

export interface BackgroundConfig {
  type: 'custom' | 'preset';
  dataUrl: string;
  brightness: number; // 0.1 to 1.0 (dim overlay)
  blur: number; // px
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

// Default presets with aesthetic SVG/Canvas gradient data or abstract wallpaper
const PRESETS = [
  {
    id: 'deep-purple',
    name: 'なすび宵 (紫紺)',
    preview: 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)',
    dataUrl: 'linear-gradient(135deg, #090314 0%, #1a0826 40%, #2e1065 80%, #05020a 100%)',
  },
  {
    id: 'starry-sky',
    name: '星空ギャラクシー',
    preview: 'linear-gradient(to bottom, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
    dataUrl: 'radial-gradient(ellipse at 80% 20%, #312e81 0%, #0f172a 50%, #020617 100%)',
  },
  {
    id: 'warm-desk',
    name: '琥珀ウッド',
    preview: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #451a03 100%)',
    dataUrl: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #451a03 100%)',
  },
  {
    id: 'tokyo-night',
    name: '深夜の摩天楼',
    preview: 'linear-gradient(135deg, #030712 0%, #111827 50%, #1e293b 100%)',
    dataUrl: 'linear-gradient(135deg, #030712 0%, #111827 50%, #1e293b 100%)',
  },
];

export const BackgroundCropperModal: React.FC<BackgroundCropperModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveBackground,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'preset' | 'crop'>('preset');

  // Image editing state
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [dimLevel, setDimLevel] = useState<number>(0.5); // overlay darkness
  const [blurLevel, setBlurLevel] = useState<number>(0);

  // Camera state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas ref for cropping & rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dragging for pan
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Init from current
  useEffect(() => {
    if (isOpen) {
      if (currentConfig.type === 'custom' && currentConfig.dataUrl.startsWith('data:image')) {
        setSourceImg(currentConfig.dataUrl);
        setScale(currentConfig.scale || 1);
        setOffsetX(currentConfig.offsetX || 0);
        setOffsetY(currentConfig.offsetY || 0);
        setDimLevel(1 - currentConfig.brightness);
        setBlurLevel(currentConfig.blur || 0);
        setActiveTab('crop');
      } else {
        setActiveTab('preset');
      }
    } else {
      stopCamera();
    }
  }, [isOpen, currentConfig]);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(`カメラへのアクセスに失敗しました (${msg})。カメラの許可設定を確認してください。`);
      setCameraActive(false);
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture photo from camera
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Flip if user facing
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    setSourceImg(dataUrl);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setActiveTab('crop');
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSourceImg(result);
        setScale(1);
        setOffsetX(0);
        setOffsetY(0);
        setActiveTab('crop');
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag to pan image on crop area
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - offsetX, y: e.touches[0].clientY - offsetY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffsetX(e.touches[0].clientX - dragStart.x);
    setOffsetY(e.touches[0].clientY - dragStart.y);
  };

  // Export cropped & processed image to canvas
  const handleSaveCrop = () => {
    if (!sourceImg) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetW = 1920;
      const targetH = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetW, targetH);

      // Calculate centered scaling
      ctx.save();
      ctx.translate(targetW / 2 + offsetX * 2, targetH / 2 + offsetY * 2);
      ctx.scale(scale, scale);

      // Fit to cover target area
      const imgRatio = img.width / img.height;
      const targetRatio = targetW / targetH;
      let drawW, drawH;
      if (imgRatio > targetRatio) {
        drawH = targetH;
        drawW = targetH * imgRatio;
      } else {
        drawW = targetW;
        drawH = targetW / imgRatio;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      onSaveBackground({
        type: 'custom',
        dataUrl: finalDataUrl,
        brightness: 1 - dimLevel,
        blur: blurLevel,
        scale,
        offsetX,
        offsetY,
      });
      onClose();
    };
    img.src = sourceImg;
  };

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    onSaveBackground({
      type: 'preset',
      dataUrl: preset.dataUrl,
      brightness: 0.9,
      blur: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 text-white select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-purple-500/40 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-purple-950/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍆</span>
            <h2 className="text-base md:text-lg font-bold text-white">
              背景画像の設定・切り出し
            </h2>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-purple-500/20 bg-black/40 text-xs md:text-sm">
          <button
            onClick={() => {
              stopCamera();
              setActiveTab('preset');
            }}
            className={`flex-1 py-3 px-2 text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'preset'
                ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-950/30'
                : 'text-purple-200/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> プリセット
          </button>

          <button
            onClick={() => {
              stopCamera();
              fileInputRef.current?.click();
            }}
            className={`flex-1 py-3 px-2 text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-950/30'
                : 'text-purple-200/60 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> 写真ファイル
          </button>

          <button
            onClick={() => {
              setActiveTab('camera');
              startCamera(facingMode);
            }}
            className={`flex-1 py-3 px-2 text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'camera'
                ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-950/30'
                : 'text-purple-200/60 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" /> カメラで撮影
          </button>

          {sourceImg && (
            <button
              onClick={() => {
                stopCamera();
                setActiveTab('crop');
              }}
              className={`flex-1 py-3 px-2 text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'crop'
                  ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-950/30'
                  : 'text-purple-200/60 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" /> 拡縮・切り出し
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* TAB 1: PRESETS */}
          {activeTab === 'preset' && (
            <div className="space-y-4">
              <p className="text-xs text-purple-200/80">
                お好みの背景テーマをお選びください。置時計の針やタイマーが引き立つ美しいグラデーションです。
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="group relative rounded-2xl p-4 h-28 flex flex-col justify-end text-left border border-purple-500/20 hover:border-purple-400/80 transition-all shadow-md overflow-hidden cursor-pointer"
                    style={{ background: preset.preview }}
                  >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition" />
                    <span className="relative z-10 text-sm font-bold text-white drop-shadow">
                      {preset.name}
                    </span>
                    <span className="relative z-10 text-[10px] text-purple-200/80">
                      タップで適用
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/40 hover:bg-purple-600/70 border border-purple-400/40 text-xs font-medium text-white transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" /> 自分の写真・画像を使用する
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CAMERA */}
          {activeTab === 'camera' && (
            <div className="flex flex-col items-center space-y-4">
              {cameraError ? (
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 text-center">
                  {cameraError}
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="block mx-auto mt-2 px-3 py-1 bg-rose-600 rounded-lg text-white"
                  >
                    再試行
                  </button>
                </div>
              ) : (
                <div className="relative w-full max-w-lg aspect-video bg-black rounded-2xl overflow-hidden border border-purple-500/40 shadow-inner">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />
                  {/* Framing Grid overlay */}
                  <div className="absolute inset-0 border-2 border-dashed border-white/20 pointer-events-none grid grid-cols-2">
                    <div className="border-r border-dashed border-white/20 flex items-center justify-center">
                      <span className="text-[11px] bg-black/50 px-2 py-0.5 rounded text-purple-200">
                        時計側
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-[11px] bg-black/50 px-2 py-0.5 rounded text-purple-200">
                        タイマー側
                      </span>
                    </div>
                  </div>

                  {/* Switch camera button */}
                  <button
                    onClick={handleSwitchCamera}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur transition cursor-pointer"
                    title="カメラ切替"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Shutter Button */}
              {cameraActive && !cameraError && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCapturePhoto}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 font-semibold text-sm text-white shadow-lg shadow-purple-900/50 transition cursor-pointer active:scale-95"
                  >
                    <Camera className="w-5 h-5" /> 写真を撮影して切り出しへ
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CROP & SCALE */}
          {activeTab === 'crop' && sourceImg && (
            <div className="space-y-4">
              <p className="text-xs text-purple-200/80">
                画像をドラッグして位置を調整し、スライダーで拡大・縮小や暗さを調整できます。
              </p>

              {/* Interactive Cropping Viewport */}
              <div
                className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-inner cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
              >
                {/* Image under transform */}
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                  }}
                >
                  <img
                    src={sourceImg}
                    alt="Crop preview"
                    className="max-w-none w-full h-full object-cover pointer-events-none"
                    style={{
                      filter: `blur(${blurLevel}px)`,
                    }}
                  />
                </div>

                {/* Darkness overlay filter preview */}
                <div
                  className="absolute inset-0 bg-black pointer-events-none transition-opacity"
                  style={{ opacity: dimLevel }}
                />

                {/* Clock & Widget layout preview guide */}
                <div className="absolute inset-0 border border-white/20 pointer-events-none grid grid-cols-2">
                  <div className="border-r border-white/20 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full border border-purple-300/40 bg-purple-900/20 flex items-center justify-center">
                      <span className="text-xl">🍆</span>
                    </div>
                    <span className="text-[10px] text-white/70 mt-1 bg-black/40 px-1.5 py-0.5 rounded">
                      時計配置エリア
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                      タイマー・予定エリア
                    </span>
                  </div>
                </div>
              </div>

              {/* Sliders & Controls */}
              <div className="space-y-3 bg-black/30 p-3 rounded-2xl border border-purple-500/10">
                {/* Scale slider */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-200 w-16 shrink-0 flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" /> 拡縮
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono w-10 text-right">{scale.toFixed(2)}x</span>
                  <button
                    onClick={() => {
                      setScale(1);
                      setOffsetX(0);
                      setOffsetY(0);
                    }}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-purple-200 text-xs"
                    title="位置・拡縮リセット"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                {/* Dimming / Darkness overlay slider */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-200 w-16 shrink-0">暗さ</span>
                  <input
                    type="range"
                    min="0"
                    max="0.85"
                    step="0.05"
                    value={dimLevel}
                    onChange={(e) => setDimLevel(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono w-10 text-right">
                    {Math.round(dimLevel * 100)}%
                  </span>
                </div>

                {/* Blur slider */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-200 w-16 shrink-0">ぼかし</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={blurLevel}
                    onChange={(e) => setBlurLevel(parseInt(e.target.value))}
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono w-10 text-right">{blurLevel}px</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preset')}
                  className="px-4 py-2 rounded-xl text-xs bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
                >
                  戻る
                </button>
                <button
                  type="button"
                  onClick={handleSaveCrop}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-900/40 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> この背景を保存して適用
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
