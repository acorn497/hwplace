import { useGlobalVariable } from "../../contexts/GlobalVariable.context"
import { Panel } from "../toolbar/Panel"
import { Toolbar } from "../toolbar/Toolbar"
import { PixelField } from "./PixelField"

const POSITION_CLASSES = {
  'top-left': 'translate-x-0 translate-y-0',
  'top-right': 'translate-x-[calc(100vw-100%-3rem)] translate-y-0',
  'bottom-left': 'translate-x-0 translate-y-[calc(100vh-100%-3rem)]',
  'bottom-right': 'translate-x-[calc(100vw-100%-3rem)] translate-y-[calc(100vh-100%-3rem)]',
  'bottom-center': 'translate-x-[calc(50vw-50%)] translate-y-[calc(100vh-100%-8.5rem)]',
} as const;

export const Canvas = () => {
  const { panelPosition } = useGlobalVariable();
  const positionClass = POSITION_CLASSES[panelPosition] || POSITION_CLASSES['bottom-center'];

  return (
    <>
      <PixelField />
      <div className={`fixed left-6 top-6 ${positionClass} transition-all duration-300 ease-in-out`}>
        <Panel />
      </div>
      <Toolbar />
    </>
  )
}