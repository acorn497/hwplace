import React from "react";

type IconToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
  children?: React.ReactNode;
  variant?: "button" | "switch";
};

const IconToggleButton: React.FC<IconToggleButtonProps> = ({ active, onClick, title, className = "", children, variant = "button" }) => {
  if (variant === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={active}
        title={title}
        onClick={onClick}
        className={`relative flex flex-col justify-center h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus:outline-none ${active ? "bg-blue-500 border-blue-500" : "bg-gray-200 border-gray-200"} ${className}`}
      >
        <span
          className={`absolute h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${active ? "translate-x-full" : "left-0"}`}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`bg-white p-3 rounded-sm border mr-2 hover:cursor-pointer transition-colors ${active ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"} ${className}`}
    >
      {children}
    </button>
  );
};

export default IconToggleButton;


