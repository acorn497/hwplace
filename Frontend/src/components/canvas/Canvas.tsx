import { Toolbar } from "../toolbar/Toolbar"
import { PixelField } from "./PixelField"

export const Canvas = () => {
  return (
    <>
      <div className="absolute">
      <PixelField />
      </div>
      <Toolbar />
    </>
  )
}