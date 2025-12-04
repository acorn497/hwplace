import { useEffect, useRef, useState } from "react"
import { usePixel } from "../../contexts/Pixel.context";
import { PixelLoadStatus } from "../../contexts/enums/PixelLoadStatus.enum";
import { useCanvas } from "../../contexts/Canvas.context";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { Tool } from "../../contexts/enums/Tool.enum";

interface PixelPosition {
  x: number,
  y: number,
}

enum DragMode {
  NONE = "NONE",
  SELECT = "SELECT",
  CANCEL = "CANCEL"
}

export const PixelField = () => {
  const canvasBaseRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { pixels, pixelLoadStatus } = usePixel();
  const { setLoadedPixel } = useCanvas();
  const { zoom, setZoom, activeTool } = useGlobalVariable();
  const [selectedPixels, setSelectedPixels] = useState<PixelPosition[]>([]);

  const [cursor, setCursor] = useState<PixelPosition>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(DragMode.NONE);
  const [isLeftDown, setIsLeftDown] = useState(false);

  /**
   * 픽셀 선택/해제
   * 
   */
  const handleMouseClick = () => {
    if (activeTool !== Tool.BRUSH) return;

    const selectedPosition = { x: cursor.x, y: cursor.y };
    if (isSelected(selectedPosition)) cancelPixel(selectedPosition);
    else selectPixel(selectedPosition);
  }

  const isSelected = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) !== -1) return true;
    else return false;
  }

  const selectPixel = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) !== -1) return;
    setSelectedPixels(prev => [...prev, { x: cursor.x, y: cursor.y }]);
  }

  const cancelPixel = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) == -1) return;
    setSelectedPixels(prev => prev.filter(targetPixel => (targetPixel.x !== selectedPosition.x || targetPixel.y !== selectedPosition.y)));
  }

  // ==========================================
  // ===>       INITIALIZE                     
  // ==========================================
  /**
   * Initialize Effect
   */
  useEffect(() => {
    addEventListener('mousedown', () => setIsLeftDown(true));
    addEventListener('mouseup', () => { setIsLeftDown(false); setDragMode(DragMode.NONE); });

    return () => {
      removeEventListener('mousedown', () => setIsLeftDown(true));
      removeEventListener('mouseup', () => { setIsLeftDown(false); setDragMode(DragMode.NONE); });
    }
  }, []);

  useKeyboardShortcut("K", () => setZoom(Math.round(zoom - 1)));
  useKeyboardShortcut("I", () => setZoom(Math.round(zoom + 1)));

  useKeyboardShortcut("Shift", () => setDragMode(dragMode === DragMode.SELECT ? DragMode.NONE : DragMode.SELECT));
  useKeyboardShortcut("Ctrl", () => setDragMode(dragMode === DragMode.CANCEL ? DragMode.NONE : DragMode.CANCEL));

  useEffect(() => {
    if (pixelLoadStatus !== PixelLoadStatus.FINISHED) return;
    console.log("rendering...")
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas?.getContext('2d');
      if (context) {
        let index = 0;
        pixels.forEach((pixel) => {
          context.fillStyle = `rgb(${pixel.colorR},${pixel.colorG},${pixel.colorB})`;
          context.fillRect(pixel.posX * zoom, pixel.posY * zoom, zoom, zoom);
          index++;
          setLoadedPixel(index);
        })
      }
    }
  }, [pixels, zoom]);

  /**
   * 특정 드래그 모드가 활성화 된 경우
   */
  useEffect(() => {
    if (activeTool !== Tool.BRUSH || dragMode === DragMode.NONE || !isLeftDown) return;
    switch (dragMode) {
      case DragMode.SELECT:
        selectPixel({ x: cursor.x, y: cursor.y });
        break;
      case DragMode.CANCEL:
        cancelPixel({ x: cursor.x, y: cursor.y });
        break;
    }
  }, [cursor, dragMode])

  useEffect(() => {
    if (!canvasRef.current) return;
    const handleMouseMove = (event: MouseEvent) => {
      setCursor({ x: Math.floor(event.layerX / zoom), y: Math.floor(event.layerY / zoom) })
    }

    canvasRef.current.addEventListener('mousemove', handleMouseMove);
    canvasRef.current.addEventListener('click', handleMouseClick);

    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
        canvasRef.current.removeEventListener('click', handleMouseClick);
      }
    }
  }, [canvasRef.current, zoom, cursor, selectedPixels]);

  return (
    <>
      <div className="fixed top-1/2 left-1/2 z-0 -translate-1/2 pointer-events-none">
        <span>Cursor Position</span><br />
        <span>X: {cursor.x}</span><br />
        <span>Y: {cursor.y}</span><br />
        <span>DRAG: {dragMode}</span><br />
        <span>LEFT: {isLeftDown ? "True" : "False"}</span>
      </div>
      <div className="w-screen h-screen overflow-hidden">
        <div ref={canvasBaseRef} className="absolute top-1/2 left-1/2 -translate-1/2" style={{ width: 1000 * zoom, height: 1000 * zoom }}>
          <canvas ref={canvasRef} className="border -translate-1/2 absolute top-1/2 left-1/2" width={1000 * zoom} height={1000 * zoom}>

          </canvas>
          <div>
            <div className="absolute z-10 transition-normal duration-80 ease-out pointer-events-none" style={{ transform: `translate(${zoom * cursor.x}px,${zoom * (cursor.y)}px)`, width: zoom, height: zoom, border: `${1 / zoom}px solid black` }} />
            {selectedPixels.map((selection, index) => <div key={index} className="absolute pointer-events-none z-1" style={{ transform: `translate(${(zoom * selection.x)}px,${(zoom * selection.y)}px)`, border: '1px solid green', width: `${zoom}px`, height: `${zoom}px` }} />)}
          </div>
        </div>
      </div>
    </>
  )
}