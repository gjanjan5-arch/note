import React from 'react';

export const AnimatePresence: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const createMotionComponent = (tag: string) => {
  return React.forwardRef((
    {
      initial,
      animate,
      exit,
      transition,
      variants,
      whileHover,
      whileTap,
      whileFocus,
      whileDrag,
      layout,
      layoutId,
      ...props
    }: any,
    ref: any
  ) => {
    return React.createElement(tag, { ref, ...props });
  });
};

export const motion = new Proxy({} as any, {
  get(target, prop: string) {
    if (!target[prop]) {
      target[prop] = createMotionComponent(prop);
    }
    return target[prop];
  },
});
