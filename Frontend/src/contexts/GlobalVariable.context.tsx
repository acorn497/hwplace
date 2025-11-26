import { createContext, useContext, useState, type PropsWithChildren } from "react";
import type { GlobalVariable} from "./interfaces/GlobalVariable.interface";
import { View } from "./enums/View.enum";

const GlobalVariableContext = createContext<GlobalVariable | undefined>(undefined);

export const GlobalVariableProvider = ({ children }: PropsWithChildren) => {
  const [currentView, setCurrentView] = useState<View>(View.INTRO);

  const value: GlobalVariable = {
    currentView, setCurrentView,
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