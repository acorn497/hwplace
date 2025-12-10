import { ReactNode, useEffect, useState } from "react";

interface ButtonProps {
  display?: string | number,
  hint?: string,
  className?: string,
  callback?: Function,
  keybind?: string,
  children?: ReactNode
}

// ms
const TRIGGER_TTL = 500

export const Button = ({ display, hint, className, callback, keybind, children }: ButtonProps) => {
  const [showHint, setShowHint] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [_timeout, _setTimeout] = useState<number | null>(null);

  const handleOnClick = () => {
    if (callback) callback();
  }

  useEffect(() => {
    if (!hovering && !showHint && _timeout) {
      clearTimeout(_timeout);
      _setTimeout(null);
      return;
    }

    if (!hovering && _timeout) {
      setShowHint(false);
      clearTimeout(_timeout);
      _setTimeout(null);
      return;
    }

    _setTimeout(setTimeout(() => {
      if (hovering) setShowHint(true);
    }, TRIGGER_TTL))

    return () => {
      if (_timeout) {
        clearTimeout(_timeout);
        _setTimeout(null);
      }
    }
  }, [hovering])

  return (
    <div className="relative w-fit p-1" onMouseLeave={() => setHovering(false)}>
      {hint ?
        <div className={`${showHint ? "opacity-100" : "opacity-0 select-none pointer-events-none"} absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-fit overflow-hidden transition-normal duration-200 bg-black/40 backdrop-blur-md py-1 px-2 text-sm rounded-md text-white font-medium whitespace-nowrap`}>
          <span>{hint}</span>
          {keybind ?
            <><br /><span className="text-xs font-light">Key </span><span className="text-xs italic">{keybind}</span></>
            : null}
        </div>
        : null}
      <button className={`py-2 px-2.5 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md hover:cursor-pointer ${className}`} onClick={handleOnClick ?? null} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(showHint ? true : false)}>
        {display}
        {children}
      </button>
    </div >
  )
}