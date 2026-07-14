import type { ReactNode } from "react";

interface PlayerBtnProps {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  isDark: boolean;
}

export function PlayerBtn({ children, onClick, title, isDark }: PlayerBtnProps) {
  const border = isDark ? "#1E2D40" : "#D1D9E0";
  const color = isDark ? "#6B7A8D" : "#5A6A7A";
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded transition-colors"
      style={{ border: `1px solid ${border}`, color, backgroundColor: "transparent" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = isDark ? "#E8EDF2" : "#0F1923";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = color;
      }}
    >
      {children}
    </button>
  );
}
