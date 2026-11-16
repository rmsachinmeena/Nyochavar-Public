import { useEffect, useState } from 'react';

// Returns a callback ref so observation starts whenever the element mounts, even after a conditional render.
export function useInView<T extends Element>(initialInView = false) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(initialInView);

  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, inView] as const;
}
