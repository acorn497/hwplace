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
        className={`relative flex flex-col justify-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${active ? "bg-blue-500" : "bg-bg-primary"} ${className}`}
      >
        <span
          className={`absolute h-4 w-4 transform rounded-full bg-white shadow transition-all duration-200 ${active ? "left-1/2" : "left-1/20"}`}
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
      className={`bg-bg-primary backdrop-blur-md p-4 rounded-sm border border-border-primary mr-2 hover:cursor-pointer transition-colors ${active ? "border-border-primary-active bg-bg-primary-hover" : "hover:bg-bg-primary-hover"} ${className}`}
    >
      {children}
    </button>
  );
};

export default IconToggleButton;


