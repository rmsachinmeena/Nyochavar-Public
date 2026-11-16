import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Images, Loader2, Trash2 } from 'lucide-react';
import { whatsappService, whatsappPictureSrc } from '../../../../services/whatsappService';
import type { WhatsappPicture } from '../../../../services/whatsappService';
import { Button, Modal, cx } from '../../../components/ui';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface TemplateImagePickerProps {
  /** The picture's Cloudinary link (empty = the message goes out as text only) */
  value?: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  notify: (message: string, tone?: 'success' | 'danger') => void;
  /** The change is being saved */
  busy?: boolean;
}

/** Upload a picture for a WhatsApp template, or pick one that was uploaded before. No links can be pasted. */
export const TemplateImagePicker: React.FC<TemplateImagePickerProps> = ({ value, onChange, notify, busy = false }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pictures, setPictures] = useState<WhatsappPicture[] | null>(null);
  const [loadingPictures, setLoadingPictures] = useState(false);

  useEffect(() => {
    if (!chooserOpen) return;
    setLoadingPictures(true);
    whatsappService
      .listImages()
      .then(setPictures)
      .catch((err: any) => notify(err.message || 'Could not load the uploaded pictures', 'danger'))
      .finally(() => setLoadingPictures(false));
  }, [chooserOpen]);

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type)) {
      notify('Only JPG, PNG or WebP pictures can be used.', 'danger');
      return;
    }
    if (file.size > MAX_BYTES) {
      notify(`This picture is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Please choose one under 5 MB.`, 'danger');
      return;
    }
    setUploading(true);
    try {
      const picture = await whatsappService.uploadImage(file);
      setPictures((prev) => (prev ? [picture, ...prev.filter((item) => item.url !== picture.url)] : prev));
      await onChange(picture.url);
    } catch (err: any) {
      notify(err.message || 'Could not upload the picture', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const working = uploading || busy;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-slate-800">Picture (goes out with this message)</p>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white sm:w-56">
          {value ? (
            <img src={whatsappPictureSrc(value, 600)} alt="Template picture" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center px-3 text-center text-[11px] text-slate-400">No picture: only the text is sent</div>
          )}
          {working && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Best size: 1024×506 or 800×800, under 300 KB. JPG, PNG or WebP, up to 5 MB.
            <br />
            Pictures go out through the WhatsApp bot only (the manual Orders page link cannot carry a picture).
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={working} onClick={() => fileRef.current?.click()} icon={<ImagePlus className="h-3.5 w-3.5" />}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button size="sm" disabled={working} onClick={() => setChooserOpen(true)} icon={<Images className="h-3.5 w-3.5" />}>
              Choose uploaded
            </Button>
            {value && (
              <Button size="sm" disabled={working} onClick={() => void onChange(null)} icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />

      <Modal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Choose an uploaded picture"
        subtitle="Pictures you uploaded for WhatsApp messages"
        size="lg"
      >
        {loadingPictures ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading pictures...</div>
        ) : !pictures || pictures.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No pictures uploaded yet. Use Upload to add one.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {pictures.map((picture) => {
              const selected = picture.url === value;
              return (
                <button
                  key={picture.url}
                  type="button"
                  onClick={() => {
                    setChooserOpen(false);
                    if (!selected) void onChange(picture.url);
                  }}
                  className={cx(
                    'overflow-hidden rounded-lg border bg-white text-left transition hover:border-blue-400',
                    selected ? 'border-blue-600 ring-2 ring-blue-600/30' : 'border-slate-200'
                  )}
                >
                  <img src={whatsappPictureSrc(picture.url, 400)} alt="Uploaded picture" className="aspect-2/1 w-full object-cover" loading="lazy" />
                  <span className="block px-2 py-1 text-[10px] text-slate-500">
                    {picture.width}×{picture.height} · {Math.round(picture.bytes / 1024)} KB
                    {selected && <b className="ml-1 text-blue-600">In use</b>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};

// Example words for the preview
const SAMPLE: Record<string, string> = {
  name: 'Priya',
  order_name: 'Rose Bouquet',
  products: 'Rose Bouquet',
  order_number: 'ORD-1024',
  amount: '₹599',
  delivery_date: 'Tomorrow',
  delivery_time: '10 AM - 1 PM',
  rider_name: 'Rahul',
  rider_phone: '98765 43210',
  brand: 'Nyochavar',
  otp: '482913',
  minutes: '5',
};

/** How the message will look in WhatsApp: the picture on top, the text as its caption. */
export const WhatsappPreview: React.FC<{ image?: string | null; text: string }> = ({ image, text }) => {
  const filled = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => SAMPLE[key] ?? '');
  const parts = filled.split(/\*(.+?)\*/g);

  return (
    <div className="rounded-xl bg-[#e7ded3] p-3">
      <p className="mb-2 text-[11px] font-semibold text-slate-600">Preview (sample words)</p>
      <div className="max-w-sm overflow-hidden rounded-xl rounded-tl-none bg-white shadow-sm">
        {image && <img src={whatsappPictureSrc(image, 600)} alt="" className="block w-full" loading="lazy" />}
        <p className="whitespace-pre-wrap wrap-break-word px-2.5 py-2 text-[13px] leading-snug text-slate-800">
          {parts.map((part, index) => (index % 2 === 1 ? <b key={index}>{part}</b> : <React.Fragment key={index}>{part}</React.Fragment>))}
        </p>
      </div>
    </div>
  );
};
