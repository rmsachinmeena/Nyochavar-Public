import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { bannerService, ExtendedHeroBanner, PRESET_HERO_BANNERS } from '../../services/bannerService';
import { SafeImage } from '../../components/ui/SafeImage';
import { cloudinaryOptimized } from '../../utils/imageAssets';

// A new banner every 3 seconds; the slide itself takes 2 seconds to glide across
const AUTOPLAY_MS = 3000;
const SLIDE_MS = 2000;
const SWIPE_THRESHOLD_PX = 40;

const activeInOrder = (banners: ExtendedHeroBanner[]) =>
  banners.filter((banner) => banner.is_active).sort((a, b) => a.display_order - b.display_order);

const ARROW =
  'absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur transition hover:bg-white lg:grid lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover/hero:opacity-100';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<ExtendedHeroBanner[]>(() => activeInOrder(PRESET_HERO_BANNERS));
  // Where the strip of slides is. Position `count` is a copy of the first banner placed after the last one, so the last
  // banner glides on to the first in the same direction; the strip then jumps back to position 0 without anyone noticing.
  const [pos, setPos] = useState(0);
  const [snapping, setSnapping] = useState(false);
  // Paused only while a finger is on the banner (hover and focus no longer stop it: on phones a tap left it "hovered" for good)
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    bannerService.getActiveBanners().then((list) => {
      if (active && list.length > 0) {
        setBanners(list);
        setPos(0);
      }
    });
    const unsubscribe = bannerService.subscribeToChanges((updated) => {
      const next = activeInOrder(updated);
      setBanners(next.length > 0 ? next : activeInOrder(PRESET_HERO_BANNERS));
      setPos(0);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const count = banners.length;
  const current = count > 0 ? pos % count : 0;

  // Moves the strip without animation (a moment later the animation is back on)
  const jumpTo = useCallback((target: number, then?: () => void) => {
    setSnapping(true);
    setPos(target);
    window.setTimeout(() => {
      setSnapping(false);
      then?.();
    }, 60);
  }, []);

  const next = useCallback(() => {
    if (count <= 1) return;
    if (pos >= count) {
      jumpTo(0, () => setPos(1));
      return;
    }
    setPos(pos + 1);
  }, [count, pos, jumpTo]);

  const previous = useCallback(() => {
    if (count <= 1) return;
    if (pos === 0) jumpTo(count, () => setPos(count - 1));
    else setPos(Math.min(pos, count) - 1);
  }, [count, pos, jumpTo]);

  const goTo = useCallback((target: number) => setPos(((target % count) + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, next]);

  const openBanner = (banner: ExtendedHeroBanner) => {
    const target = banner.link_url || '/catalog';
    if (target.startsWith('/')) navigate(target);
    else window.location.assign(target);
  };

  if (count === 0) return null;

  // The copy of the first banner at the end of the strip (only needed when there is more than one banner)
  const slides = count > 1 ? [...banners, banners[0]] : banners;

  return (
    <section aria-roledescription="carousel" aria-label="Featured collections" className="relative w-full">
      <div
        className="group/hero relative w-full overflow-hidden bg-slate-950"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
          setPaused(true);
        }}
        onTouchCancel={() => {
          touchStartX.current = null;
          setPaused(false);
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          setPaused(false);
          if (start === null || count <= 1) return;
          const delta = event.changedTouches[0].clientX - start;
          if (Math.abs(delta) > SWIPE_THRESHOLD_PX) {
            if (delta < 0) next();
            else previous();
          }
        }}
      >
        <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden sm:h-[calc(100vh-4rem)]">
          <div
            className={`flex h-full ease-in-out motion-reduce:transition-none ${snapping ? 'transition-none' : 'transition-transform'}`}
            style={{ transform: `translateX(-${pos * 100}%)`, transitionDuration: snapping ? '0ms' : `${SLIDE_MS}ms` }}
            onTransitionEnd={(event) => {
              // On the copy of the first banner: go back to the real first banner, unseen
              if (event.target === event.currentTarget && pos >= count) jumpTo(0);
            }}
          >
            {slides.map((banner, slideIndex) => {
              const isClone = slideIndex >= count;
              const isCurrent = slideIndex === pos || (isClone && pos === count);
              return (
                <div
                  key={isClone ? `${banner.id}-copy` : banner.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${(slideIndex % count) + 1} of ${count}`}
                  aria-hidden={!isCurrent || undefined}
                  className="relative h-full w-full shrink-0"
                >
                  <button
                    type="button"
                    tabIndex={isCurrent ? 0 : -1}
                    onClick={() => openBanner(banner)}
                    aria-label={banner.cta_text ? `${banner.cta_text}: ${banner.title}` : banner.title}
                    className="absolute inset-0 block h-full w-full cursor-pointer"
                  >
                    {/* Phones get the square phone picture (or the PC one when none was uploaded); wider screens get the
                        PC picture. Cloudinary resizes each to the width actually shown, so phones download far less.
                        On phones the whole picture fits the square: a blurred copy of it fills any space around it. */}
                    <span className="relative block h-full w-full">
                      <img
                        src={cloudinaryOptimized(banner.mobile_image_url || banner.image_url, 200)}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl sm:hidden"
                      />
                      <picture className="relative block h-full w-full">
                        <source media="(min-width: 640px)" srcSet={cloudinaryOptimized(banner.image_url, 1600)} />
                        <SafeImage
                          src={cloudinaryOptimized(banner.mobile_image_url || banner.image_url, 900)}
                          alt=""
                          loading={slideIndex === 0 ? 'eager' : 'lazy'}
                          fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                          className="h-full w-full object-contain sm:object-cover sm:object-center"
                        />
                      </picture>
                    </span>
                  </button>

                  {banner.show_overlay && (
                    <>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink/80 via-ink/30 to-transparent sm:bg-linear-to-r sm:from-ink/75 sm:via-ink/35"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-end sm:items-center">
                        <div className="max-w-xl px-5 pb-11 text-white sm:px-12 sm:pb-0 lg:px-16">
                          {banner.badge && (
                            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-md sm:text-[11px]">
                              {banner.badge}
                            </span>
                          )}
                          <h2 className="mt-3 font-serif text-[26px] leading-[1.1] sm:text-4xl lg:text-[3.25rem]">{banner.title}</h2>
                          {banner.subtitle && (
                            <p className="mt-2 line-clamp-2 max-w-md text-xs leading-relaxed text-white/85 sm:mt-3 sm:text-sm lg:text-base">
                              {banner.subtitle}
                            </p>
                          )}
                          <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink sm:mt-7 sm:h-12 sm:px-6">
                            {banner.cta_text || 'Shop now'} <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={previous} aria-label="Previous slide" className={`left-4 sm:left-6 ${ARROW}`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={next} aria-label="Next slide" className={`right-4 sm:right-6 ${ARROW}`}>
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-ink/25 px-1.5 py-1 backdrop-blur-md sm:bottom-5">
              {banners.map((banner, dotIndex) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => goTo(dotIndex)}
                  aria-label={`Go to slide ${dotIndex + 1}`}
                  aria-current={dotIndex === current}
                  className="grid h-5 place-items-center px-1"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      dotIndex === current ? 'w-6 bg-white' : 'w-1.5 bg-white/60'
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
