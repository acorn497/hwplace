import { useEffect, useRef } from "react"
import { usePixel } from "../../contexts/Pixel.context";
import { PixelLoadStatus } from "../../contexts/enums/PixelLoadStatus.enum";
import { useCanvas } from "../../contexts/Canvas.context";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { Tool } from "../../contexts/enums/Tool.enum";
import { DragMode } from "../../contexts/enums/DragMode.enum";

export const PixelField = () => {
  const canvasBaseRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { pixels, pixelLoadStatus, selectedPixels, setSelectedPixels } = usePixel();
  const { setLoadedPixel, zoom, setZoom, dragMode, setDragMode, isLeftDown, setIsLeftDown, cursorPosition, setCursorPosition } = useCanvas();
  const { activeTool } = useGlobalVariable();

  /**
   * 픽셀 선택/해제
   * 
   */
  const handleMouseClick = () => {
    if (activeTool !== Tool.BRUSH) return;

    const selectedPosition = { x: cursorPosition.x, y: cursorPosition.y };
    if (isSelected(selectedPosition)) cancelPixel(selectedPosition);
    else selectPixel(selectedPosition);
  }

  const isSelected = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) !== -1) return true;
    else return false;
  }

  const selectPixel = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) !== -1) return;
    setSelectedPixels([...selectedPixels, { x: cursorPosition.x, y: cursorPosition.y }]);
  }

  const cancelPixel = (selectedPosition: { x: number, y: number }) => {
    if (selectedPixels.findIndex(targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y) == -1) return;
    setSelectedPixels(selectedPixels.filter(targetPixel => (targetPixel.x !== selectedPosition.x || targetPixel.y !== selectedPosition.y)));
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

  useKeyboardShortcut("K", () => { setZoom(Math.round(zoom - 1 > 0 ? zoom - 1 : zoom)); isInitialRenderRef.current = true; });
  useKeyboardShortcut("I", () => { setZoom(Math.round(zoom + 1)); isInitialRenderRef.current = true; });

  useKeyboardShortcut("Shift", () => setDragMode(dragMode === DragMode.SELECT ? DragMode.NONE : DragMode.SELECT));
  useKeyboardShortcut("Ctrl", () => setDragMode(dragMode === DragMode.CANCEL ? DragMode.NONE : DragMode.CANCEL));

  const previousPixelsRef = useRef<Map<string, { colorR: number, colorG: number, colorB: number }>>(new Map());
  const isInitialRenderRef = useRef(true);

  useEffect(() => {
    if (pixelLoadStatus !== PixelLoadStatus.FINISHED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // 초기 렌더링
    if (isInitialRenderRef.current) {
      console.log("Initial rendering: drawing all pixels...");
      let index = 0;
      pixels.forEach((pixel) => {
        context.fillStyle = `rgb(${pixel.colorR},${pixel.colorG},${pixel.colorB})`;
        context.fillRect(pixel.posX * zoom, pixel.posY * zoom, zoom, zoom);

        const key = `${pixel.posX},${pixel.posY}`;
        previousPixelsRef.current.set(key, { colorR: pixel.colorR, colorG: pixel.colorG, colorB: pixel.colorB });

        index++;
        setLoadedPixel(index);
      });
      isInitialRenderRef.current = false;
      return;
    }

    // 업데이트
    console.log("Incremental update: checking for changed pixels...");
    let updatedCount = 0;

    pixels.forEach((pixel) => {
      const key = `${pixel.posX},${pixel.posY}`;
      const previousPixel = previousPixelsRef.current.get(key);

      // 새로운 픽셀이거나 색상이 변경된 경우만 다시 그리기
      if (!previousPixel ||
        previousPixel.colorR !== pixel.colorR ||
        previousPixel.colorG !== pixel.colorG ||
        previousPixel.colorB !== pixel.colorB) {

        context.fillStyle = `rgb(${pixel.colorR},${pixel.colorG},${pixel.colorB})`;
        context.fillRect(pixel.posX * zoom, pixel.posY * zoom, zoom, zoom);

        previousPixelsRef.current.set(key, { colorR: pixel.colorR, colorG: pixel.colorG, colorB: pixel.colorB });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      console.log(`Updated ${updatedCount} pixels`);
    }
  }, [pixels, zoom]);

  /**
   * 특정 드래그 모드가 활성화 된 경우
   */
  useEffect(() => {
    if (activeTool !== Tool.BRUSH || dragMode === DragMode.NONE || !isLeftDown) return;
    switch (dragMode) {
      case DragMode.SELECT:
        selectPixel({ x: cursorPosition.x, y: cursorPosition.y });
        break;
      case DragMode.CANCEL:
        cancelPixel({ x: cursorPosition.x, y: cursorPosition.y });
        break;
    }
  }, [cursorPosition, dragMode])

  useEffect(() => {
    if (!canvasRef.current) return;
    const handleMouseMove = (event: MouseEvent) => {
      setCursorPosition({ x: Math.floor(event.layerX / zoom), y: Math.floor(event.layerY / zoom) })
    }

    canvasRef.current.addEventListener('mousemove', handleMouseMove);
    canvasRef.current.addEventListener('click', handleMouseClick);

    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
        canvasRef.current.removeEventListener('click', handleMouseClick);
      }
    }
  }, [canvasRef.current, zoom, cursorPosition, selectedPixels]);

  return (
    <div className="w-screen h-screen overflow-scroll">
      <div ref={canvasBaseRef} className="absolute top-1/2 left-1/2 -translate-1/2" style={{ width: 1000 * zoom, height: 1000 * zoom }}>
        <canvas ref={canvasRef} className="border -translate-1/2 absolute top-1/2 left-1/2" width={1000 * zoom} height={1000 * zoom}>

        </canvas>
        <div>
          <div className="absolute z-10 transition-normal duration-80 ease-out pointer-events-none" style={{ transform: `translate(${zoom * cursorPosition.x}px,${zoom * (cursorPosition.y)}px)`, width: zoom, height: zoom, border: `${1 / zoom}px solid black` }} />
          {selectedPixels.map((selection, index) => <div key={index} className="absolute pointer-events-none z-1" style={{ transform: `translate(${(zoom * selection.x)}px,${(zoom * selection.y)}px)`, border: '1px solid green', width: `${zoom}px`, height: `${zoom}px` }} />)}
        </div>
      </div>
    </div>
  )
}