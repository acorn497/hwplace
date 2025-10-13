import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Pixel } from "./Types";

type CanvasProps = {
  width: number;
  height: number;
  pixelSize: number;
  offsetX: number;
  offsetY: number;
  mousePixelPos: { x: number; y: number } | null;
  pinnedPositions: { x: number; y: number }[];
  onPinnedPositionsChange: (newPositions: { x: number; y: number }[]) => void;
  pixelData: Pixel[][];
  onPan: (deltaX: number, deltaY: number) => void;
  onZoom: (delta: number, centerX?: number, centerY?: number) => void;
  onMouseMove: (pixelX: number, pixelY: number) => void;
  onPixelClick: (pixelX: number, pixelY: number) => void;
  isGridActive: boolean;
  isPickFromCanvas?: boolean;
  onPickColorAt?: (x: number, y: number) => void;
};

const GRID_COLOR = "#cccccc";
const PIN_COLOR = "#dc2626";
const PIN_BORDER_COLOR = "#ffffff";
const SELECTION_COLOR = "#10b981";
const MOUSE_HIGHLIGHT_COLOR = "#1d4ed8";
const MIN_PIXEL_SIZE_FOR_HIGHLIGHT = 2;

const Canvas: React.FC<CanvasProps> = ({
  width,
  height,
  pixelSize,
  offsetX,
  offsetY,
  mousePixelPos,
  pinnedPositions,
  onPinnedPositionsChange,
  pixelData,
  onPan,
  onZoom,
  onMouseMove,
  onPixelClick,
  isGridActive,
  isPickFromCanvas = false,
  onPickColorAt,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [draggedPixels, setDraggedPixels] = useState<{ x: number; y: number }[]>([]);

  const draggedPixelsSet = useMemo(() => 
    new Set(draggedPixels.map(p => `${p.x},${p.y}`)), 
    [draggedPixels]
  );

  const pinnedPositionsSet = useMemo(() => 
    new Set(pinnedPositions.map(p => `${p.x},${p.y}`)), 
    [pinnedPositions]
  );

  const pinRadius = useMemo(() => Math.min(pixelSize / 3, 8), [pixelSize]);

  const drawCanvas = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const tx = Math.round(offsetX);
      const ty = Math.round(offsetY);
      ctx.translate(tx, ty);

      const startX = Math.max(0, Math.floor(-tx / pixelSize));
      const endX = Math.min(width, Math.ceil((canvas.width - tx) / pixelSize));
      const startY = Math.max(0, Math.floor(-ty / pixelSize));
      const endY = Math.min(height, Math.ceil((canvas.height - ty) / pixelSize));

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const color = pixelData[y]?.[x] || { r: 255, g: 255, b: 255 };
          ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }

      if (isGridActive) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let x = startX; x <= endX; x++) {
          const xPos = x * pixelSize + 0.5;
          ctx.moveTo(xPos, startY * pixelSize);
          ctx.lineTo(xPos, endY * pixelSize);
        }
        for (let y = startY; y <= endY; y++) {
          const yPos = y * pixelSize + 0.5;
          ctx.moveTo(startX * pixelSize, yPos);
          ctx.lineTo(endX * pixelSize, yPos);
        }
        ctx.stroke();
      }

      pinnedPositions.forEach((pos) => {
        if (pos.x >= startX && pos.x < endX && pos.y >= startY && pos.y < endY) {
          const centerX = pos.x * pixelSize + pixelSize / 2;
          const centerY = pos.y * pixelSize + pixelSize / 2;
          ctx.fillStyle = PIN_COLOR;
          ctx.beginPath();
          ctx.arc(centerX, centerY, pinRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = PIN_BORDER_COLOR;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      draggedPixels.forEach((pos) => {
        if (pos.x >= startX && pos.x < endX && pos.y >= startY && pos.y < endY) {
          const centerX = pos.x * pixelSize + pixelSize / 2;
          const centerY = pos.y * pixelSize + pixelSize / 2;
          
          // 임시 핀 표시
          ctx.fillStyle = PIN_COLOR;
          ctx.beginPath();
          ctx.arc(centerX, centerY, pinRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = PIN_BORDER_COLOR;
          ctx.lineWidth = 2;
          ctx.stroke();
          
          ctx.strokeStyle = SELECTION_COLOR;
          ctx.lineWidth = 2;
          ctx.strokeRect(
            pos.x * pixelSize + 1,
            pos.y * pixelSize + 1,
            pixelSize - 2,
            pixelSize - 2
          );
        }
      });

      if (
        mousePixelPos &&
        mousePixelPos.x >= startX &&
        mousePixelPos.x < endX &&
        mousePixelPos.y >= startY &&
        mousePixelPos.y < endY &&
        pixelSize > MIN_PIXEL_SIZE_FOR_HIGHLIGHT
      ) {
        ctx.strokeStyle = MOUSE_HIGHLIGHT_COLOR;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          mousePixelPos.x * pixelSize + 1,
          mousePixelPos.y * pixelSize + 1,
          pixelSize - 2,
          pixelSize - 2
        );
      }

      ctx.restore();
    });
  }, [
    width,
    height,
    pixelSize,
    offsetX,
    offsetY,
    mousePixelPos,
    pinnedPositions,
    isGridActive,
    pixelData,
    draggedPixels,
    pinRadius,
  ]);

  useEffect(() => {
    drawCanvas();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawCanvas]);

  useEffect(() => {
    const handleBatchPixelsUpdated = (event: CustomEvent) => {
      console.log('Canvas: batch-pixels-updated 이벤트 수신', event.detail);
      drawCanvas();
    };

    const handleForceUpdate = (event: CustomEvent) => {
      console.log('Canvas: 강제 업데이트 이벤트 수신', event.detail);
      drawCanvas();
    };

    window.addEventListener('batch-pixels-updated', handleBatchPixelsUpdated as EventListener);
    window.addEventListener('canvas-force-update', handleForceUpdate as EventListener);

    return () => {
      window.removeEventListener('batch-pixels-updated', handleBatchPixelsUpdated as EventListener);
      window.removeEventListener('canvas-force-update', handleForceUpdate as EventListener);
    };
  }, [drawCanvas]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.ctrlKey || e.metaKey) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -1 : 1;
        onZoom(delta, centerX, centerY);
      } else {
        onPan(-e.deltaX, -e.deltaY);
      }
    },
    [onPan, onZoom]
  );

  const updateMousePosition = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: -1, y: -1 };
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const pixelX = Math.floor((mouseX - offsetX) / pixelSize);
      const pixelY = Math.floor((mouseY - offsetY) / pixelSize);
      
      return { x: pixelX, y: pixelY };
    },
    [offsetX, offsetY, pixelSize]
  );

  const mouseMoveTimeoutRef = useRef<number | null>(null);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x: pixelX, y: pixelY } = updateMousePosition(e.clientX, e.clientY);
      
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      mouseMoveTimeoutRef.current = window.setTimeout(() => {
        onMouseMove(pixelX, pixelY);
      }, 16); // ~60fps

      if (isDragging && dragStart) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) setHasDragged(true);

        if (e.shiftKey) {
          const pixelKey = `${pixelX},${pixelY}`;
          if (
            !draggedPixelsSet.has(pixelKey) &&
            pixelX >= 0 && pixelX < width &&
            pixelY >= 0 && pixelY < height
          ) {
            setDraggedPixels(prev => [...prev, { x: pixelX, y: pixelY }]);
          }
        } else {
          onPan(deltaX, deltaY);
        }

        setDragStart({ x: currentX, y: currentY });
      }
    },
    [
      isDragging,
      dragStart,
      onPan,
      updateMousePosition,
      width,
      height,
      draggedPixelsSet,
      onMouseMove,
    ]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
    setHasDragged(false);
    if (!e.shiftKey) setDraggedPixels([]);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (draggedPixels.length > 0) {
      const existingKeys = pinnedPositionsSet;
      const newPixels = draggedPixels.filter(
        pixel => !existingKeys.has(`${pixel.x},${pixel.y}`)
      );
      
      if (newPixels.length > 0) {
        onPinnedPositionsChange([...pinnedPositions, ...newPixels]);
      }
    }

    if (!hasDragged && mousePixelPos && mousePixelPos.x >= 0 && mousePixelPos.y >= 0) {
      if (isPickFromCanvas && onPickColorAt) {
        onPickColorAt(mousePixelPos.x, mousePixelPos.y);
      } else {
        onPixelClick(mousePixelPos.x, mousePixelPos.y);
      }
    }

    setDraggedPixels([]);
    setIsDragging(false);
    setDragStart(null);
    setHasDragged(false);
  }, [
    hasDragged,
    mousePixelPos,
    onPixelClick,
    draggedPixels,
    onPinnedPositionsChange,
    pinnedPositions,
    pinnedPositionsSet,
  ]);

  const handleMouseLeave = useCallback(() => {
    if (mouseMoveTimeoutRef.current) {
      clearTimeout(mouseMoveTimeoutRef.current);
    }
    setIsDragging(false);
    setDragStart(null);
    setHasDragged(false);
    setDraggedPixels([]);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const abortController = new AbortController();
    const { signal } = abortController;

    container.addEventListener("wheel", handleWheel, { passive: false, signal });
    
    const preventTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    container.addEventListener("touchmove", preventTouch, { passive: false, signal });

    return () => {
      abortController.abort();
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
    };
  }, [handleWheel]);

  const canvasWidth = useMemo(() => window.innerWidth || 1200, []);
  const canvasHeight = useMemo(() => window.innerHeight || 800, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gray-200"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="bg-white"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ touchAction: "none", userSelect: "none" }}
      />
    </div>
  );
};

export default React.memo(Canvas);