import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import type { LanguageCode } from '../utils/i18n';

export interface ImageCropModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
  lang?: LanguageCode;
  title?: string;
  outputSize?: number; // default 300px
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
  lang = 'en',
  title,
  outputSize = 300,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const isTl = lang === 'tl';
  const modalTitle = title || (isTl ? 'Ayusin at I-crop ang Litrato' : 'Crop & Adjust Photo');

  // Viewport display size in CSS pixels
  const CROP_BOX_SIZE = 260;

  // Load natural image dimensions when imageSrc changes
  useEffect(() => {
    if (!imageSrc || !isOpen) {
      setImageLoaded(false);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // Pointer/Mouse Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX - offset.x,
      y: clientY - offset.y,
    };
  };

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const nextX = clientX - dragStartRef.current.x;
      const nextY = clientY - dragStartRef.current.y;

      // Restrict offset within bounds based on zoom
      const maxBound = (CROP_BOX_SIZE * zoom) / 1.5;
      const clampedX = Math.max(-maxBound, Math.min(maxBound, nextX));
      const clampedY = Math.max(-maxBound, Math.min(maxBound, nextY));

      setOffset({ x: clampedX, y: clampedY });
    },
    [isDragging, zoom]
  );

  const handlePointerUp = () => {
    setIsDragging(false);
    pinchStartDistanceRef.current = null;
  };

  // Multi-touch Pinch to Zoom calculation
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDragging(false);
      pinchStartDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      pinchStartZoomRef.current = zoom;
    } else if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / pinchStartDistanceRef.current;
      const nextZoom = Math.max(1, Math.min(3.5, pinchStartZoomRef.current * scale));
      setZoom(Number(nextZoom.toFixed(2)));
    } else if (e.touches.length === 1 && isDragging) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Mouse Wheel / Trackpad Pinch Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.002;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(1, Math.min(3.5, prevZoom + zoomDelta));
      return Number(nextZoom.toFixed(2));
    });
  };

  // Perform Final Crop on Canvas
  const handleSaveCrop = () => {
    const img = imageRef.current;
    if (!img || !imageLoaded) return;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scaling ratio
    const imgAspect = naturalSize.width / naturalSize.height;
    let baseRenderW = CROP_BOX_SIZE;
    let baseRenderH = CROP_BOX_SIZE;

    if (imgAspect > 1) {
      baseRenderW = CROP_BOX_SIZE * imgAspect;
    } else {
      baseRenderH = CROP_BOX_SIZE / imgAspect;
    }

    const currentRenderW = baseRenderW * zoom;
    const currentRenderH = baseRenderH * zoom;

    // Center coordinates
    const centerX = CROP_BOX_SIZE / 2 + offset.x;
    const centerY = CROP_BOX_SIZE / 2 + offset.y;

    const renderX = centerX - currentRenderW / 2;
    const renderY = centerY - currentRenderH / 2;

    // Scale to output canvas
    const scaleRatio = outputSize / CROP_BOX_SIZE;

    ctx.drawImage(
      img,
      renderX * scaleRatio,
      renderY * scaleRatio,
      currentRenderW * scaleRatio,
      currentRenderH * scaleRatio
    );

    // Convert to webp/png Blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      },
      'image/webp',
      0.9
    );
  };

  if (!isOpen || !imageSrc) return null;

  // Base dimensions calculation for preview positioning
  const imgAspect = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1;
  let baseW = CROP_BOX_SIZE;
  let baseH = CROP_BOX_SIZE;

  if (imgAspect > 1) {
    baseW = CROP_BOX_SIZE * imgAspect;
  } else {
    baseH = CROP_BOX_SIZE / imgAspect;
  }

  const renderW = baseW * zoom;
  const renderH = baseH * zoom;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="theme-card rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border flex flex-col gap-4 text-xs sm:text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b theme-border-subtle">
          <h3 className="font-extrabold theme-text-app text-sm sm:text-base">{modalTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full theme-text-secondary hover:theme-text-app hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropping Viewport */}
        <div className="flex flex-col items-center">
          <div
            className="relative overflow-hidden rounded-2xl bg-slate-950 border-2 border-amber-500/40 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ width: `${CROP_BOX_SIZE}px`, height: `${CROP_BOX_SIZE}px` }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handlePointerUp}
            onWheel={handleWheel}
          >
            {imageLoaded && (
              <img
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                className="absolute pointer-events-none transition-transform duration-75 ease-out select-none max-w-none"
                style={{
                  width: `${renderW}px`,
                  height: `${renderH}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}

            {/* Circular Crop Guide Mask */}
            <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
          </div>

          <p className="text-[11px] theme-text-secondary mt-2 text-center font-medium">
            {isTl ? 'I-drag para iposisyon • I-pinch o gamitin ang slider para i-zoom' : 'Drag to reposition • Pinch or slide to zoom'}
          </p>
        </div>

        {/* Zoom Slider Drag & Reset */}
        <div className="p-3 rounded-2xl theme-bg-surface-subtle border theme-border-subtle flex items-center gap-3">
          <span className="text-[11px] font-black theme-text-secondary shrink-0 w-8">
            {zoom.toFixed(1)}x
          </span>
          <input
            type="range"
            min="1"
            max="3.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
          />
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded-xl theme-bg-surface hover:theme-card border theme-border-subtle theme-text-secondary hover:theme-text-app cursor-pointer transition-colors active:scale-95"
            title={isTl ? 'I-reset ang laki at pwesto' : 'Reset Size & Position'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t theme-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl theme-text-secondary hover:bg-white/10 font-bold cursor-pointer text-xs"
          >
            {isTl ? 'Kanselahin' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            className="theme-bg-primary text-white font-extrabold px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs"
          >
            <Check className="w-4 h-4" />
            <span>{isTl ? 'I-crop at Gamitin' : 'Crop & Apply'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
