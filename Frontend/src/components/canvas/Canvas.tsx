import { Toolbar } from "../toolbar/Toolbar"
import { PixelField } from "./PixelField"

export const Canvas = () => {
  return (
    <>
      <div className="w-screen h-screen absolute">
      <PixelField />
      </div>
      <Toolbar />
    </>
  )
}