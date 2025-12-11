import { PanelPosition } from "../../../contexts/enums/PanelPosition.enum";
import { useGlobalVariable } from "../../../contexts/GlobalVariable.context"

export const Setting = () => {
  const { panelPosition, setPanelPosition } = useGlobalVariable();
  const sharedClasses = `border w-12 h-8 rounded-sm absolute `;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
        <h2 className="text-base font-semibold text-slate-800">설정</h2>
      </div>
      <div className="w-48 h-28 border border-primary-border rounded-md p-2 relative">
        <button className={`${sharedClasses} top-2 left-2 ${panelPosition === 'top-left' ? 'bg-primary-button border-slate-400' : 'border-primary-border hover:cursor-pointer'}`} onClick={() => setPanelPosition(PanelPosition.TL)} />
        <button className={`${sharedClasses} top-2 right-2 ${panelPosition === 'top-right' ? 'bg-primary-button border-slate-400' : 'border-primary-border hover:cursor-pointer'}`} onClick={() => setPanelPosition(PanelPosition.TR)} />
        <button className={`${sharedClasses} bottom-2 left-2 ${panelPosition === 'bottom-left' ? 'bg-primary-button border-slate-400' : 'border-primary-border hover:cursor-pointer'}`} onClick={() => setPanelPosition(PanelPosition.BL)} />
        <button className={`${sharedClasses} bottom-2 right-2 ${panelPosition === 'bottom-right' ? 'bg-primary-button border-slate-400' : 'border-primary-border hover:cursor-pointer'}`} onClick={() => setPanelPosition(PanelPosition.BR)} />
        <button className={`${sharedClasses} bottom-3 left-1/2 -translate-x-1/2 ${panelPosition === 'bottom-center' ? 'bg-primary-button border-slate-400' : 'border-primary-border hover:cursor-pointer'}`} onClick={() => setPanelPosition(PanelPosition.BC)} />
      </div>
    </div>
  )
}