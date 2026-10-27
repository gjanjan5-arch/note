import React from 'react';
import ReactDOM from 'react-dom';
import { useBodyScrollLock } from '../utils/scrollLock';

interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({ isOpen, onClose, children }) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="theme-card max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border theme-border shadow-2xl my-auto"
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
