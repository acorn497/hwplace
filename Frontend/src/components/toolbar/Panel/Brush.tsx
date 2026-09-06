import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { Tool } from "../../../contexts/enums/Tool.enum";
import { useEffect, useState } from "react";
import { ColorInput, hexToRgba, RgbColor, RgbColorPicker, rgbaToHex, rgbaToRgb, validHex } from "./Brush/ColorPicker";
import { Titlebox } from "../../common/Titlebox";
import { Button } from "../../common/Button";
import { PanelSection, PanelShell, LoginGate, SettingRow, SegmentedControl } from "../../common/PanelKit";
import { useCanvas } from "../../../contexts/Canvas.context";
import { DragMode } from "../../../contexts/enums/DragMode.enum";
import { usePixel } from "../../../contexts/Pixel.context";
import { FetchMethod, useFetch } from "../../../hooks/useFetch";
import { useAuth } from "../../../contexts/Auth.context";
import { useKeyboardShortcut } from "../../../hooks/useKeyboardShortcut";
import { useNotification } from "../../../contexts/Notification.context";
import { Type } from "../../../contexts/enums/Type.enum";
import { PaintBucket, Pipette } from "lucide-react";
import { BFS } from "../../../utils/bfs";

type ColorFormat = "RGB" | "HEX";
type RgbChannel = "r" | "g" | "b";

// 주변 픽셀 선택(페인트 버킷) 최대 개수 -- src/utils/bfs.ts 와 동일한 기준을 사용
const BFS_LIMIT = Number(import.meta.env.VITE_BFS_SIZE ?? 500);

// 최근 사용한 색상 저장 개수 / localStorage 키
const RECENT_COLOR_LIMIT = 8;
const RECENT_COLOR_KEY = "recentColors";

const FORMAT_OPTIONS: { value: ColorFormat; label: string }[] = [
  { value: "RGB", label: "RGB" },
  { value: "HEX", label: "HEX" },
];

const isRgbColor = (value: unknown): value is RgbColor => {
  if (!value || typeof value !== "object") return false;
  const { r, g, b } = value as RgbColor;
  return typeof r === "number" && typeof g === "number" && typeof b === "number";
}

// 색상 입력 필드 공통 클래스 -- Titlebox 배경 위에서 다크/라이트 모두 읽히도록 토큰만 사용
const COLOR_FIELD_CLASS =
  "w-full appearance-none bg-transparent aritta-font tracking-wide text-content placeholder:text-content-subtle focus-ring transition-colors";

export const Brush = () => {
  const { setActiveTool } = useGlobalVariable();
  const { cursorPosition, dragMode, isLeftDown, isCloneColorActive, setIsCloneColorActive, isPaintBucketActive, setIsPaintBucketActive, canvasSizeX, canvasSizeY } = useCanvas();
  const { selectedPixels, setSelectedPixels, getPixelColor } = usePixel();
  const { accessToken } = useAuth();
  const { setNotification } = useNotification();

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

  // RGB / HEX 입력 포맷 -- 새로고침 후에도 유지되도록 R/G/B 값과 함께 저장
  const [colorFormat, setColorFormat] = useState<ColorFormat>(() => {
    return localStorage.getItem('FORMAT') === 'HEX' ? 'HEX' : 'RGB';
  });

  // 칠하기 요청 진행 중 여부 -- 중복 제출 방지
  const [isPaintPending, setIsPaintPending] = useState(false);

  const [recentColors, setRecentColors] = useState<RgbColor[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_COLOR_KEY) ?? '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(isRgbColor).slice(0, RECENT_COLOR_LIMIT);
    } catch {
      return [];
    }
  });

  // R/G/B 숫자 입력창 임시 텍스트 -- 입력 도중 빈 문자열을 허용하기 위한 상태
  const [rgbDraft, setRgbDraft] = useState({
    r: currentColor.r.toString(),
    g: currentColor.g.toString(),
    b: currentColor.b.toString(),
  });
  const [editingField, setEditingField] = useState<RgbChannel | null>(null);

  // HEX 입력창 유효성 표시 상태
  const [isHexInvalid, setIsHexInvalid] = useState(false);

  const clampColor = (value: number) => Math.max(0, Math.min(255, value));

  useEffect(() => {
    if (!isNaN(currentColor.r) && !isNaN(currentColor.g) && !isNaN(currentColor.b)) {
      localStorage.setItem('R', currentColor.r.toString());
      localStorage.setItem('G', currentColor.g.toString());
      localStorage.setItem('B', currentColor.b.toString());
    }
  }, [currentColor]);

  useEffect(() => {
    localStorage.setItem('FORMAT', colorFormat);
  }, [colorFormat]);

  // 편집 중이 아닌 필드만 currentColor 기준으로 동기화 (편집 중인 필드는 사용자가 지운 값을 유지)
  useEffect(() => {
    setRgbDraft(prev => ({
      r: editingField === 'r' ? prev.r : currentColor.r.toString(),
      g: editingField === 'g' ? prev.g : currentColor.g.toString(),
      b: editingField === 'b' ? prev.b : currentColor.b.toString(),
    }));
  }, [currentColor, editingField]);

  const handleRgbFieldChange = (field: RgbChannel) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setRgbDraft(prev => ({ ...prev, [field]: raw }));

    if (raw === '') return; // 지우는 중에는 currentColor를 건드리지 않음

    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;

    setCurrentColor(prev => ({ ...prev, [field]: clampColor(parsed) }));
  };

  const handleRgbFieldFocus = (field: RgbChannel) => () => setEditingField(field);

  const handleRgbFieldBlur = (field: RgbChannel) => () => {
    setEditingField(null);
    setRgbDraft(prev => {
      const parsed = parseInt(prev[field], 10);
      const clamped = isNaN(parsed) ? currentColor[field] : clampColor(parsed);
      if (clamped !== currentColor[field]) {
        setCurrentColor(color => ({ ...color, [field]: clamped }));
      }
      return { ...prev, [field]: clamped.toString() };
    });
  };

  // HEX <-> RGB 변환은 ColorPicker.tsx의 검증된 헬퍼를 그대로 사용
  const hexEscape = (value: string) => value.replace(/([^0-9A-F]+)/gi, "").substring(0, 6);
  const hexFormat = (value: string) => ("#" + value).toUpperCase();
  const hexProcess = (value: string) => "#" + value;
  const validateHex = (value: string) => {
    const valid = validHex(value);
    setIsHexInvalid(!valid);
    return valid;
  };

  const pushRecentColor = (color: RgbColor) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => !(c.r === color.r && c.g === color.g && c.b === color.b));
      const next = [{ r: color.r, g: color.g, b: color.b }, ...filtered].slice(0, RECENT_COLOR_LIMIT);
      localStorage.setItem(RECENT_COLOR_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handlePaintPixels = async () => {
    if (selectedPixels.length === 0 || isPaintPending) return;

    setIsPaintPending(true);

    const paintRequest = selectedPixels.map(pixel => ({
      posX: pixel.x,
      posY: pixel.y,
      colorR: currentColor.r,
      colorG: currentColor.g,
      colorB: currentColor.b
    }));

    try {
      const result = await useFetch(FetchMethod.POST, '/paint', paintRequest);
      const status = result.internalStatusCode?.toString();

      if (!status?.match('0000')) {
        setNotification({
          title: '칠하기',
          content: result.message || '칠하기에 실패했습니다. 잠시 후 다시 시도해주세요.',
          type: Type.WARNING
        });
        return;
      }

      setNotification({ title: '칠하기', content: `${paintRequest.length}개의 픽셀을 칠했습니다.` });
      pushRecentColor(currentColor);
      setSelectedPixels([]);
    } catch {
      setNotification({ title: '칠하기', content: '서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', type: Type.ERROR });
    } finally {
      setIsPaintPending(false);
    }
  };

  const handleCloneColor = () => {
    setCurrentColor(getPixelColor(cursorPosition.x, cursorPosition.y));
  }

  const handlePaintBucket = () => {
    const targetColor = getPixelColor(cursorPosition.x, cursorPosition.y);
    const bfsResult = BFS(cursorPosition.x, cursorPosition.y, targetColor, getPixelColor, canvasSizeX, canvasSizeY);

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

  const isPaintDisabled = isPaintPending || selectedPixels.length === 0;

  const dragModeSurface =
    dragMode === DragMode.SELECT
      ? "bg-accent-soft"
      : dragMode === DragMode.CANCEL
        ? "bg-danger-surface"
        : "bg-surface-hover";

  return (
    <PanelShell title="색칠하기">
      <div className="relative h-full min-h-0">
        <div className="grid grid-cols-[2fr_3fr] gap-x-2.5 h-full min-h-0">
          {/* 색상 선택 / 입력 */}
          <PanelSection className="relative z-0 min-h-0 overflow-hidden gap-1.5">
            <RgbColorPicker color={currentColor} onChange={setCurrentColor} />

            <SettingRow label="포맷">
              <SegmentedControl
                options={FORMAT_OPTIONS}
                value={colorFormat}
                onChange={setColorFormat}
                label="색상 포맷"
              />
            </SettingRow>

            {colorFormat === 'RGB' ? (
              <div className="grid grid-cols-3 gap-x-1">
                <Titlebox title="R">
                  <input
                    type="number"
                    className={COLOR_FIELD_CLASS}
                    minLength={1}
                    maxLength={3}
                    min={0}
                    max={255}
                    value={rgbDraft.r}
                    onChange={handleRgbFieldChange('r')}
                    onFocus={handleRgbFieldFocus('r')}
                    onBlur={handleRgbFieldBlur('r')}
                  />
                </Titlebox>
                <Titlebox title="G">
                  <input
                    type="number"
                    className={COLOR_FIELD_CLASS}
                    minLength={1}
                    maxLength={3}
                    min={0}
                    max={255}
                    value={rgbDraft.g}
                    onChange={handleRgbFieldChange('g')}
                    onFocus={handleRgbFieldFocus('g')}
                    onBlur={handleRgbFieldBlur('g')}
                  />
                </Titlebox>
                <Titlebox title="B">
                  <input
                    type="number"
                    className={COLOR_FIELD_CLASS}
                    minLength={1}
                    maxLength={3}
                    min={0}
                    max={255}
                    value={rgbDraft.b}
                    onChange={handleRgbFieldChange('b')}
                    onFocus={handleRgbFieldFocus('b')}
                    onBlur={handleRgbFieldBlur('b')}
                  />
                </Titlebox>
              </div>
            ) : (
              <Titlebox title="HEX">
                <ColorInput
                  color={rgbaToHex({ ...currentColor, a: 1 })}
                  onChange={(value) => setCurrentColor(rgbaToRgb(hexToRgba(value)))}
                  onBlur={() => setIsHexInvalid(false)}
                  escape={hexEscape}
                  validate={validateHex}
                  format={hexFormat}
                  process={hexProcess}
                  placeholder="#3A7676"
                  className={`${COLOR_FIELD_CLASS} ${isHexInvalid ? 'ring-2 ring-danger rounded-sm' : ''}`}
                />
              </Titlebox>
            )}
          </PanelSection>

          {/* 액션 / 상태 / 최근 색상 */}
          <PanelSection className="min-h-0 overflow-hidden justify-between">
            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex gap-2">
                <div
                  className="w-15 h-15 shrink-0 rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: `rgb(${currentColor.r},${currentColor.g},${currentColor.b})` }}
                  title={`rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`}
                />
                <div className="flex-1 flex-row flex h-15 min-w-0">
                  <Button display="칠하기" hint="선택된 픽셀을 칠합니다." keybind="Enter" callback={handlePaintPixels} disabled={isPaintDisabled} />
                  <Button
                    className={isCloneColorActive ? 'bg-accent-soft text-accent' : ''}
                    hint="선택된 픽셀의 색상을 복사합니다."
                    keybind="C"
                    callback={() => setIsCloneColorActive(!isCloneColorActive)}
                  >
                    <Pipette className="w-5 h-5" />
                  </Button>
                  <Button
                    className={isPaintBucketActive ? 'bg-accent-soft text-accent' : ''}
                    hint={`주변 픽셀 최대 ${BFS_LIMIT}개를 ${dragMode === DragMode.CANCEL ? "취소" : "선택"}합니다.`}
                    keybind="F"
                    callback={() => setIsPaintBucketActive(!isPaintBucketActive)}
                  >
                    <PaintBucket className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Titlebox title="DRAG MODE" className={`col-span-2 transition-colors ${dragModeSurface}`}>
                  {dragMode}
                </Titlebox>

                <Titlebox title="CURSOR" className="bg-surface-hover">
                  ({cursorPosition.x}, {cursorPosition.y})
                </Titlebox>
                <Titlebox title="SELECTED" className="bg-surface-hover">
                  {selectedPixels.length}
                </Titlebox>
              </div>
            </div>

            <SettingRow label="최근 색상">
              <div className="flex flex-wrap justify-end gap-1 max-w-40">
                {recentColors.length === 0 ? (
                  <span className="text-[10px] text-content-subtle">없음</span>
                ) : (
                  recentColors.map((color, index) => (
                    <button
                      key={`${color.r}-${color.g}-${color.b}-${index}`}
                      type="button"
                      onClick={() => setCurrentColor(color)}
                      title={`rgb(${color.r}, ${color.g}, ${color.b})`}
                      className="focus-ring w-4 h-4 rounded-sm border border-border-strong ring-1 ring-border hover:scale-110 hover:cursor-pointer transition-transform shrink-0"
                      style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                    />
                  ))
                )}
              </div>
            </SettingRow>
          </PanelSection>
        </div>

        {!accessToken ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface-solid/90 backdrop-blur-sm">
            <LoginGate message="로그인 후 이용하실 수 있습니다." onGoToLogin={() => setActiveTool(Tool.PROFILE)} />
          </div>
        ) : null}
      </div>
    </PanelShell>
  )
}
