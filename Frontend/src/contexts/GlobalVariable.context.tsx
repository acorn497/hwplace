import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { GlobalVariable } from "./interfaces/GlobalVariable.interface";
import { Tool } from "./enums/Tool.enum";
import { View } from "./enums/View.enum";
import { FetchMethod, useFetch } from "../hooks/useFetch";

const GlobalVariableContext = createContext<GlobalVariable | undefined>(undefined);

export const GlobalVariableProvider = ({ children }: PropsWithChildren) => {
  const [currentView, setCurrentView] = useState<View>(View.INTRO);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.NONE);
  const [zoom, setZoom] = useState(1);

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");

  const [ping, setPing] = useState(0);
  const [totalBatchedPixelCount, setTotalBatchedPixelCount] = useState(0);
  const [version, setVersion] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      (async () => {
        useFetch(FetchMethod.GET, '/ping').then(response => {
          setPing(Date.now() - response.data.timestamp);
          setTotalBatchedPixelCount(response.data.totalBatchedPixelCount);
        });
      })();
    }, 1000);

    return () => {
      clearInterval(interval);
    }
  }, [])

  const value: GlobalVariable = {
    currentView, setCurrentView,
    activeTool, setActiveTool,
    zoom, setZoom,

    username, setUsername,
    email, setEmail,
    accessToken, setAccessToken,

    ping, setPing,
    totalBatchedPixelCount, setTotalBatchedPixelCount,
    version, setVersion,
  };

  return (
    <GlobalVariableContext.Provider value={value} >
      {children}
    </GlobalVariableContext.Provider>
  );
};

export const useGlobalVariable = () => {
  const context = useContext(GlobalVariableContext);
  if (context === undefined) {
    throw new Error('useGlobalVariable이 GlobalVariableProvider 외부에서 호출되었습니다.');
  }
  return context;
};