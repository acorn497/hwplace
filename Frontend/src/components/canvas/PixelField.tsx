import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePixel } from "../../contexts/Pixel.context";
import { useCanvas } from "../../contexts/Canvas.context";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { Tool } from "../../contexts/enums/Tool.enum";
import { DragMode } from "../../contexts/enums/DragMode.enum";
import { FetchMethod, useFetch } from "../../hooks/useFetch";

/** 키보드 줌 배율 스텝 (연속 줌) */
const ZOOM_FACTOR = 1.25;
/** 휠 줌 배율 스텝 */
const WHEEL_ZOOM_FACTOR = 1.1;
/** 화면에 맞출 때 뷰포트 대비 여유 비율 */
const FIT_MARGIN = 0.92;

export const PixelField = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasBaseRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    getCanvasBuffer, canvasEpoch, pixelVersion, consumeDirtyRegions,
    selectedPixels, setSelectedPixels, setSelectedPixel,
  } = usePixel();
  const {
    zoom, setZoom, minZoom, maxZoom,
    dragMode, setDragMode,
    isLeftDown, setIsLeftDown,
    cursorPosition, setCursorPosition,
    canvasSizeX, canvasSizeY,
    isPanning, setIsPanning,
    fitToScreenSignal, requestFitToScreen,
  } = useCanvas();
  const { activeTool } = useGlobalVariable();

  const isCanvasReady = canvasSizeX > 0 && canvasSizeY > 0;

  const [padding, setPadding] = useState({ x: 800, y: 600 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  const zoomRef = useRef(zoom);
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  const spaceDownRef = useRef(false);
  const panSessionRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const didInitialFitRef = useRef(false);
  /** 이미 전체 렌더를 마친 canvasEpoch. 버퍼가 새로 할당되면 달라진다. */
  const drawnEpochRef = useRef(-1);
  const cursorPositionRef = useRef(cursorPosition);
  const selectedPixelsRef = useRef(selectedPixels);
  const isPanningRef = useRef(isPanning);
  const activeToolRef = useRef(activeTool);
  const paddingRef = useRef(padding);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { cursorPositionRef.current = cursorPosition; }, [cursorPosition]);
  useEffect(() => { selectedPixelsRef.current = selectedPixels; }, [selectedPixels]);
  useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { paddingRef.current = padding; }, [padding]);

  const measurePadding = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPadding({
      x: Math.max(viewport.clientWidth, 1),
      y: Math.max(viewport.clientHeight, 1),
    });
  }, []);

  const centerCanvasInViewport = useCallback((targetZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport || !isCanvasReady) return;

    const pad = paddingRef.current;
    const displayW = canvasSizeX * targetZoom;
    const displayH = canvasSizeY * targetZoom;

    pendingScrollRef.current = {
      left: pad.x + displayW / 2 - viewport.clientWidth / 2,
      top: pad.y + displayH / 2 - viewport.clientHeight / 2,
    };
  }, [canvasSizeX, canvasSizeY, isCanvasReady]);

  const applyZoomAtClientPoint = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport || !isCanvasReady) return;

    const oldZoom = zoomRef.current;
    const clamped = Math.min(maxZoom, Math.max(minZoom, nextZoom));
    if (clamped === oldZoom) return;

    const pad = paddingRef.current;
    const rect = viewport.getBoundingClientRect();
    const contentX = viewport.scrollLeft + (clientX - rect.left);
    const contentY = viewport.scrollTop + (clientY - rect.top);
    const canvasX = (contentX - pad.x) / oldZoom;
    const canvasY = (contentY - pad.y) / oldZoom;

    pendingScrollRef.current = {
      left: canvasX * clamped + pad.x - (clientX - rect.left),
      top: canvasY * clamped + pad.y - (clientY - rect.top),
    };

    zoomRef.current = clamped;
    setZoom(clamped);
  }, [isCanvasReady, maxZoom, minZoom, setZoom]);

  const fitToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isCanvasReady) return;

    measurePadding();
    const zoomX = (viewport.clientWidth * FIT_MARGIN) / canvasSizeX;
    const zoomY = (viewport.clientHeight * FIT_MARGIN) / canvasSizeY;
    const fitted = Math.min(maxZoom, Math.max(minZoom, Math.min(zoomX, zoomY)));

    zoomRef.current = fitted;
    setZoom(fitted);
    // 패딩 state 반영 후 중앙 정렬
    requestAnimationFrame(() => {
      paddingRef.current = {
        x: Math.max(viewport.clientWidth, 1),
        y: Math.max(viewport.clientHeight, 1),
      };
      centerCanvasInViewport(fitted);
      // zoom이 동일하면 useLayoutEffect가 안 돌 수 있으므로 직접 스크롤
      const pending = pendingScrollRef.current;
      if (pending) {
        viewport.scrollLeft = pending.left;
        viewport.scrollTop = pending.top;
        pendingScrollRef.current = null;
      }
    });
  }, [canvasSizeX, canvasSizeY, centerCanvasInViewport, isCanvasReady, maxZoom, measurePadding, minZoom, setZoom]);

  // 줌 반영 직후 스크롤 보정 (커서 앵커 / 중앙 정렬)
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const pending = pendingScrollRef.current;
    if (!viewport || !pending) return;
    viewport.scrollLeft = pending.left;
    viewport.scrollTop = pending.top;
    pendingScrollRef.current = null;
  }, [zoom]);

  const isSelected = useCallback((selectedPosition: { x: number, y: number }) => {
    return selectedPixelsRef.current.findIndex(
      targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y
    ) !== -1;
  }, []);

  const selectPixel = useCallback((selectedPosition: { x: number, y: number }) => {
    if (selectedPixelsRef.current.findIndex(
      targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y
    ) !== -1) return;
    setSelectedPixels([...selectedPixelsRef.current, { x: selectedPosition.x, y: selectedPosition.y }]);
  }, [setSelectedPixels]);

  const cancelPixel = useCallback((selectedPosition: { x: number, y: number }) => {
    if (selectedPixelsRef.current.findIndex(
      targetPixel => targetPixel.x === selectedPosition.x && targetPixel.y === selectedPosition.y
    ) === -1) return;
    setSelectedPixels(selectedPixelsRef.current.filter(
      targetPixel => (targetPixel.x !== selectedPosition.x || targetPixel.y !== selectedPosition.y)
    ));
  }, [setSelectedPixels]);

  const handleMouseClick = useCallback(async () => {
    if (isPanningRef.current || spaceDownRef.current) return;

    const pos = cursorPositionRef.current;

    if (activeToolRef.current !== Tool.BRUSH) {
      const result = await useFetch(FetchMethod.GET, `/canvas/pixel?x=${pos.x}&y=${pos.y}`);

      switch (result.internalStatusCode) {
        case 'C100': // FOUND_DATA
          setSelectedPixel({
            posX: result.data.posX,
            posY: result.data.posY,
            colorR: result.data.colorR,
            colorG: result.data.colorG,
            colorB: result.data.colorB,
            uuid: result.data.uuid,
            index: result.data.index,
            paintedAt: result.data.paintedAt,
            paintedBy: result.data.paintedBy,
          });
          break;

        case 'C101': // NO_DATA
          setSelectedPixel(null);
          break;

        default:
          setSelectedPixel(null);
          console.error('Unexpected response:', result);
          break;
      }
      return;
    }

    if (isSelected(pos)) cancelPixel(pos);
    else selectPixel(pos);
  }, [cancelPixel, isSelected, selectPixel, setSelectedPixel]);

  const clientToCanvasPixel = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSizeX <= 0 || canvasSizeY <= 0) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.floor((clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((clientY - rect.top) * (canvas.height / rect.height));

    return {
      x: Math.max(0, Math.min(canvasSizeX - 1, x)),
      y: Math.max(0, Math.min(canvasSizeY - 1, y)),
    };
  }, [canvasSizeX, canvasSizeY]);

  // ==========================================
  // ===>       INITIALIZE
  // ==========================================
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) setIsLeftDown(true);
    };
    const handleMouseUp = () => {
      setIsLeftDown(false);
      panSessionRef.current = null;
      if (isPanningRef.current) setIsPanning(false);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setIsLeftDown, setIsPanning]);

  // 스페이스 키로 팬 모드 준비
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return;
      if (event.repeat) return;
      event.preventDefault();
      spaceDownRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceDownRef.current = false;
      setSpaceHeld(false);
      if (!panSessionRef.current) setIsPanning(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setIsPanning]);

  useKeyboardShortcut("K", () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    applyZoomAtClientPoint(zoomRef.current / ZOOM_FACTOR, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  useKeyboardShortcut("I", () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    applyZoomAtClientPoint(zoomRef.current * ZOOM_FACTOR, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  useKeyboardShortcut("0", () => requestFitToScreen());
  useKeyboardShortcut("F", () => requestFitToScreen());

  useKeyboardShortcut("Shift", () => setDragMode(activeTool === Tool.BRUSH ? dragMode === DragMode.SELECT ? DragMode.NONE : DragMode.SELECT : dragMode));
  useKeyboardShortcut("Ctrl", () => setDragMode(activeTool === Tool.BRUSH ? dragMode === DragMode.CANCEL ? DragMode.NONE : DragMode.CANCEL : dragMode));

  // 뷰포트 패딩 초기화 / 리사이즈
  useEffect(() => {
    measurePadding();
    const onResize = () => measurePadding();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measurePadding]);

  // "화면에 맞추기" 신호
  useEffect(() => {
    if (fitToScreenSignal === 0) return;
    if (!isCanvasReady) return;
    fitToScreen();
  }, [fitToScreenSignal, fitToScreen, isCanvasReady]);

  /**
   * 픽셀 렌더링 — 줌과 무관 (백킹 스토어는 네이티브 크기).
   *
   * 청크가 도착할 때마다 바뀐 영역만 그린다. 청크 수신이 끝날 때까지 기다리지 않으므로
   * 인트로 뒤에서 캔버스가 실제로 채워져 나가고, 마지막에 한 번에 그리며 멈추는 구간도 없다.
   */
  useEffect(() => {
    if (!isCanvasReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const buffer = getCanvasBuffer();
    if (!buffer) return;

    /** 버퍼의 한 영역을 캔버스로 옮긴다 (RGB -> RGBA 확장) */
    const drawRegion = (x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return;

      const imageData = context.createImageData(width, height);

      for (let row = 0; row < height; row++) {
        let source = ((y + row) * canvasSizeX + x) * 3;
        let destination = row * width * 4;

        for (let column = 0; column < width; column++) {
          imageData.data[destination] = buffer[source];
          imageData.data[destination + 1] = buffer[source + 1];
          imageData.data[destination + 2] = buffer[source + 2];
          imageData.data[destination + 3] = 255;
          source += 3;
          destination += 4;
        }
      }

      context.putImageData(imageData, x, y);
    };

    // 버퍼가 새로 할당됐거나(재접속) 이 컴포넌트가 늦게 마운트된 경우 전체를 한 번 그린다.
    if (drawnEpochRef.current !== canvasEpoch) {
      drawnEpochRef.current = canvasEpoch;
      drawRegion(0, 0, canvasSizeX, canvasSizeY);
      consumeDirtyRegions();

      if (!didInitialFitRef.current) {
        didInitialFitRef.current = true;
        requestAnimationFrame(() => fitToScreen());
      }
      return;
    }

    for (const region of consumeDirtyRegions()) {
      if (region.width === 1 && region.height === 1) {
        // 실시간 단일 픽셀 갱신은 fillRect가 더 싸다
        const offset = (region.y * canvasSizeX + region.x) * 3;
        context.fillStyle = `rgb(${buffer[offset]},${buffer[offset + 1]},${buffer[offset + 2]})`;
        context.fillRect(region.x, region.y, 1, 1);
        continue;
      }

      drawRegion(region.x, region.y, region.width, region.height);
    }
  }, [
    pixelVersion,
    canvasEpoch,
    isCanvasReady,
    canvasSizeX,
    canvasSizeY,
    getCanvasBuffer,
    consumeDirtyRegions,
    fitToScreen,
  ]);

  /**
   * 선택된 픽셀 오버레이 (네이티브 좌표 + CSS 스케일 → 줌 변경 O(1))
   */
  useEffect(() => {
    if (!isCanvasReady) return;

    const overlay = selectionCanvasRef.current;
    if (!overlay) return;

    const context = overlay.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, overlay.width, overlay.height);
    context.strokeStyle = '#22c55e';
    context.lineWidth = 1;

    selectedPixels.forEach((selection) => {
      // 네이티브 1×1 셀 테두리 (CSS 확대 시 함께 스케일됨)
      context.strokeRect(selection.x + 0.5, selection.y + 0.5, 1 - 1, 1 - 1);
    });
  }, [selectedPixels, isCanvasReady]);

  /**
   * 드래그 선택/해제 (팬 중에는 동작하지 않음)
   */
  useEffect(() => {
    if (isPanning || activeTool !== Tool.BRUSH || dragMode === DragMode.NONE || !isLeftDown) return;
    switch (dragMode) {
      case DragMode.SELECT:
        selectPixel({ x: cursorPosition.x, y: cursorPosition.y });
        break;
      case DragMode.CANCEL:
        cancelPixel({ x: cursorPosition.x, y: cursorPosition.y });
        break;
    }
  }, [cursorPosition, dragMode, isLeftDown, isPanning, activeTool, selectPixel, cancelPixel]);

  // 포인터: 좌표 / 팬 / 클릭 / 휠 줌
  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas || !isCanvasReady) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (panSessionRef.current) {
        const session = panSessionRef.current;
        viewport.scrollLeft = session.scrollLeft - (event.clientX - session.startX);
        viewport.scrollTop = session.scrollTop - (event.clientY - session.startY);
        return;
      }

      const coords = clientToCanvasPixel(event.clientX, event.clientY);
      if (coords) setCursorPosition(coords);
    };

    const handleMouseDown = (event: MouseEvent) => {
      const wantsPan = event.button === 1 || (event.button === 0 && spaceDownRef.current);
      if (wantsPan) {
        event.preventDefault();
        setIsPanning(true);
        panSessionRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        };
        return;
      }

      if (event.button === 0 && !spaceDownRef.current) {
        void handleMouseClick();
      }
    };

    const handleAuxClick = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      // Alt + 휠: 커서 기준 줌
      if (event.altKey) {
        const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        const factor = delta < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
        applyZoomAtClientPoint(zoomRef.current * factor, event.clientX, event.clientY);
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) return;

      // Shift + 휠: 좌우 이동 (일부 환경은 shift 시 deltaX로 옴)
      if (event.shiftKey) {
        viewport.scrollLeft += event.deltaY !== 0 ? event.deltaY : event.deltaX;
        return;
      }

      // 기본 휠: 위/아래 이동 (트랙패드 가로 스와이프는 deltaX)
      viewport.scrollTop += event.deltaY;
      viewport.scrollLeft += event.deltaX;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('auxclick', handleAuxClick);
    // 가운데 버튼 기본 오토스크롤 방지
    canvas.addEventListener('mousedown', handleAuxClick);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      viewport.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('auxclick', handleAuxClick);
      canvas.removeEventListener('mousedown', handleAuxClick);
    };
  }, [isCanvasReady, applyZoomAtClientPoint, setCursorPosition, setIsPanning, clientToCanvasPixel, handleMouseClick]);

  const displayW = canvasSizeX * zoom;
  const displayH = canvasSizeY * zoom;
  const cursorStyle = isPanning ? 'grabbing' : spaceHeld ? 'grab' : undefined;

  return (
    <div
      ref={viewportRef}
      className="w-screen h-screen overflow-auto bg-canvas-void"
      style={{ cursor: cursorStyle }}
    >
      {isCanvasReady && (
        <div
          className="relative"
          style={{
            width: displayW + padding.x * 2,
            height: displayH + padding.y * 2,
          }}
        >
          <div
            ref={canvasBaseRef}
            className="absolute"
            style={{
              left: padding.x,
              top: padding.y,
              width: displayW,
              height: displayH,
            }}
          >
            <canvas
              ref={canvasRef}
              className="pixelated border border-border absolute top-0 left-0"
              width={canvasSizeX}
              height={canvasSizeY}
              style={{ width: '100%', height: '100%' }}
            />
            <canvas
              ref={selectionCanvasRef}
              className="pixelated absolute top-0 left-0 pointer-events-none"
              width={canvasSizeX}
              height={canvasSizeY}
              style={{ width: '100%', height: '100%' }}
            />
            <div
              className="absolute z-10 pointer-events-none top-0 left-0 box-border border border-content"
              style={{
                transform: `translate(${zoom * cursorPosition.x}px, ${zoom * cursorPosition.y}px)`,
                width: Math.max(zoom, 1),
                height: Math.max(zoom, 1),
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
