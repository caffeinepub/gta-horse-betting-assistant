import { useEffect, useState } from 'react';

/**
 * Custom hook for smooth number counting animations
 * Animates from old value to new value over specified duration
 */
export function useCountAnimation(targetValue: number, duration: number = 500): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const [prevValue, setPrevValue] = useState(targetValue);

  useEffect(() => {
    if (targetValue === prevValue) return;

    const startValue = displayValue;
    const difference = targetValue - startValue;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const current = startValue + (difference * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        setPrevValue(targetValue);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  return displayValue;
}
