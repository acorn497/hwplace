import React, { useState, useEffect, useCallback, useRef } from "react";
import { Socket, io } from 'socket.io-client';
import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import StatusPanel from "./components/StatusPanel";
import { Pixel } from "./components/Types";
import Notification, { NotificationHandle, types } from "./components/Notification";
import { BatchPixelUpdateData, BatchPixelUpdatedResponse, MessageData, NotificationType, ServerPixel } from "./types";
import axios from "axios";


// API Functions
const fetchCanvasInfo = async (): Promise<{ sizeX: number; sizeY: number } | null> => {
  try {
    const response = await fetch(import.meta.env.VITE_BACKEND_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return {
      sizeX: data.canvasInfo.sizeX,
      sizeY: data.canvasInfo.sizeY
    };
  } catch (error) {
    console.error('Failed to fetch canvas info:', error);
    return null;
  }
};

const fetchPixelData = async (): Promise<ServerPixel[]> => {
  try {
    const response = await fetch(import.meta.env.VITE_BACKEND_URL + '/paint');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch pixel data:', error);
    return [];
  }
};

const saveBatchPixels = async (pixels: { posX: number; posY: number; colorR: number; colorG: number; colorB: number }[]): Promise<ServerPixel[] | null> => {
  console.log(pixels);
  return await axios.post(import.meta.env.VITE_BACKEND_URL + '/paint', pixels)
    .then((response) => {
      return response.data.pixels;
    })
    .catch((error) => {
      console.log(error);
      return null;
    })
};

// UUID Generate Function
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const SimpleCanvasPan: React.FC<{ width?: number; height?: number; roomId?: string }> = ({
  width: initialWidth = 500,
  height: initialHeight = 500,
}) => {
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [pixelSize, setPixelSize] = useState(20);
  const [offsetX, setOffsetX] = useState(600 - (initialWidth * 20) / 2);
  const [offsetY, setOffsetY] = useState(400 - (initialHeight * 20) / 2);
  const [mousePixelPos, setMousePixelPos] = useState<{ x: number; y: number } | null>(null);
  const [pinnedPositions, setPinnedPositions] = useState<{ x: number; y: number }[]>([]);
  const [isGridActive, setIsGridActive] = useState(true);
  const [activeTool, setActiveTool] = useState<"settings" | "brush" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocalStorageEnabled, setIsLocalStorageEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('hwplace:lsEnabled');
      return v ? JSON.parse(v) : false;
    } catch {
      return false;
    }
  });

  // Socket.IO States
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; message: string; timestamp: string }[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastDataLoadTime, setLastDataLoadTime] = useState<Date | null>(null);
  const [isRenewed, setIsRenewed] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const userUUID = useRef<string>(generateUUID());

  // Reset Pixel Datas
  const [pixelData, setPixelData] = useState<Pixel[][]>(() =>
    Array.from({ length: initialHeight }, () =>
      Array.from({ length: initialWidth }, () => ({ r: 255, g: 255, b: 255 }))
    )
  );

  const [selectedColor, setSelectedColor] = useState<Pixel>({ r: 255, g: 0, b: 0 });
  const [favoriteColors, setFavoriteColors] = useState<Pixel[]>([]);
  const [isPickFromCanvas, setIsPickFromCanvas] = useState(false);

  // Load canvas size first
  useEffect(() => {
    const loadCanvasSize = async () => {
      const size = await fetchCanvasInfo();
      if (size) {
        setCanvasSize({ width: size.sizeX, height: size.sizeY });
        setOffsetX(600 - (size.sizeX * 20) / 2);
        setOffsetY(400 - (size.sizeY * 20) / 2);
      } else {
        // Fallback to initial values
        setCanvasSize({ width: initialWidth, height: initialHeight });
      }
    };
    loadCanvasSize();
  }, [initialWidth, initialHeight]);

  const width = canvasSize?.width ?? initialWidth;
  const height = canvasSize?.height ?? initialHeight;

  // LocalStorage - load persisted states once on mount
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try {
      const storedActiveTool = localStorage.getItem('hwplace:activeTool');
      if (storedActiveTool === 'settings' || storedActiveTool === 'brush' || storedActiveTool === 'null') {
        setActiveTool(storedActiveTool === 'null' ? null : (storedActiveTool as "settings" | "brush"));
      }

      const storedGrid = localStorage.getItem('hwplace:isGridActive');
      if (storedGrid !== null) setIsGridActive(JSON.parse(storedGrid));

      const storedPicker = localStorage.getItem('hwplace:isPickFromCanvas');
      if (storedPicker !== null) setIsPickFromCanvas(JSON.parse(storedPicker));

      const storedColor = localStorage.getItem('hwplace:selectedColor');
      if (storedColor) setSelectedColor(JSON.parse(storedColor));

      const storedFav = localStorage.getItem('hwplace:favorites');
      if (storedFav) setFavoriteColors(JSON.parse(storedFav));

      const storedView = localStorage.getItem('hwplace:view');
      if (storedView) {
        const v = JSON.parse(storedView);
        if (typeof v.pixelSize === 'number') setPixelSize(v.pixelSize);
        if (typeof v.offsetX === 'number') setOffsetX(v.offsetX);
        if (typeof v.offsetY === 'number') setOffsetY(v.offsetY);
      }

      const storedPinned = localStorage.getItem('hwplace:pinned');
      if (storedPinned) setPinnedPositions(JSON.parse(storedPinned));
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Persist enable flag
  useEffect(() => {
    try { localStorage.setItem('hwplace:lsEnabled', JSON.stringify(isLocalStorageEnabled)); } catch { }
  }, [isLocalStorageEnabled]);

  // Persist selected color
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:selectedColor', JSON.stringify(selectedColor)); } catch { }
  }, [isLocalStorageEnabled, selectedColor]);

  // Persist favorites
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:favorites', JSON.stringify(favoriteColors)); } catch { }
  }, [isLocalStorageEnabled, favoriteColors]);

  // Persist active tool and grid and picker
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:activeTool', activeTool === null ? 'null' : activeTool); } catch { }
  }, [isLocalStorageEnabled, activeTool]);

  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:isGridActive', JSON.stringify(isGridActive)); } catch { }
  }, [isLocalStorageEnabled, isGridActive]);

  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:isPickFromCanvas', JSON.stringify(isPickFromCanvas)); } catch { }
  }, [isLocalStorageEnabled, isPickFromCanvas]);

  // Persist view (zoom/offset)
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:view', JSON.stringify({ pixelSize, offsetX, offsetY })); } catch { }
  }, [isLocalStorageEnabled, pixelSize, offsetX, offsetY]);

  // Persist pinned positions
  useEffect(() => {
    if (!isLocalStorageEnabled) return;
    try { localStorage.setItem('hwplace:pinned', JSON.stringify(pinnedPositions)); } catch { }
  }, [isLocalStorageEnabled, pinnedPositions]);

  const clearLocalStorageData = useCallback(() => {
    try {
      localStorage.removeItem('hwplace:activeTool');
      localStorage.removeItem('hwplace:isGridActive');
      localStorage.removeItem('hwplace:isPickFromCanvas');
      localStorage.removeItem('hwplace:selectedColor');
      localStorage.removeItem('hwplace:favorites');
      localStorage.removeItem('hwplace:view');
      localStorage.removeItem('hwplace:pinned');
    } catch { }
  }, []);

  // Pixel Data Update Function
  const updatePixelData = useCallback((updateFn: (prevData: Pixel[][]) => Pixel[][]) => {
    setPixelData(prev => {
      const newData = updateFn(prev);

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('canvas-force-update', {
          detail: { timestamp: Date.now() }
        }));
      }, 0);

      return newData;
    });
  }, []);

  const loadPixelData = useCallback(async () => {
    if (!canvasSize) return;

    try {
      setIsLoadingData(true);
      console.log('픽셀 데이터 로드 중...');
      const serverPixels = await fetchPixelData();
      setIsConnected(serverPixels.length <= 0 ? false : true);

      updatePixelData(() => {
        const newPixelData: Pixel[][] = Array.from({ length: canvasSize.height }, () =>
          Array.from({ length: canvasSize.width }, () => ({ r: 255, g: 255, b: 255 }))
        );

        serverPixels.forEach(pixel => {
          const { PIXEL_POS_X: x, PIXEL_POS_Y: y, PIXEL_COLOR_R: r, PIXEL_COLOR_G: g, PIXEL_COLOR_B: b } = pixel;
          if (y >= 0 && y < canvasSize.height && x >= 0 && x < canvasSize.width) {
            newPixelData[y][x] = { r, g, b };
          }
        });

        return newPixelData;
      });

      setIsRenewed(true);
      setLastDataLoadTime(new Date());
      console.log('픽셀 데이터 로드 완료');
    } catch (error) {
      console.error('픽셀 데이터 로드 실패:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [canvasSize, updatePixelData]);

  useEffect(() => {
    if (canvasSize) {
      loadPixelData();
    }
  }, [loadPixelData, canvasSize]);

  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    const newPixelSize = Math.max(1, Math.min(50, pixelSize + delta));
    if (centerX !== undefined && centerY !== undefined) {
      const worldX = (centerX - offsetX) / pixelSize;
      const worldY = (centerY - offsetY) / pixelSize;
      setOffsetX(centerX - worldX * newPixelSize);
      setOffsetY(centerY - worldY * newPixelSize);
    }
    setPixelSize(newPixelSize);
  }, [pixelSize, offsetX, offsetY]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setOffsetX(prev => prev + deltaX);
    setOffsetY(prev => prev + deltaY);
  }, []);

  const handleMouseMove = useCallback((pixelX: number, pixelY: number) => {
    setMousePixelPos({ x: pixelX, y: pixelY });
  }, []);

  const handlePixelClick = useCallback((pixelX: number, pixelY: number) => {
    setPinnedPositions(prev => {
      const exists = prev.some(pos => pos.x === pixelX && pos.y === pixelY);
      if (exists) return prev.filter(pos => !(pos.x === pixelX && pos.y === pixelY));
      return [...prev, { x: pixelX, y: pixelY }];
    });
  }, []);

  const handleFillPixel = useCallback(async () => {
    if (pinnedPositions.length === 0) return;

    setIsSaving(true);

    try {
      const uniquePositionsMap = new Map<string, { x: number; y: number }>();
      pinnedPositions.forEach(pos => {
        const key = `${pos.x},${pos.y}`;
        if (!uniquePositionsMap.has(key)) {
          uniquePositionsMap.set(key, pos);
        }
      });
      const uniquePositions = Array.from(uniquePositionsMap.values());

      const validPixels = uniquePositions.filter(
        pos => pos.y >= 0 && pos.y < height && pos.x >= 0 && pos.x < width
      );

      if (validPixels.length === 0) {
        setPinnedPositions([]);
        return;
      }

      const batchPixelData = validPixels.map(pos => ({
        posX: pos.x,
        posY: pos.y,
        colorR: selectedColor.r,
        colorG: selectedColor.g,
        colorB: selectedColor.b
      }));

      const savedPixels = await saveBatchPixels(batchPixelData);

      if (savedPixels && savedPixels.length > 0) {
        updatePixelData(prev => {
          const newData = prev.map(row => [...row]);
          savedPixels.forEach(pixel => {
            const { PIXEL_POS_X: x, PIXEL_POS_Y: y, PIXEL_COLOR_R: r, PIXEL_COLOR_G: g, PIXEL_COLOR_B: b } = pixel;
            if (y >= 0 && y < height && x >= 0 && x < width) {
              newData[y][x] = { r, g, b };
            }
          });
          return newData;
        });

        if (socketRef.current && isConnected) {
          const batchUpdateData: BatchPixelUpdateData = {
            pixels: savedPixels.map(pixel => ({
              x: pixel.PIXEL_POS_X,
              y: pixel.PIXEL_POS_Y,
              color: {
                r: pixel.PIXEL_COLOR_R,
                g: pixel.PIXEL_COLOR_G,
                b: pixel.PIXEL_COLOR_B
              }
            })),
            uuid: userUUID.current
          };

          socketRef.current.emit('batch-pixel-update', batchUpdateData);
        }
      }

      setPinnedPositions([]);

    } catch (error) {
      console.error('Error saving batch pixels:', error);
      await loadPixelData();
    } finally {
      setIsSaving(false);
    }
  }, [pinnedPositions, selectedColor, height, width, updatePixelData, isConnected, loadPixelData]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && isConnected) {
      const messageData: MessageData = {
        message: message,
        sender: `User-${userUUID.current.slice(0, 8)}`
      };

      socketRef.current.emit('send-message', messageData);
    }
  }, [isConnected]);

  const addFavoriteColor = useCallback(() => {
    setFavoriteColors(prev => {
      if (!prev.some(c => c.r === selectedColor.r && c.g === selectedColor.g && c.b === selectedColor.b)) {
        return [...prev, selectedColor];
      }
      return prev;
    });
  }, [selectedColor]);

  const removeFavoriteColor = useCallback((index: number) => {
    setFavoriteColors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handlePickColorAt = useCallback((x: number, y: number) => {
    if (y >= 0 && y < height && x >= 0 && x < width) {
      const picked = pixelData[y][x];
      setSelectedColor(picked);
      setIsPickFromCanvas(false);
    }
  }, [height, width, pixelData]);

  const toggleGrid = useCallback(() => setIsGridActive(prev => !prev), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.shiftKey && e.key === "Enter" && !isSaving) {
      handleFillPixel();
    }
  }, [handleFillPixel, isSaving]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const msgRef = useRef<HTMLDivElement | null>(null);
  const [counter, setCounter] = useState(0);
  const [unableToConnect, setUnableToConnect] = useState(false);
  const notificationRef = useRef<NotificationHandle>(null);
  const errorNotificationIdRef = useRef<number | null>(null);
  const [displayingNotification, setDisplayingNotification] = useState<NotificationType | null>(null);

  useEffect(() => {
    if (msgRef.current) {
      msgRef.current.scrollTop = msgRef.current.scrollHeight;
    }
  }, [messages]);

  const [notifications, setNotifications] = useState<NotificationType[]>([
    { title: "Greetings!", content: "Welcome to HWPlace.", method: types.OK, duration: 2 }
  ]);

  useEffect(() => {
    setDisplayingNotification(notifications[0]);
    console.log(notifications)
  }, [notifications]);

  function handleOnFinish() {
    setNotifications((prev) => prev?.slice(1));
    setDisplayingNotification(null);
  }

  useEffect(() => {
    setCounter((prev) => prev + 1);
  }, [displayingNotification]);

  useEffect(() => {
    console.log("unableToConnect, DisplayingNotification")
    if (unableToConnect && displayingNotification?.id !== errorNotificationIdRef.current) {
      errorNotificationIdRef.current = 503;
      setNotifications((prev) => [...prev, { id: 503, title: "Server Connection Lost", content: "현재 HWPlace Live 서비스에 연결할 수 없습니다.", method: types.ERROR, duration: Infinity }]);
    } else if (!unableToConnect && displayingNotification?.id === errorNotificationIdRef.current) {
      setNotifications((prev) => [...prev, { title: "Server Connection Established", content: "HWPlace Live 서비스와 연결되었습니다.", method: types.INFO, duration: 2 }]);
      notificationRef.current?.triggerClose();
      errorNotificationIdRef.current = null;
    }
  }, [unableToConnect, displayingNotification]);

  useEffect(() => {
    console.log("unableToConnect: " + unableToConnect)
  }, [unableToConnect])

  const connectSocket = useCallback(() => {
    try {
      const socket = io(import.meta.env.VITE_BACKEND_URL, {
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
        setUnableToConnect(false);
      });

      const handleBatchPixelsUpdated = (data: BatchPixelUpdatedResponse) => {
        updatePixelData(prev => {
          const newData = prev.map(row => [...row]);
          data.pixels.forEach(({ x, y, color }) => {
            if (y >= 0 && y < height && x >= 0 && x < width) {
              newData[y][x] = color;
            }
          });
          return newData;
        });
      };

      socket.on('batch-pixels-updated', handleBatchPixelsUpdated);

      socket.on('receive-message', (data: { message: string; sender: string; timestamp: string }) => {
        setMessages(prev => [...prev, data]);
      });

      socket.on('disconnect', (reason: string) => {
        console.log('Socket.IO disconnected:', reason);
        setIsConnected(false);
        setIsRenewed(false);
        if (reason !== 'io client disconnect') {
          setConnectionError('서버와의 연결이 끊어졌습니다.');
        }
      });

      socket.on('connect_error', () => {
        setIsConnected(false);
        setConnectionError('서버에 연결할 수 없습니다.');
        setIsRenewed(false);
        setUnableToConnect(true);
        console.log("connect_error called");
      });
    } catch (error) {
      setConnectionError('소켓 연결을 생성할 수 없습니다.');
    }
  }, [height, width, updatePixelData]);

  useEffect(() => {
    if (canvasSize) {
      connectSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connectSocket, canvasSize]);

  const handleReconnect = useCallback(() => {
    setConnectionError(null);
    connectSocket();
  }, [connectSocket]);

  // Don't render until canvas size is loaded
  if (!canvasSize) {
    return (
      <div className="w-full h-full">
        {displayingNotification && <Notification key={counter} title={displayingNotification.title} content={displayingNotification.content} method={displayingNotification.method} callback={() => handleOnFinish()} duration={displayingNotification.duration} ref={notificationRef} />}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white">캔버스 정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {displayingNotification && <Notification key={counter} title={displayingNotification.title} content={displayingNotification.content} method={displayingNotification.method} callback={() => handleOnFinish()} duration={displayingNotification.duration} ref={notificationRef} />}

      <div className="background top-4 right-4 z-50">
        <div className="text-sm space-y-2">
          <div className={`flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="text-white">UUID: {userUUID.current.slice(0, 8)}...</div>

          {/* Data Loading State */}
          <div className="border-t pt-2 border-border-primary">
            <div className="flex items-center gap-2 text-white">
              <div className={`w-2 h-2 rounded-full ${isLoadingData ? 'bg-yellow-500' : isConnected ? isRenewed ? 'bg-green-400' : "bg-red-500" : "bg-red-500"}`}></div>
              {isLoadingData ? '데이터 로딩 중...' : isConnected ? isRenewed ? '데이터 로드됨' : '갱신되지 않음' : '연결되지 않음'}
            </div>
            {lastDataLoadTime && (
              <div className="text-xs text-gray-300">
                마지막 업데이트: {lastDataLoadTime.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={loadPixelData}
              disabled={isLoadingData}
              className="mt-1 px-2 py-1 bg-blue-500 rounded text-xs disabled:bg-gray-400"
            >
              {isLoadingData ? '로딩 중...' : '새로고침'}
            </button>
          </div>

          {connectionError && (
            <div className="text-red-600 text-xs">
              {connectionError}
              <button
                onClick={handleReconnect}
                className="ml-2 px-2 py-1 bg-blue-500 rounded text-xs"
              >
                재연결
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="background bottom-4 right-4 z-50 w-80">
        <div className="text-sm font-bold mb-2 text-white">실시간 채팅</div>
        <div className="h-32 overflow-y-auto p-2 text-xs space-y-1 bg-bg-primary rounded-sm flex flex-col" ref={msgRef}>
          {messages.map((msg, index) => (
            <div key={index} className="text-white">
              <span className="font-bold">{msg.sender}:</span> {msg.message}
            </div>
          ))}
        </div>
        <input
          type="text"
          placeholder="메시지 입력 후 Enter"
          className="w-full mt-2 px-2 py-1 border border-border-primary rounded text-xs text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              if (input.value.trim()) {
                sendMessage(input.value.trim());
                input.value = '';
              }
            }
          }}
        />
      </div>

      <StatusPanel
        pixelSize={pixelSize}
        mousePixelPos={mousePixelPos}
        pinnedPositionsCount={pinnedPositions.length}
      />
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        isGridActive={isGridActive}
        toggleGrid={toggleGrid}
        isLocalStorageEnabled={isLocalStorageEnabled}
        setIsLocalStorageEnabled={setIsLocalStorageEnabled}
        clearLocalStorageData={clearLocalStorageData}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        favoriteColors={favoriteColors}
        addFavoriteColor={addFavoriteColor}
        removeFavoriteColor={removeFavoriteColor}
        handleFillPixel={handleFillPixel}
        isPickFromCanvas={isPickFromCanvas}
        setIsPickFromCanvas={setIsPickFromCanvas}
      />
      <Canvas
        width={width}
        height={height}
        pixelSize={pixelSize}
        offsetX={offsetX}
        offsetY={offsetY}
        mousePixelPos={mousePixelPos}
        pinnedPositions={pinnedPositions}
        onPinnedPositionsChange={setPinnedPositions}
        pixelData={pixelData}
        onPan={handlePan}
        onZoom={handleZoom}
        onMouseMove={handleMouseMove}
        onPixelClick={handlePixelClick}
        isGridActive={isGridActive}
        isPickFromCanvas={isPickFromCanvas}
        onPickColorAt={handlePickColorAt}
      />
    </div>
  );
};

export default SimpleCanvasPan;