import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageTransition handles smooth route entrance animations and scroll preservation.
 * Includes subtle slide and fade animation, respecting prefers-reduced-motion.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const transitionRef = useRef(null);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    // Only scroll to top if pathname actually changed (not query/hash changes)
    if (prevPathRef.current !== location.pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      prevPathRef.current = location.pathname;

      if (transitionRef.current) {
        // Trigger smooth entrance animation
        transitionRef.current.classList.remove('page-transition-enter');
        // Force reflow
        void transitionRef.current.offsetWidth;
        transitionRef.current.classList.add('page-transition-enter');
      }
    }
  }, [location.pathname]);

  return (
    <div
      ref={transitionRef}
      key={location.pathname}
      className="page-transition-container page-transition-enter"
    >
      {children}
    </div>
  );
}
