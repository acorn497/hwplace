import { createContext, useContext, useState, type PropsWithChildren } from "react";

enum ViewEnum {
  INTRO = "INTRO",
  CANVAS = "CANVAS",
  FATAL = "FATAL",
}

interface GlobalVariableInterface {
  currentView: ViewEnum;
  setCurrentView: (view: ViewEnum) => void;
}

const GlobalVariableContext = createContext<GlobalVariableInterface | undefined>(undefined);

export const GlobalVariableProvider = ({ children }: PropsWithChildren) => {
  const [currentView, setCurrentView] = useState<ViewEnum>(ViewEnum.INTRO);

  const value: GlobalVariableInterface = {
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