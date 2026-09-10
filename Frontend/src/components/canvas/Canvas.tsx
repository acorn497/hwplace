import { useGlobalVariable } from "../../contexts/GlobalVariable.context"
import { usePixel } from "../../contexts/Pixel.context";
import { Panel } from "../toolbar/Panel"
import { Toolbar } from "../toolbar/Toolbar"
import { PixelField } from "./PixelField"
import { PixelInfo } from "./PixelInfo"
import { ReplayBar } from "../replay/ReplayBar"
import { useReplay } from "../../contexts/Replay.context"

const POSITION_CLASSES = {
  'top-left': 'translate-x-0 translate-y-0',
  'top-right': 'translate-x-[calc(100vw-100%-3rem)] translate-y-0',
  'bottom-left': 'translate-x-0 translate-y-[calc(100vh-100%-3rem)]',
  'bottom-right': 'translate-x-[calc(100vw-100%-3rem)] translate-y-[calc(100vh-100%-3rem)]',
  'bottom-center': 'translate-x-[calc(50vw-50%)] translate-y-[calc(100vh-100%-8.5rem)]',
} as const;

/*
  화면 레이어 순서.

  캔버스(PixelField)는 스스로 스태킹 컨텍스트(z-0)를 열어 내부 레이어를 가둔다.
  그 위에 얹히는 UI는 여기서 명시적으로 층을 정한다. z-index를 비워두면 auto(=0)가 되어
  캔버스 내부 요소와 같은 층에서 경쟁하게 되므로, UI는 반드시 값을 갖는다.

  전체 층 구성:
     0  PixelField 뷰포트 (내부 그리드 z-5 / 커서 z-10 은 이 안에 갇힌다)
    10  픽셀 정보
    20  패널, 툴바
    40  리플레이 바 (ReplayBar 안에 지정)
    50  인트로 (로딩 중 화면 전체를 덮으므로 UI보다 위)
   100  버튼 툴팁 (body로 portal 되므로 별도 최상단)
*/
export const Canvas = () => {
  const { panelPosition } = useGlobalVariable();
  const { selectedPixel } = usePixel();
  const { isActive: isReplaying } = useReplay();
  const positionClass = POSITION_CLASSES[panelPosition] || POSITION_CLASSES['bottom-center'];

  return (
    <>
      <PixelField />
      {/* 리플레이 중에는 과거 화면이므로 픽셀 정보/도구를 숨긴다 */}
      {!isReplaying && <PixelInfo selectedPixel={selectedPixel} />}
      {!isReplaying && (
        <div className={`fixed z-20 left-6 top-6 ${positionClass} transition-all duration-300 ease-in-out`}>
          <Panel />
        </div>
      )}
      {!isReplaying && <Toolbar />}
      <ReplayBar />
    </>
  )
}