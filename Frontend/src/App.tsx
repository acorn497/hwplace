import { useEffect, useState } from "react";
import { Canvas } from "./components/canvas/Canvas";
import { Intro } from "./components/intro/Intro"
import { PixelLoadStatus } from "./contexts/enums/PixelLoadStatus.enum";
import { usePixel } from "./contexts/Pixel.context.tsx"
import { useCanvas } from "./contexts/Canvas.context.tsx";
import { CanvasStatus } from "./contexts/enums/CanvasStatus.enum.ts";

function App() {
  const { pixelLoadStatus } = usePixel();
  const { canvasStatus } = useCanvas();
  const [displayCanvas, setDisplayCanvas] = useState(false);
  const [displayIntro, setDisplayIntro] = useState(true);

  /**
   * TTL 계산
   * /src/Intro.tsx
   * FadeOutTTL1 + FadeOutTTL2 + FadeOutTTL3
   */
  const ttl = 1100 + 1350 + 400;

  useEffect(() => {
    if (pixelLoadStatus === PixelLoadStatus.FINISHED) {
      console.log("Loaded CANVAS")
      setTimeout(() => {
        setDisplayCanvas(true);
      }, 500)
    }
  }, [pixelLoadStatus])

  useEffect(() => {
    if (canvasStatus === CanvasStatus.FINISHED) {
      setTimeout(() => {
        setDisplayIntro(false);
      }, ttl)
    }
  }, [canvasStatus]);

  return (
    <>
      {displayIntro && <Intro />}
      {displayCanvas && <Canvas />}
    </>
  )
}

export default App;
