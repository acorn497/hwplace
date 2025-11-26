import { useEffect, useState } from "react"
import { useSocket } from "../../contexts/Socket.context";
import { usePixel } from "../../contexts/Pixel.context";

export const Intro = () => {
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const { connectionStatus } = useSocket();
  const { loadedChunk, totalChunk, canvasStatus } = usePixel();
  const [loadingMessage, setLoadingMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // 0.5초 후 로딩바 표시 시작
    setTimeout(() => {
      setShowLoading(true);
      setLoadingMessage(connectionStatus);
    }, 750);
    // 1초 후 로딩 시작
    setTimeout(() => {
      setLoadingPercentage(prev => prev + 10);
      setLoadingMessage(connectionStatus);
    }, 950);
  }, []);

  useEffect(() => {
    if (!totalChunk) return;
    setLoadingMessage(canvasStatus + "(" + loadedChunk + "/" + totalChunk + ")");
    setLoadingPercentage(10 + (loadedChunk / totalChunk) * 90);
  }, [canvasStatus, loadedChunk, totalChunk])

  useEffect(() => {
    if (loadingPercentage === 100) {
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
    setTimeout(() => {
      setFadeOut(true);
    }, 1350)
  }, [showLoading, fadeOut])

  return (
    <div className={`w-screen h-screen flex flex-col justify-center items-center bg-linear-to-br from-white via-cyan-50 to-cyan-200 transition-opacity duration-400 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
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
            <span className="text-slate-800 text-xs font-light">{loadingMessage}</span>
            <div className={`bg-gray-200 transition-all duration-400 ${showLoading || fadeOut ? "w-40" : "w-0"} h-0.5 rounded-full relative mt-1.5`}>
              <div className="bg-cyan-400 h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: `${loadingPercentage}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}