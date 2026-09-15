import React, { forwardRef, useMemo } from 'react';
import { generateQrMatrix, type QrErrorCorrectionLevel } from '../utils/qrcodegen';

export interface QRCodeProps extends React.SVGProps<SVGSVGElement> {
  value: string;
  size?: number;
  level?: QrErrorCorrectionLevel;
  bgColor?: string;
  fgColor?: string;
  margin?: number;
  title?: string;
}

/**
 * High-performance, self-contained SVG QR Code Component.
 * - Zero external npm dependencies.
 * - 100% vector, crisp at any display density.
 * - Compatible with Android System WebView, iOS, and all desktop browsers.
 * - Serializes cleanly to XMLSerializer for instant offscreen canvas rendering / image export.
 */
export const QRCodeSVG = forwardRef<SVGSVGElement, QRCodeProps>(
  (
    {
      value,
      size = 256,
      level = 'M',
      bgColor = '#FFFFFF',
      fgColor = '#000000',
      margin = 4,
      title,
      style,
      className,
      ...rest
    },
    ref
  ) => {
    // Generate boolean matrix from QR Code Model 2 standard (Versions 1-40)
    const matrix = useMemo(() => {
      return generateQrMatrix(value, level);
    }, [value, level]);

    const moduleCount = matrix.length;
    const quietZone = margin;
    const viewBoxDimension = moduleCount > 0 ? moduleCount + quietZone * 2 : 256;

    // Single SVG path for dark modules with crispEdges rendering
    const pathData = useMemo(() => {
      if (moduleCount === 0) return '';
      let d = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (matrix[r][c]) {
            d += `M${c + quietZone},${r + quietZone}h1v1h-1z `;
          }
        }
      }
      return d;
    }, [matrix, moduleCount, quietZone]);

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${viewBoxDimension} ${viewBoxDimension}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        style={{
          display: 'block',
          ...style,
        }}
        className={className}
        role="img"
        aria-label={title || 'QR Code'}
        {...rest}
      >
        {title && <title>{title}</title>}
        {/* Background layer */}
        <rect width="100%" height="100%" fill={bgColor} />
        {/* Foreground QR modules */}
        {pathData && <path d={pathData} fill={fgColor} />}
      </svg>
    );
  }
);

QRCodeSVG.displayName = 'QRCodeSVG';

export interface QRCodeCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  value: string;
  size?: number;
  level?: QrErrorCorrectionLevel;
  bgColor?: string;
  fgColor?: string;
  margin?: number;
}

/**
 * Self-contained HTML5 Canvas QR Code Component.
 */
export const QRCodeCanvas = forwardRef<HTMLCanvasElement, QRCodeCanvasProps>(
  (
    {
      value,
      size = 256,
      level = 'M',
      bgColor = '#FFFFFF',
      fgColor = '#000000',
      margin = 4,
      style,
      className,
      ...rest
    },
    ref
  ) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    const matrix = useMemo(() => {
      return generateQrMatrix(value, level);
    }, [value, level]);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const moduleCount = matrix.length;
      if (moduleCount === 0) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        return;
      }

      const totalModules = moduleCount + margin * 2;
      const cellSize = size / totalModules;

      // Fill background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Fill modules
      ctx.fillStyle = fgColor;
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (matrix[r][c]) {
            ctx.fillRect(
              Math.floor((c + margin) * cellSize),
              Math.floor((r + margin) * cellSize),
              Math.ceil(cellSize),
              Math.ceil(cellSize)
            );
          }
        }
      }
    }, [matrix, size, bgColor, fgColor, margin]);

    return (
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          display: 'block',
          maxWidth: '100%',
          ...style,
        }}
        className={className}
        {...rest}
      />
    );
  }
);

QRCodeCanvas.displayName = 'QRCodeCanvas';

// Default export is QRCodeCanvas for drop-in replacement that renders safely in html-to-image
export const QRCode = QRCodeCanvas;
export default QRCodeCanvas;
