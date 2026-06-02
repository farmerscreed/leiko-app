import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Mirrors OS-level "Reduce Motion" via AccessibilityInfo. Used by ThemeProvider
// to remap motion.duration tokens per docs/02-design-tokens.md §6.3.
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Sprint 16.5i — guard with catch. Some Android devices reject this
    // call (unhandled rejection would otherwise crash on cold start at
    // theme init time).
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduce(value);
      })
      .catch(() => {
        // Default to "motion enabled" on read failure — safer than
        // accidentally locking everyone into reduce-motion.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
