import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({ isOpen, onClose, children }) => {
  const originalOverflow = React.useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (originalOverflow.current === null) {
        originalOverflow.current = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (originalOverflow.current !== null) {
        document.body.style.overflow = originalOverflow.current;
        originalOverflow.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="theme-card max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border theme-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
