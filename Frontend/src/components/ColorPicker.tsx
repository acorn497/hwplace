import React, { useRef, useEffect, useCallback, useState } from "react";
import { Pixel } from "./Types";

type ColorPickerProps = {
  color: Pixel;
  onChange: (color: Pixel) => void;
  width?: number;
  height?: number;
};

const ColorPickerComponent: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  width = 200,
  height = 200
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);

  const drawGradient = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw horizontal hue gradient
    const gradH = ctx.createLinearGradient(0, 0, width, 0);
    gradH.addColorStop(0, "red");
    gradH.addColorStop(0.17, "yellow");
    gradH.addColorStop(0.33, "green");
    gradH.addColorStop(0.5, "cyan");
    gradH.addColorStop(0.67, "blue");
    gradH.addColorStop(0.83, "magenta");
    gradH.addColorStop(1, "red");
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, width, height);

    // Draw vertical saturation/brightness gradient
    const gradV = ctx.createLinearGradient(0, 0, 0, height);
    gradV.addColorStop(0, "rgba(255,255,255,1)");
    gradV.addColorStop(0.5, "rgba(255,255,255,0)");
    gradV.addColorStop(0.5, "rgba(0,0,0,0)");
    gradV.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, width, height);

    // Draw selection indicator if position is set
    if (selectedPosition) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selectedPosition.x, selectedPosition.y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(selectedPosition.x, selectedPosition.y, 6, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }, [width, height, selectedPosition]);

  useEffect(() => {
    drawGradient();
  }, [drawGradient]);

  const pickColor = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use offsetX/offsetY to avoid border/padding offsets and ensure precise mapping
    const nativeEvent = e.nativeEvent as MouseEvent;
    const offsetX = nativeEvent.offsetX;
    const offsetY = nativeEvent.offsetY;

    // Adjust for potential CSS scaling vs canvas resolution
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width - 0);
    const scaleY = canvas.height / (rect.height - 0);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(offsetX * scaleX)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(offsetY * scaleY)));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    onChange({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setSelectedPosition({ x, y });
  }, [onChange]);

  const handleRGBChange = useCallback((field: 'r' | 'g' | 'b', value: string) => {
    const numValue = Math.max(0, Math.min(255, parseInt(value) || 0));
    onChange({ ...color, [field]: numValue });
  }, [color, onChange]);


  return (
    <div className="flex flex-col gap-2">
      {/* Color Palette */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={pickColor}
        className="hover: cursor-crosshair border border-border-primary rounded-sm"
        onMouseMove={e => e.buttons === 1 && pickColor(e)}
      />

      {/* Current Color Display */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 border border-border-primary rounded"
          style={{ backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, 1)` }}
        />
        <span className="text-sm text-white">
          RGB({color.r}, {color.g}, {color.b})
        </span>
      </div>

      {/* RGB Input Fields */}
      <div className="flex gap-1">
        <div className="flex flex-col items-center">
          <label className="text-sm text-red-500 font-medium">R</label>
          <input
            type="number"
            min="0"
            max="255"
            value={color.r}
            onChange={(e) => handleRGBChange('r', e.target.value)}
            className="w-12 px-1 py-0.5 text-sm border border-border-primary rounded text-center"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="text-sm text-green-500 font-medium">G</label>
          <input
            type="number"
            min="0"
            max="255"
            value={color.g}
            onChange={(e) => handleRGBChange('g', e.target.value)}
            className="w-12 px-1 py-0.5 text-sm border border-border-primary rounded text-center"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="text-sm text-blue-500 font-medium">B</label>
          <input
            type="number"
            min="0"
            max="255"
            value={color.b}
            onChange={(e) => handleRGBChange('b', e.target.value)}
            className="w-12 px-1 py-0.5 text-sm border border-border-primary rounded text-center"
          />
        </div>
      </div>
    </div>
  );
};

export default ColorPickerComponent;