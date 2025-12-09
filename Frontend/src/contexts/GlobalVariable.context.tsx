import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { GlobalVariableContextType } from "./interfaces/GlobalVariable.interface";
import { Tool } from "./enums/Tool.enum";
import { View } from "./enums/View.enum";
import { FetchMethod, useFetch } from "../hooks/useFetch";

const GlobalVariableContext = createContext<GlobalVariableContextType | undefined>(undefined);

export const GlobalVariableProvider = ({ children }: PropsWithChildren) => {
  const [currentView, setCurrentView] = useState<View>(View.INTRO);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.NONE);

  const [ping, setPing] = useState(0);
  const [totalBatchedPixelCount, setTotalBatchedPixelCount] = useState(0);
  const [version, setVersion] = useState('');

  useEffect(() => {
    const startTime = Date.now();

    useFetch(FetchMethod.GET, '/ping').then(response => {
      if (!response) return;
      const endTime = Date.now();
      setPing(endTime - startTime);
      setTotalBatchedPixelCount(response.data.totalBatchedPixelCount);
    });
    const interval = setInterval(() => {
      const startTime = Date.now();

      useFetch(FetchMethod.GET, '/ping').then(response => {
        if (!response) return;
        const endTime = Date.now();
        setPing(endTime - startTime);
        setTotalBatchedPixelCount(response.data.totalBatchedPixelCount);
      });
    }, 30000);

    return () => {
      clearInterval(interval);
    }
  }, [])

  const value: GlobalVariableContextType = {
    currentView, setCurrentView,
    activeTool, setActiveTool,

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