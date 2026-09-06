import { useCallback, useEffect, useState } from "react";
import { Canvas } from "./components/canvas/Canvas";
import { Intro } from "./components/intro/Intro"
import { useCanvas } from "./contexts/Canvas.context.tsx";
import { REDUCE_MOTION_STORAGE_KEY } from "./components/toolbar/Panel/Setting";

function App() {
  const { canvasSizeX, canvasSizeY } = useCanvas();
  const [displayIntro, setDisplayIntro] = useState(true);

  /**
   * 캔버스 크기를 알게 되는 즉시 마운트한다.
   * 인트로가 아직 덮고 있는 동안 뒤에서 청크가 도착하는 대로 그려지므로,
   * 인트로가 걷힐 때는 이미 완성된 캔버스가 드러난다.
   */
  const displayCanvas = canvasSizeX > 0 && canvasSizeY > 0;

  /**
   * 언마운트 시점은 인트로가 직접 알려준다.
   * (연출 길이가 로딩 속도에 따라 달라지므로 여기서 역산할 수 없다)
   */
  const handleIntroFinished = useCallback(() => setDisplayIntro(false), []);

  // 저장된 "애니메이션 줄이기" 설정을 최초 렌더 시점에 <html>에 반영한다.
  useEffect(() => {
    const reduceMotion = localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "true";
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, []);

  return (
    <>
      {displayIntro && <Intro onFinished={handleIntroFinished} />}
      {displayCanvas && <Canvas />}
    </>
  )
}

export default App;
