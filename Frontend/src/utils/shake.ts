/** Shakes the elements with these ids once (the "you missed this" cue). Skipped by CSS for people who prefer reduced motion. */
export const shakeElements = (ids: string[]) => {
  requestAnimationFrame(() => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('field-shake');
      void el.offsetWidth; // restart the animation when it is shaken again
      el.classList.add('field-shake');
      el.addEventListener('animationend', () => el.classList.remove('field-shake'), { once: true });
    });
  });
};
