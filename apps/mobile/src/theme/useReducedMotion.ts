import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Mirrors OS-level "Reduce Motion" via AccessibilityInfo. Used by ThemeProvider
// to remap motion.duration tokens per docs/02-design-tokens.md §6.3.
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
