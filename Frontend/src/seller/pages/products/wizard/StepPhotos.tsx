import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Loader2, RotateCw, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { cloudinaryOptimized } from '../../../../utils/imageAssets';
import { sellerApi } from '../../../services/sellerApi';
import { compressImage } from '../../../utils/compressImage';
import { PHOTO_LIMITS, type DraftErrors } from './productFormState';

interface StepPhotosProps {
  images: string[];
  errors: DraftErrors;
  /** Replaces the whole list (used for delete, reorder and cover) */
  onChange: (images: string[]) => void;
  /** Adds one finished upload at the end of the list */
  onAdd: (url: string) => void;
  /** Tells the page whether pictures are still uploading, so it can hold the Continue button */
  onBusyChange: (busy: boolean) => void;
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
 * Step 2: product pictures. The seller picks (or drops) several pictures; each is shrunk on the phone / computer,
 * uploaded on its own with its own progress, and then joins the list. The first picture is the cover shown in the store.
 */
export const StepPhotos: React.FC<StepPhotosProps> = ({ images, errors, onChange, onAdd, onBusyChange }) => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<string[]>([]);

  const used = images.length + pending.length;
  const room = PHOTO_LIMITS.max - used;

  useEffect(() => {
    onBusyChange(pending.some((item) => item.status === 'uploading'));
  }, [pending, onBusyChange]);

  // Free the temporary previews when the step is left
  useEffect(
    () => () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      onBusyChange(false);
    },
    [onBusyChange]
  );

  const upload = useCallback(
    async (item: Pending) => {
      setPending((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry)));
      try {
        const small = await compressImage(item.file);
        const url = await sellerApi.uploadPicture(small);
        onAdd(url);
        setPending((previous) => previous.filter((entry) => entry.id !== item.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The picture could not be uploaded.';
        setPending((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, status: 'error', error: message } : entry)));
      }
    },
    [onAdd]
  );

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;

    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) problems.push(`${file.name}: only JPG, PNG or WebP pictures are accepted`);
      else if (file.size > MAX_PICK_BYTES) problems.push(`${file.name}: the picture is too large (${PHOTO_LIMITS.maxPickMb} MB at most)`);
      else accepted.push(file);
    }
    if (accepted.length > room) {
      problems.push(`You can have ${PHOTO_LIMITS.max} pictures in all, so only ${Math.max(room, 0)} more could be added`);
    }
    setNotice(problems.length > 0 ? problems.join('. ') + '.' : null);

    const items: Pending[] = accepted.slice(0, Math.max(room, 0)).map((file) => {
      const preview = URL.createObjectURL(file);
      previewsRef.current.push(preview);
      return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview, status: 'uploading' as const };
    });
    if (items.length === 0) return;

    setPending((previous) => [...previous, ...items]);
    // Three at a time: quick, without choking a phone's connection
    void (async () => {
      const queue = [...items];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) await upload(next);
      };
      await Promise.all([worker(), worker(), worker()]);
    })();
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const makeCover = (index: number) => {
    const next = [...images];
    const [chosen] = next.splice(index, 1);
    onChange([chosen, ...next]);
  };

  const remove = (index: number) => onChange(images.filter((_, i) => i !== index));

  const dismissPending = (id: string) => setPending((previous) => previous.filter((entry) => entry.id !== id));

  const canAddMore = room > 0;

  return (
    <div className="space-y-5">
      {/* Where to drop or pick pictures */}
      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs font-bold text-slate-800">
            Product pictures<span className="ml-0.5 text-rose-500">*</span>
          </p>
          <span className="text-[11px] font-medium text-slate-400">
            {images.length}/{PHOTO_LIMITS.max} added
          </span>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (canAddMore) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (canAddMore) addFiles(event.dataTransfer.files);
          }}
          className={`mt-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
            dragging ? 'border-brand bg-brand-soft' : errors.images ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60'
          } ${canAddMore ? '' : 'opacity-60'}`}
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow-sm">
            <UploadCloud className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-ink">{canAddMore ? 'Drag your pictures here' : 'You have added the most pictures allowed'}</p>
          <p className="mt-0.5 text-xs text-slate-500">JPG, PNG or WebP. Up to {PHOTO_LIMITS.max} pictures.</p>
          <input
            ref={inputRef}
            id="wz-images"
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={!canAddMore}
            onClick={() => inputRef.current?.click()}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" /> Choose pictures
          </button>
        </div>

        {errors.images && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errors.images}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {notice}
          </p>
        )}
      </div>

      {/* The pictures */}
      {used > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((url, index) => (
            <li key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={cloudinaryOptimized(url, 400)} alt={`Product picture ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  <Star className="h-3 w-3 fill-current" /> Cover
                </span>
              )}
              <button
                type="button"
                aria-label={`Delete picture ${index + 1}`}
                onClick={() => remove(index)}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-slate-900/70 text-white transition hover:bg-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-slate-950/75 to-transparent p-1.5 pt-6">
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Move earlier"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-white/90 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-white/90 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="cursor-pointer rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-800 transition hover:bg-white"
                  >
                    Make cover
                  </button>
                )}
              </div>
            </li>
          ))}

          {pending.map((item) => (
            <li key={item.id} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={item.preview} alt="" className={`h-full w-full object-cover ${item.status === 'uploading' ? 'opacity-50' : 'opacity-30'}`} />
              {item.status === 'uploading' ? (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Uploading
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                  <p className="line-clamp-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold leading-snug text-rose-600 shadow">{item.error}</p>
                  <button
                    type="button"
                    onClick={() => void upload(item)}
                    className="flex cursor-pointer items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-white shadow transition hover:bg-brand-dark"
                  >
                    <RotateCw className="h-3 w-3" /> Try again
                  </button>
                  <button
                    type="button"
                    aria-label="Remove this picture"
                    onClick={() => dismissPending(item.id)}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-slate-900/70 text-white transition hover:bg-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Quality nudge and tips */}
      {images.length > 0 && images.length < PHOTO_LIMITS.recommended && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          Products with {PHOTO_LIMITS.recommended} or more pictures sell better. Add a close-up and a picture of the box if you can.
        </p>
      )}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-xs font-bold text-slate-800">Tips for pictures buyers love</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
          <li>• The first picture is the cover shown in the store. Make it clear and bright.</li>
          <li>• Use daylight and a plain background. Square pictures look best.</li>
          <li>• Show the whole gift, a close-up, and what is inside the box.</li>
          <li>• Only upload pictures you took yourself or have the right to use.</li>
        </ul>
      </div>
    </div>
  );
};
