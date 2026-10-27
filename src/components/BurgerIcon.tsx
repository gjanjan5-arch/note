import React from 'react';

export interface BurgerIconProps {
  isOpen?: boolean;
  className?: string;
  size?: number;
  color?: string;
}

export const BurgerIcon: React.FC<BurgerIconProps> = ({
  isOpen = false,
  className = '',
  size = 20,
  color = 'currentColor',
}) => {
  return (
    <svg
      data-drawer-element="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`overflow-visible select-none pointer-events-none transition-transform duration-350 ease-out ${className}`}
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Top line -> rotates 45deg and translates down */}
      <line
        x1="3"
        y1="6"
        x2="21"
        y2="6"
        className="transition-all duration-350 ease-out"
        style={{
          transformOrigin: '12px 12px',
          transform: isOpen ? 'translateY(6px) rotate(45deg)' : 'translateY(0) rotate(0deg)',
        }}
      />
      {/* Middle line -> fades out smoothly */}
      <line
        x1="3"
        y1="12"
        x2="21"
        y2="12"
        className="transition-all duration-250 ease-out"
        style={{
          opacity: isOpen ? 0 : 1,
          transformOrigin: '12px 12px',
          transform: isOpen ? 'scaleX(0)' : 'scaleX(1)',
        }}
      />
      {/* Bottom line -> rotates -45deg and translates up */}
      <line
        x1="3"
        y1="18"
        x2="21"
        y2="18"
        className="transition-all duration-350 ease-out"
        style={{
          transformOrigin: '12px 12px',
          transform: isOpen ? 'translateY(-6px) rotate(-45deg)' : 'translateY(0) rotate(0deg)',
        }}
      />
    </svg>
  );
};
