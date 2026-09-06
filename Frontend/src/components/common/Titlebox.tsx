import { ReactNode } from "react"

export const Titlebox = ({title, className, children}: {title: string, className?: string, children?: ReactNode}) => {
  return (
    <div className={`${className ?? ''} relative min-w-0 bg-surface-solid border border-border rounded-md py-1.5 px-3`}>
      <h4 className="text-[11px] font-medium tracking-wide text-content-muted aritta-font leading-4 truncate">{title}</h4>
      <div className="flex flex-1 min-w-0 items-center mt-0.5 text-content">
        {children}
      </div>
    </div>
  )
}