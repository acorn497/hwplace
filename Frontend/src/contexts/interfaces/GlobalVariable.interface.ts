import type { View } from "../enums/View.enum";

export interface GlobalVariable {
  currentView: View;
  setCurrentView: (view: View) => void;
}