import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, RotateCw, Star, X } from 'lucide-react';
import { cloudinaryOptimized } from '../../../../utils/imageAssets';
import { sellerApi } from '../../../services/sellerApi';
import { compressImage } from '../../../utils/compressImage';
import { PHOTO_LIMITS, VARIANT_LIMITS } from './productFormState';

interface VariantPhotosProps {
  /** The option this belongs to (used to tell the page which option a finished upload is for) */
  variantId: string;
  images: string[];
  /** The product pictures from step 2, offered as a quick pick */
  productImages: string[];
  onChange: (images: string[]) => void;
  onAdd: (variantId: string, url: string) => void;
  onBusyChange: (variantId: string, busy: boolean) => void;
}

interface Pending {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'error';
  error?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PICK_BYTES = PHOTO_LIMITS.maxPickMb * 1024 * 1024;

/**
 * The pictures of one option (for example the 500 g size). The seller uploads them here, or picks from the product's
 * own pictures. When this option is chosen in the store, buyers see these pictures instead of the product's.
 */
export const VariantPhotos: React.FC<VariantPhotosProps> = ({ variantId, images, productImages, onChange, onAdd, onBusyChange }) => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<string[]>([]);

  const room = VARIANT_LIMITS.photos - images.length - pending.length;

  useEffect(() => {
    onBusyChange(variantId, pending.some((item) => item.status === 'uploading'));
  }, [pending, variantId, onBusyChange]);

  useEffect(
    () => () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      onBusyChange(variantId, false);
    },
    [variantId, onBusyChange]
  );

  const upload = useCallback(
    async (item: Pending) => {
      setPending((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry)));
      try {
        const url = await sellerApi.uploadPicture(await compressImage(item.file));
        onAdd(variantId, url);
        setPending((previous) => previous.filter((entry) => entry.id !== item.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The picture could not be uploaded.';
        setPending((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'error', error: message } : entry)));
      }
    },
    [onAdd, variantId]
  );

  const addFiles = (list: FileList) => {
    const files = Array.from(list);
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) problems.push(`${file.name}: only JPG, PNG or WebP`);
      else if (file.size > MAX_PICK_BYTES) problems.push(`${file.name}: too large (${PHOTO_LIMITS.maxPickMb} MB at most)`);
      else accepted.push(file);
    }
    if (accepted.length > room) problems.push(`An option can have ${VARIANT_LIMITS.photos} pictures, so only ${Math.max(room, 0)} more could be added`);
    setNotice(problems.length > 0 ? problems.join('. ') + '.' : null);

    const items: Pending[] = accepted.slice(0, Math.max(room, 0)).map((file) => {
      const preview = URL.createObjectURL(file);
      previewsRef.current.push(preview);
      return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview, status: 'uploading' as const };
    });
    if (items.length === 0) return;
    setPending((previous) => [...previous, ...items]);
    items.forEach((item) => void upload(item));
  };

  const makeCover = (index: number) => {
    const next = [...images];
    const [chosen] = next.splice(index, 1);
    onChange([chosen, ...next]);
  };

  const togglePick = (url: string) => {
    if (images.includes(url)) onChange(images.filter((existing) => existing !== url));
    else if (room > 0) onChange([...images, url]);
  };

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-slate-700">Pictures of this option (optional)</p>
        <span className="text-[11px] text-slate-400">
          {images.length}/{VARIANT_LIMITS.photos}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {images.map((url, index) => (
          <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <img src={cloudinaryOptimized(url, 150)} alt={`Option picture ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 && (
              <span className="absolute left-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-brand text-white" title="Cover of this option">
                <Star className="h-2.5 w-2.5 fill-current" />
              </span>
            )}
            {index > 0 && (
              <button
                type="button"
                onClick={() => makeCover(index)}
                className="absolute inset-x-0 bottom-0 cursor-pointer bg-slate-900/70 py-0.5 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                Make cover
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove picture ${index + 1} of this option`}
              onClick={() => onChange(images.filter((existing) => existing !== url))}
              className="absolute right-0.5 top-0.5 grid h-5 w-5 cursor-pointer place-items-center rounded bg-slate-900/70 text-white transition hover:bg-rose-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {pending.map((item) => (
          <div key={item.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <img src={item.preview} alt="" className="h-full w-full object-cover opacity-40" />
            {item.status === 'uploading' ? (
              <span className="absolute inset-0 grid place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </span>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Try this picture again"
                  title={item.error}
                  onClick={() => void upload(item)}
                  className="absolute inset-0 grid cursor-pointer place-items-center bg-white/70 text-rose-600"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove this picture"
                  onClick={() => setPending((previous) => previous.filter((entry) => entry.id !== item.id))}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 cursor-pointer place-items-center rounded bg-slate-900/70 text-white transition hover:bg-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {room > 0 && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              className="sr-only"
              aria-label="Upload pictures for this option"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-16 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand/40 bg-brand-soft/30 text-[10px] font-bold text-brand transition hover:border-brand hover:bg-brand-soft/60"
            >
              <ImagePlus className="h-4 w-4" /> Upload
            </button>
          </>
        )}
      </div>

      {pending.some((item) => item.status === 'error') && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {pending.find((item) => item.status === 'error')?.error} Tap the picture to try again.
        </p>
      )}
      {notice && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{notice}</p>}

      {productImages.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setPicking((open) => !open)} className="cursor-pointer text-[11px] font-bold text-brand hover:underline">
            {picking ? 'Hide product pictures' : 'Or use one of the product pictures'}
          </button>
          {picking && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {productImages.map((url, index) => {
                const chosen = images.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    aria-label={`${chosen ? 'Remove' : 'Use'} product picture ${index + 1}`}
                    aria-pressed={chosen}
                    disabled={!chosen && room <= 0}
                    onClick={() => togglePick(url)}
                    className={`h-11 w-11 cursor-pointer overflow-hidden rounded-lg border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      chosen ? 'border-brand ring-2 ring-brand/25' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={cloudinaryOptimized(url, 100)} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
