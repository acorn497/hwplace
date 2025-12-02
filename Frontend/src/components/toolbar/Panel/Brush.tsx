import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { Tool } from "../../../contexts/enums/Tool.enum";
import { useEffect, useState } from "react";
import { RgbColorPicker } from "./Brush/ColorPicker";
import { Titlebox } from "../../common/Titlebox";
import { Button } from "../../common/Button";

export const Brush = () => {
  const { setActiveTool, accessToken } = useGlobalVariable();

  const [currentColor, setCurrentColor] = useState({ r: 0, g: 106, b: 106 });

  useEffect(() => {

  }, [currentColor])

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
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.r} onChange={(event) => setCurrentColor(prev => { return { r: parseInt(event.target.value) ?? 0, g: prev.g, b: prev.b } })} />
            </Titlebox>
            <Titlebox title="G">
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.g} onChange={(event) => setCurrentColor(prev => { return { r: prev.r, g: parseInt(event.target.value) ?? 0, b: prev.b } })} />
            </Titlebox>
            <Titlebox title="B">
              <input type="number" className="appearance-none aritta-font tracking-wide focus:outline-none transition-colors" minLength={1} maxLength={3} min={0} max={255} defaultValue={0} value={currentColor.b} onChange={(event) => setCurrentColor(prev => { return { r: prev.r, g: prev.g, b: parseInt(event.target.value) ?? 0 } })} />
            </Titlebox>
          </section>

        </section>
        {/* 상태 섹션 */}
        <section className="grid grid-rows-2 w-full h-full">
          <div className="flex">
            <div className="w-15 h-15 rounded-md border border-primary-border shadow-sm" style={{ backgroundColor: `rgb(${currentColor.r},${currentColor.g},${currentColor.b})` }} />
            <div className="flex-1  h-15">
              <Button display="칠하기" hint="선택된 구역을 칠합니다." keybind="Shift + Enter" />
            </div>
          </div>
          <div className="">

          </div>
          <div>

          </div>
        </section>

        {!accessToken &&
          <div className="absolute inset-0 flex flex-col justify-center items-center select-none bg-white/90 z-10">
            <h3 className="text-md font-semibold">로그인 후 이용하실 수 있습니다.</h3>
            <button onClick={() => setActiveTool(Tool.PROFILE)} className="px-2 py-2 h-9 mt-3 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md">
              로그인 하러 가기
            </button>
          </div>
        }
      </div>
    </div>
  )
}