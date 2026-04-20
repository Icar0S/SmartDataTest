export const fadeIn = {
  initial: {
    opacity: 0,
    y: 20
  },
  animate: {
    opacity: 1,
    y: 0
  },
  transition: {
    duration: 0.5
  }
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const slideIn = {
  initial: {
    x: -60,
    opacity: 0
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

export const scaleIn = {
  initial: {
    scale: 0.8,
    opacity: 0
  },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.4
    }
  }
};

export const slideInFromLeft = {
  initial: { x: -80, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.7, ease: 'easeOut' } },
  exit: { x: -80, opacity: 0, transition: { duration: 0.3 } },
};

export const slideInFromRight = {
  initial: { x: 80, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.7, ease: 'easeOut', delay: 0.1 } },
  exit: { x: 80, opacity: 0, transition: { duration: 0.3 } },
};

export const slideDown = {
  initial: { opacity: 0, y: -16, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
};

export const popIn = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 15 } },
};

export const profileCardIn = {
  initial: { scale: 0.95, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 150, damping: 20, delay: 0.1 } },
};

export const floatingNode = (duration = 15, delay = 0) => ({
  animate: {
    y: [0, -25, 10, -15, 0],
    x: [0, 12, -8, 18, 0],
    transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' },
  },
});
