import { useEffect, useRef } from "react"
import { usePixel } from "../../contexts/Pixel.context";
import { PixelLoadStatus } from "../../contexts/enums/PixelLoadStatus.enum";
import { useCanvas } from "../../contexts/Canvas.context";

export const PixelField = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { pixels, pixelLoadStatus } = usePixel();
  const { setLoadedPixel } = useCanvas();
  

  // ==========================================
  // ===>       INITIALIZE                     
  // ==========================================
  /**
   * Initialize Effect
   */
  useEffect(() => {
    console.log("FLAG A")
    if (pixelLoadStatus !== PixelLoadStatus.FINISHED) return;
    console.log("Flag 1")
    const canvas = canvasRef.current;
    if (canvas) {
      console.log("Flag 2")
      const context = canvas?.getContext('2d');
      if (context) {
        console.log("Flag 3", pixels);
        let index = 0;
        pixels.forEach((pixel) => {
          context.fillStyle = `rgb(${pixel.colorR},${pixel.colorG},${pixel.colorB})`;
          context.fillRect(pixel.posX, pixel.posY, 1, 1);
          index++;
          setLoadedPixel(index);
        })
      }
    } else {

    }
  }, [pixels]);


  return (
    <canvas ref={canvasRef} className="border" width={1000} height={1000}>

    </canvas>
  )
}