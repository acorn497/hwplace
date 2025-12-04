import { ReactNode } from "react"

export const Titlebox = ({title, className, children}: {title: string, className?: string, children?: ReactNode}) => {
  return (
    <div className={`${className} relative bg-gray-100 rounded-md py-1 px-3`}>
      <h4 className="text-xs aritta-font leading-4">{title}</h4>
      <div className="flex flex-1">
        {children}
      </div>
    </div>
  )
}