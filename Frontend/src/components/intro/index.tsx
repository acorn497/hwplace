import { useEffect, useState } from "react"
import { useSocket } from "../../contexts/SocketContext";
import { usePixel } from "../../contexts/PixelContext";

export const Intro = () => {
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [showLoading, setShowLoading] = useState(false);

  const { connectionStatus } = useSocket();
  const { loadedChunk, totalChunk, canvasStatus } = usePixel();

  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    // 0.5초 후 로딩바 표시 시작
    setTimeout(() => {
      setShowLoading(true);
      setLoadingMessage(connectionStatus);
    }, 500);

    // 1초 후 로딩 시작
    setTimeout(() => {
      setLoadingPercentage(prev => prev + 10);
      setLoadingMessage(connectionStatus);
    }, 750);
  }, []);

  useEffect(() => {
    if (!totalChunk) return;
    setLoadingMessage(canvasStatus + "(" + loadedChunk + "/" + totalChunk + ")");
    setLoadingPercentage(10 + (loadedChunk / totalChunk) * 70);
    console.log(loadedChunk / totalChunk)
  }, [canvasStatus, loadedChunk, totalChunk])

  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center bg-linear-to-br from-white via-cyan-50 to-cyan-200">
      <div className="relative py-10 px-12 rounded-md">
        <div className={`text-center z-10 transition-transform duration-300 ${showLoading ? 'translate-y-0' : 'translate-y-5'}`}>
          <h1 className="font-extrabold text-7xl tracking-tight leading-16 select-none">
            <span className="text-slate-800 drop-shadow-lg">HW</span>
            <span className="text-cyan-500 drop-shadow-[0_0_10px_rgba(12,185,218,0.2)]">Place</span>
          </h1>
          <p className="text-cyan-500/70 text-lg font-light tracking-wider">
            Collaborative Canvas LOL
          </p>
        </div>

        <div className={`flex flex-col items-center transition-all duration-300 ${showLoading ? 'opacity-100 translate-y-3' : 'opacity-0 translate-y-1'}`}>
          <span className="text-slate-800 text-xs">{loadingMessage}</span>
          <div className="bg-gray-200 w-40 h-1 rounded-full relative mt-1.5">
            <div className="bg-cyan-400 h-full rounded-full transition-[width] duration-250" style={{ width: `${loadingPercentage}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}