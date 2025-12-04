import { useEffect, useState } from "react"
import { useSocket } from "../../contexts/Socket.context";
import { usePixel } from "../../contexts/Pixel.context.tsx";
import { useCanvas } from "../../contexts/Canvas.context.tsx";
import { CanvasStatus } from "../../contexts/enums/CanvasStatus.enum.ts";

export const Intro = () => {
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const { connectionStatus, startConnection } = useSocket();
  const { loadedChunk, totalChunk, pixelLoadStatus, pixels } = usePixel();
  const { canvasStatus, setCanvasStatus, loadedPixel } = useCanvas();
  const [loadingMessage, setLoadingMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  // ========================================
  // -- 애니메이션
  // ========================================
  useEffect(() => {
    setTimeout(() => {
      setShowLoading(true);
      setLoadingMessage(connectionStatus);
    }, 750);

    setTimeout(() => {
      setLoadingMessage(connectionStatus);
      setLoadingPercentage(prev => prev + 10);
    }, 950);
    setTimeout(() => {
      startConnection();
    }, 1850)
  }, []);

  //
  // 청크 로딩 구역 (10% ~ 90%)
  //
  useEffect(() => {
    if (!totalChunk) return;
    setLoadingMessage(pixelLoadStatus + "(" + loadedChunk + "/" + totalChunk + ")");
    setLoadingPercentage(10 + (loadedChunk / totalChunk) * 80);
  }, [pixelLoadStatus, loadedChunk, totalChunk]);

  //
  // 픽셀 렌더링 구력 (90% ~ 100%)
  //
  useEffect(() => {
    if (canvasStatus === CanvasStatus.WAITING || loadingPercentage === 100) return;
    setLoadingMessage(canvasStatus + "(" + loadedPixel + "/" + pixels.size + ")");
    if (!pixels.size) setLoadingPercentage(100);
    else setLoadingPercentage(90 + (loadedPixel / pixels.size) * 10);
  }, [canvasStatus, loadedPixel, pixels])

  useEffect(() => {
    if (loadingPercentage >= 100) {
      setCanvasStatus(CanvasStatus.FINISHED);
      setLoadingMessage("픽셀 렌더링 완료!")
      // FadeOutTTL1
      const timeout = setTimeout(() => {
        setShowLoading(false);
      }, 1100);
      return () => {
        clearTimeout(timeout)
      }
    }
  }, [loadingPercentage])

  useEffect(() => {
    if (showLoading || !(loadingPercentage === 100)) return;

    // FadeOutTTL2
    setTimeout(() => {
      // 인트로 페이드 아웃
      setFadeOut(true);
    }, 1350)
  }, [showLoading, fadeOut])

  //
  // -- 애니메이션 타이밍 끝
  // 

  return (
    // FadeOutTTL3 - 하단 div duration
    <div className={`duration-400 w-screen h-screen flex flex-col justify-center items-center bg-linear-to-br from-white via-cyan-50 to-cyan-100 transition-opacity ease-out ${fadeOut ? "opacity-0" : "opacity-100"} absolute z-1`}>
      <div className="relative py-10 px-12 rounded-md">
        <div className={`text-center transition-transform duration-500 ease-out ${showLoading ? 'translate-y-0' : 'translate-y-5'}`}>
          <h1 className="font-extrabold text-7xl tracking-tight leading-16 select-none">
            <span className="text-slate-800 drop-shadow-lg">HW</span>
            <span className="text-cyan-500 drop-shadow-[0_0_10px_rgba(12,185,218,0.2)]">Place</span>
          </h1>
          <p className="text-cyan-500/70 text-lg font-light tracking-wider">
            Collaborative Canvas LOL
          </p>
        </div>
        <div className="h-7 flex flex-col items-center justify-end">
          <div className={`flex flex-col items-center transition-all duration-250 ease-out ${!showLoading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-1.5'}`}>
            <span className="text-slate-800 text-[11px] font-light">{loadingMessage}</span>
            <div className={`bg-gray-200 transition-all duration-400 ${showLoading || fadeOut ? "w-40" : "w-0"} h-0.5 rounded-full relative mt-1`}>
              <div className="bg-cyan-400 h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: `${loadingPercentage}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}