import React from "react";
import { Settings, Brush, Pipette } from "lucide-react";
import IconToggleButton from "./IconToggleButton";
import ColorPickerComponent from "./ColorPicker";
import { Pixel } from "./Types";

type ToolbarProps = {
  activeTool: "settings" | "brush" | null;
  setActiveTool: (tool: "settings" | "brush" | null) => void;
  isGridActive: boolean;
  toggleGrid: () => void;
  isLocalStorageEnabled: boolean;
  setIsLocalStorageEnabled: (v: boolean) => void;
  clearLocalStorageData: () => void;
  selectedColor: Pixel;
  setSelectedColor: (color: Pixel) => void;
  favoriteColors: Pixel[];
  addFavoriteColor: () => void;
  removeFavoriteColor?: (index: number) => void;
  handleFillPixel: () => void;
  isPickFromCanvas: boolean;
  setIsPickFromCanvas: (v: boolean) => void;
};

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isGridActive,
  toggleGrid,
  isLocalStorageEnabled,
  setIsLocalStorageEnabled,
  clearLocalStorageData,
  selectedColor,
  setSelectedColor,
  favoriteColors,
  addFavoriteColor,
  removeFavoriteColor,
  handleFillPixel,
  isPickFromCanvas,
  setIsPickFromCanvas
}) => {
  const handleFavoriteColorClick = (color: Pixel, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && removeFavoriteColor) {
      // Shift + click to remove favorite color
      removeFavoriteColor(index);
    } else {
      // Normal click to select color
      setSelectedColor(color);
    }
  };

  return (
    <>
      {/* 툴바 버튼 */}
      <div className="fixed w-65 left-4 top-26 flex flex-row z-50">
        <IconToggleButton
          active={activeTool === "settings"}
          onClick={() => setActiveTool(activeTool === "settings" ? null : "settings")}
          title="Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </IconToggleButton>
        <IconToggleButton
          active={activeTool === "brush"}
          onClick={() => setActiveTool(activeTool === "brush" ? null : "brush")}
          title="Brush"
        >
          <Brush className="w-4.5 h-4.5" />
        </IconToggleButton>
      </div>

      {/* 툴바 메뉴 */}
      {activeTool === "settings" && (
        <div className="fixed left-4 top-38.5 z-40">
          <div className="w-65 max-h-96 sm:max-h-[70vh] md:max-h-[75vh] bg-white p-4 flex flex-col items-stretch rounded-sm border shadow-lg overflow-y-auto">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900">Settings</h3>
              <p className="text-xs text-gray-500 mt-0.5">작업 환경을 간편하게 설정하세요</p>
            </div>

            <div className="border-t my-2" />

            {/* Grid Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-800">그리드 표시</div>
                <div className="text-xs text-gray-500">캔버스에 보조 그리드를 표시합니다</div>
              </div>
              <IconToggleButton
                variant="switch"
                active={isGridActive}
                onClick={toggleGrid}
                title={isGridActive ? "그리드 끄기" : "그리드 켜기"}
              />
            </div>

            {/* Local Storage Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-800">로컬 저장 사용</div>
                <div className="text-xs text-gray-500">색상/뷰/고정 픽셀을 자동 저장합니다</div>
              </div>
              <IconToggleButton
                variant="switch"
                active={isLocalStorageEnabled}
                onClick={() => setIsLocalStorageEnabled(!isLocalStorageEnabled)}
                title={isLocalStorageEnabled ? "로컬 저장 끄기" : "로컬 저장 켜기"}
                className="ml-3"
              />
            </div>

            {/* Clear Local Storage */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-800">저장 데이터 삭제</div>
                <div className="text-xs text-gray-500">브라우저에 저장된 모든 로컬 데이터를 삭제합니다</div>
              </div>
              <button
                type="button"
                onClick={clearLocalStorageData}
                className="px-2 py-1 text-xs border rounded-sm hover:bg-gray-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTool === "brush" && (
        <div className="fixed left-4 top-38.5 z-40">
          <div className="w-65 max-h-96 sm:max-h-[70vh] md:max-h-[75vh] bg-white p-4 flex flex-col items-start rounded-sm border shadow-lg overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-3 flex-shrink-0">Brush Tool</h3>

            {/* Color Picker */}
            <div className="mb-3 flex-shrink-0">
              <ColorPickerComponent color={selectedColor} onChange={setSelectedColor} />
            </div>

            <div className="w-full h-12 flex flex-row justify-between">
              {/* Add to Favorites Button */}
              <button
                className="border px-2 text-sm rounded-sm mb-3 hover:bg-gray-50 transition-colors"
                onClick={addFavoriteColor}
              >
                즐겨찾기 추가
              </button>

              {/* Canvas 스포이드 토글 */}
              <button
                className={`border p-2 px-1 rounded-sm mb-3 transition-colors ${isPickFromCanvas ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}
                onClick={() => setIsPickFromCanvas(!isPickFromCanvas)}
              >
                <Pipette className="h-4" />
              </button>
            </div>

            {/* Favorite Colors */}
            {favoriteColors.length > 0 && (
              <div className="mb-3 flex-shrink-0 w-full">
                <h4 className="text-sm font-medium text-gray-700 mb-2">즐겨찾기 색상</h4>
                <p className="text-xs text-gray-500 mb-2">Shift+클릭으로 삭제</p>
                <div className="flex flex-row flex-wrap gap-2 max-h-32 overflow-y-auto py-2 px-1">
                  {favoriteColors.map((c, idx) => (
                    <div
                      key={idx}
                      className="relative group cursor-pointer flex-shrink-0"
                    >
                      <div
                        className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                        style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
                        onClick={(e) => handleFavoriteColorClick(c, idx, e)}
                        title={`RGB(${c.r}, ${c.g}, ${c.b}) - Shift+클릭으로 삭제`}
                      />
                      {/* Selection indicator for current color */}
                      {selectedColor.r === c.r && selectedColor.g === c.g && selectedColor.b === c.b && (
                        <div className="absolute -inset-1 border-2 border-blue-500 rounded pointer-events-none" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fill Button */}
            <div className="flex-shrink-0">
              <button
                className="px-3 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors text-sm font-medium"
                onClick={handleFillPixel}
              >
                색칠하기
              </button>
              <p className="text-xs text-gray-500 mt-1">또는 Shift+Enter</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;