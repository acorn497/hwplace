import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { Tool } from "../../../contexts/enums/Tool.enum";
import { useEffect, useState } from "react";
import { RgbColorPicker } from "./Brush/ColorPicker";
import { Titlebox } from "../../common/Titlebox";
import { Button } from "../../common/Button";
import { useCanvas } from "../../../contexts/Canvas.context";
import { DragMode } from "../../../contexts/enums/DragMode.enum";
import { usePixel } from "../../../contexts/Pixel.context";
import { FetchMethod, useFetch } from "../../../hooks/useFetch";
import { useAuth } from "../../../contexts/Auth.context";
import { useKeyboardShortcut } from "../../../hooks/useKeyboardShortcut";
import { PaintBucket, Pipette } from "lucide-react";
import { BFS } from "../../../utils/bfs";

export const Brush = () => {
  const { setActiveTool } = useGlobalVariable();
  const { cursorPosition, dragMode, isLeftDown, isCloneColorActive, setIsCloneColorActive, isPaintBucketActive, setIsPaintBucketActive, canvasSizeX, canvasSizeY } = useCanvas();
  const { selectedPixels, setSelectedPixels, pixels } = usePixel();
  const { accessToken } = useAuth();

  const [currentColor, setCurrentColor] = useState(() => {
    const lastUsedRed = parseInt(localStorage.getItem('R') ?? '');
    const lastUsedGreen = parseInt(localStorage.getItem('G') ?? '');
    const lastUsedBlue = parseInt(localStorage.getItem('B') ?? '');
    return {
      r: isNaN(lastUsedRed) ? 58 : lastUsedRed,
      g: isNaN(lastUsedGreen) ? 118 : lastUsedGreen,
      b: isNaN(lastUsedBlue) ? 118 : lastUsedBlue
    }
  });

  const clampColor = (value: number) => Math.max(0, Math.min(255, value));

  useEffect(() => {
    if (!isNaN(currentColor.r) && !isNaN(currentColor.g) && !isNaN(currentColor.b)) {
      localStorage.setItem('R', currentColor.r.toString());
      localStorage.setItem('G', currentColor.g.toString());
      localStorage.setItem('B', currentColor.b.toString());
    }
  }, [currentColor]);

  const handlePaintPixels = async () => {
    if (selectedPixels.length === 0) return;

    const paintRequest = selectedPixels.map(pixel => ({
      posX: pixel.x,
      posY: pixel.y,
      colorR: currentColor.r,
      colorG: currentColor.g,
      colorB: currentColor.b
    }));

    await useFetch(FetchMethod.POST, '/paint', paintRequest);
    setSelectedPixels([]);
  };

  const handleCloneColor = () => {
    const selectedPixel = pixels.get(`${cursorPosition.x},${cursorPosition.y}`) ?? { colorR: 255, colorG: 255, colorB: 255 };
    setCurrentColor({ r: selectedPixel?.colorR, g: selectedPixel?.colorG, b: selectedPixel?.colorB })
  }

  const handlePaintBucket = () => {
    const selectedPixel = pixels.get(`${cursorPosition.x},${cursorPosition.y}`) ?? { colorR: 255, colorG: 255, colorB: 255 };
    const bfsResult = BFS(cursorPosition.x, cursorPosition.y, { r: selectedPixel.colorR, g: selectedPixel.colorG, b: selectedPixel.colorB }, pixels, canvasSizeX, canvasSizeY);

    switch (dragMode) {
      case DragMode.NONE:
      case DragMode.SELECT:
        setSelectedPixels(prev => {
          const newPixels = [...prev];
          bfsResult.forEach(pixelPos => {
            if (newPixels.findIndex(p => p.x === pixelPos.x && p.y === pixelPos.y) === -1) {
              newPixels.push({ x: pixelPos.x, y: pixelPos.y });
            }
          });
          return newPixels;
        });
        break;
      case DragMode.CANCEL:
        setSelectedPixels(prev => {
          return prev.filter(p => !bfsResult.some(bfsPixel => bfsPixel.x === p.x && bfsPixel.y === p.y));
        });
        break;
    }
  }

  useEffect(() => {
    if (!isLeftDown || !isCloneColorActive) return;

    handleCloneColor();
    setIsCloneColorActive(false);
  }, [isLeftDown, isCloneColorActive]);

  useEffect(() => {
    if (!isLeftDown || !isPaintBucketActive) return;

    handlePaintBucket();
    setIsPaintBucketActive(false);
  }, [isLeftDown, isPaintBucketActive]);

  useKeyboardShortcut('Enter', handlePaintPixels);
  useKeyboardShortcut('C', () => setIsCloneColorActive(!isCloneColorActive));
  useKeyboardShortcut('F', () => setIsPaintBucketActive(!isPaintBucketActive));

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
        <h2 className="text-base font-semibold text-slate-800">색칠하기</h2>
      </div>

      <div className="relative grid grid-cols-[2fr_3fr] gap-x-2.5 h-full">
        <section className="relative z-0 flex flex-col space-y-1">
          {/* RGB GUI 입력 섹션 */}
          <RgbColorPicker color={currentColor} onChange={setCurrentColor} />

          {/* RGB 수동 입력 섹션 */}
          <Titlebox title="FORMAT" className="mt-1">
            <select name="" id="">
              <option value="RGB">RGB</option>
              <option value="HEX">HEX</option>
            </select>
          </Titlebox>

          <section className="grid grid-cols-3 gap-x-1">
            <Titlebox title="R">
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.r} onChange={(event) => setCurrentColor(prev => { return { r: clampColor(parseInt(event.target.value) || 0), g: prev.g, b: prev.b } })} />
            </Titlebox>
            <Titlebox title="G">
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.g} onChange={(event) => setCurrentColor(prev => { return { r: prev.r, g: clampColor(parseInt(event.target.value) || 0), b: prev.b } })} />
            </Titlebox>
            <Titlebox title="B">
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.b} onChange={(event) => setCurrentColor(prev => { return { r: prev.r, g: prev.g, b: clampColor(parseInt(event.target.value) || 0) } })} />
            </Titlebox>
          </section>

        </section>
        {/* 상태 섹션 */}
        <section className="flex flex-col gap-2 w-full h-full">
          <div className="flex gap-2">
            <div className="w-15 h-15 rounded-md border border-primary-border shadow-sm" style={{ backgroundColor: `rgb(${currentColor.r},${currentColor.g},${currentColor.b})` }} />
            <div className="flex-1 flex-row flex h-15">
              <Button display="칠하기" hint="선택된 픽셀을 칠합니다." keybind="Enter" callback={handlePaintPixels} />
              <Button className={`${isCloneColorActive ? 'bg-amber-50' : null}`} hint="선택된 픽셀의 색상을 복사합니다." keybind="C" callback={() => setIsCloneColorActive(!isCloneColorActive)}><Pipette className="w-5 h-5" /></Button>
              <Button className={`${isPaintBucketActive ? 'bg-amber-50' : null}`} hint={`주변 픽셀 최대 500개를 ${dragMode === DragMode.CANCEL ? "취소" : "선택"}합니다.`} keybind="F" callback={() => setIsPaintBucketActive(!isPaintBucketActive)}><PaintBucket className="w-5 h-5" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Titlebox
              title="DRAG MODE"
              className={`col-span-2 transition-colors ${dragMode === DragMode.SELECT ? "bg-lime-300/40" : dragMode === DragMode.CANCEL ? "bg-red-100/40" : "bg-slate-200/40"}`}
            >
              {dragMode}
            </Titlebox>

            <Titlebox title="CURSOR" className="bg-slate-50">
              ({cursorPosition.x}, {cursorPosition.y})
            </Titlebox>
            <Titlebox title="SELECTED" className="bg-slate-50">
              {selectedPixels.length}
            </Titlebox>
          </div>
        </section>

        {
          !accessToken &&
          <div className="absolute inset-0 flex flex-col justify-center items-center select-none bg-white/70 z-10 w-150 h-60 -translate-x-6 -translate-y-3">
            <h3 className="text-md font-semibold">로그인 후 이용하실 수 있습니다.</h3>
            <button onClick={() => setActiveTool(Tool.PROFILE)} className="px-2 py-2 h-9 mt-3 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md">
              로그인 하러 가기
            </button>
          </div>
        }
      </div >
    </div >
  )
}