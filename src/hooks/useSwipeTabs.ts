import { useRef, useCallback } from 'react';

interface UseSwipeTabsOptions {
  tabs: string[];
  currentTab: string;
  onTabChange: (tab: string) => void;
  threshold?: number;
}

export function useSwipeTabs({ tabs, currentTab, onTabChange, threshold = 50 }: UseSwipeTabsOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    // Only swipe if horizontal movement dominates
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const idx = tabs.indexOf(currentTab);
    if (dx < 0 && idx < tabs.length - 1) {
      onTabChange(tabs[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      onTabChange(tabs[idx - 1]);
    }
  }, [tabs, currentTab, onTabChange, threshold]);

  return { onTouchStart, onTouchEnd };
}
