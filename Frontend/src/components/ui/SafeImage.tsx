import React, { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

type LoadState = 'loading' | 'loaded' | 'error';

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
  ...rest
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [state, setState] = useState<LoadState>(src ? 'loading' : 'error');

  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setState(src ? 'loading' : 'error');
  }

  // Cached images can finish loading before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setState(img.naturalWidth > 0 ? 'loaded' : 'error');
    }
  }, [src]);

  if (state === 'error') {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`flex items-center justify-center bg-linear-to-br from-brand-soft via-slate-50 to-white text-brand/25 ${className}`}
      >
        <Gift className="h-1/3 max-h-14 w-1/3 max-w-14" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onLoad={(event) => {
        setState('loaded');
        onLoad?.(event);
      }}
      onError={(event) => {
        setState('error');
        onError?.(event);
      }}
      className={`transition-opacity duration-500 ease-out ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} ${className}`}
      {...rest}
    />
  );
};
