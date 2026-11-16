import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, ShoppingBag, X } from 'lucide-react';
import type { Occasion, PaletteOption } from '../../types';
// COMMENTED: Static palette options removed. Should fetch from API instead.
const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: 'default',
    name: 'Default Palette',
    tagline: 'Curated gift experiences',
    colorSwatches: ['#3B82F6', '#1F2937'],
    previewImage: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=1200'
  }
];
import { useCart, useUI } from '../../context';
import { useInView } from '../../hooks/useInView';
import { formatPrice } from '../../utils/format';
import { SafeImage } from '../../components/ui/SafeImage';

const BASE_HAMPER_PRICE = 185;
const LETTER_LIMIT = 200;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const NOTE_LINES = 'repeating-linear-gradient(transparent, transparent 31px, rgba(30, 64, 175, 0.08) 32px)';
const STEPS = ['Recipient & theme', 'Photo & letter', 'Review'];
const OCCASIONS: Occasion[] = ['Anniversary', 'Birthday', "Valentine's", 'Congratulations', 'Thank You', 'Just Because'];

const QUICK_SENTIMENTS = [
  { label: 'Endless love', text: 'Here’s to another year of shared laughter, growth and endless love.' },
  { label: 'Joy & radiance', text: 'Wishing you all the joy and radiant blossoms on your special day!' },
];

const BOX_FINISHES = [
  { id: 'luxe-black', name: 'Obsidian Noir', swatch: '#111827' },
  { id: 'ivory-linen', name: 'Ivory Linen', swatch: '#f3ede2' },
  { id: 'sapphire-velvet', name: 'Royal Blue Velvet', swatch: '#1e3a8a' },
];

const INPUT =
  'block w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-ink transition placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-[15px]';
const LABEL = 'text-[13px] font-medium text-slate-700';
const CHOICE_ACTIVE = 'border-brand bg-brand-soft/50 ring-1 ring-brand';
const CHOICE_IDLE = 'border-slate-200 bg-white hover:border-slate-300';
const PILL_ACTIVE = 'border-ink bg-ink text-white';
const PILL_IDLE = 'border-slate-200 text-slate-700 hover:border-slate-300';

interface HamperPreviewProps {
  palette: PaletteOption;
  recipient: string;
  occasion: string;
  photo: string | null;
  letter: string;
  boxName: string;
}

const HamperPreview: React.FC<HamperPreviewProps> = ({ palette, recipient, occasion, photo, letter, boxName }) => (
  <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
    <div className="relative aspect-[4/3] bg-slate-100">
      <SafeImage src={palette.previewImage} alt={palette.name} className="h-full w-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink/35 via-transparent to-transparent" />
      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">
        {palette.name}
      </span>
      {photo && (
        <div className="absolute bottom-4 left-4 w-24 -rotate-6 rounded-md bg-white p-1.5 pb-3 shadow-float sm:w-28">
          <img src={photo} alt="" className="aspect-square w-full rounded-sm object-cover" />
          <p className="mt-1 truncate text-center font-script text-sm leading-none text-ink">{recipient || 'For you'}</p>
        </div>
      )}
    </div>
    <div className="overflow-hidden px-5 pb-5 pt-5" style={{ backgroundImage: NOTE_LINES }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Wax-sealed letter</p>
        <p className="truncate text-[11px] text-slate-400">
          {occasion} · {boxName}
        </p>
      </div>
      <p
        className={`mt-2 min-h-[5.25rem] break-words break-all [overflow-wrap:anywhere] [word-break:break-word] font-script text-2xl sm:text-[26px] font-semibold leading-[32px] tracking-wide ${
          letter ? 'text-[#1E40AF]' : 'text-slate-300 italic'
        }`}
      >
        {letter || 'Your letter will appear here, written by hand…'}
      </p>
      <p className="mt-1 text-right font-script text-xl text-ink">— for {recipient || 'someone special'}</p>
    </div>
  </div>
);

const Stepper: React.FC<{ current: number; onSelect: (index: number) => void }> = ({ current, onSelect }) => (
  <div className="mt-8">
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const isLast = index === STEPS.length - 1;
        return (
          <li key={label} className={`flex min-w-0 items-center gap-2 sm:gap-3 ${isLast ? '' : 'flex-1'}`}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={!done}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 items-center gap-2 disabled:cursor-default"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition ${
                  active ? 'bg-brand text-white' : done ? 'bg-ink text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={`hidden truncate text-sm sm:block ${active ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-slate-400'}`}
              >
                {label}
              </span>
            </button>
            {!isLast && <span className={`h-px min-w-4 flex-1 ${done ? 'bg-ink' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
    <p className="mt-3 text-sm text-slate-500 sm:hidden">
      Step {current + 1} of {STEPS.length} · <span className="font-medium text-ink">{STEPS[current]}</span>
    </p>
  </div>
);

export const HamperBuilderPage: React.FC = () => {
  const { handleAddToCart } = useCart();
  const { showToast, setIsCartDrawerOpen } = useUI();
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionsRef, actionsInView] = useInView<HTMLDivElement>(true);
  const [endRef, endInView] = useInView<HTMLDivElement>(false);

  const [step, setStep] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('Anniversary');
  const [palette, setPalette] = useState<PaletteOption>(PALETTE_OPTIONS[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [letter, setLetter] = useState('');
  const [boxId, setBoxId] = useState(BOX_FINISHES[0].id);

  const box = BOX_FINISHES.find((finish) => finish.id === boxId) ?? BOX_FINISHES[0];
  const recipientName = recipient.trim();
  const isReviewStep = step === STEPS.length - 1;
  const canContinue = step !== 0 || recipientName.length > 0;
  const showStickyBar = !actionsInView && !endInView;

  const goToStep = (next: number) => {
    setStep(next);
    const card = cardRef.current;
    if (card && card.getBoundingClientRect().top < 96) {
      window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' });
    }
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Please choose a photo under 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
      setPhotoError('');
    };
    reader.readAsDataURL(file);
  };

  const addToCart = () => {
    handleAddToCart({
      productId: 'bespoke-hamper',
      name: `Bespoke hamper for ${recipientName}`,
      price: BASE_HAMPER_PRICE,
      image: palette.previewImage,
      quantity: 1,
      palette: `${palette.name} · ${box.name}`,
      customPhoto: photo ?? undefined,
      message: letter.trim() || undefined,
    });
    showToast({
      title: 'Hamper added to cart',
      description: `For ${recipientName}`,
      image: palette.previewImage,
      action: { label: 'View cart', onClick: () => setIsCartDrawerOpen(true) },
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    if (isReviewStep) addToCart();
    else goToStep(step + 1);
  };

  const primaryLabel = isReviewStep ? `Add to cart · ${formatPrice(BASE_HAMPER_PRICE)}` : 'Continue';
  const PrimaryIcon = isReviewStep ? ShoppingBag : ArrowRight;

  return (
    <div className="pb-28 lg:pb-24">
      <div className="mx-auto max-w-7xl px-5 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Hamper Studio</p>
          <h1 className="mt-2 font-serif text-[32px] leading-[1.1] tracking-[-0.01em] text-ink sm:text-4xl lg:text-5xl">
            Build a bespoke hamper
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
            Choose a theme, add a keepsake photo and a handwritten letter — we’ll hand-assemble it in our atelier.
          </p>
        </div>

        <Stepper current={step} onSelect={goToStep} />

        <div className="mt-6 grid items-start gap-8 lg:mt-8 lg:grid-cols-12 lg:gap-12">
          <div ref={cardRef} className="lg:col-span-7">
            <form id="builder-form" onSubmit={handleSubmit} className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === 0 && (
                    <div>
                      <h2 className="font-serif text-2xl text-ink">Who’s it for?</h2>
                      <p className="mt-1 text-sm text-slate-500">We’ll add their name to the keepsake tag and letter.</p>

                      <div className="mt-6">
                        <label htmlFor="recipient" className={`mb-1.5 block ${LABEL}`}>
                          Recipient’s name
                        </label>
                        <input
                          id="recipient"
                          value={recipient}
                          onChange={(event) => setRecipient(event.target.value)}
                          maxLength={40}
                          autoComplete="off"
                          placeholder="e.g. Meera"
                          className={`${INPUT} h-12`}
                        />
                      </div>

                      <div className="mt-6">
                        <p className={LABEL}>Occasion</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {OCCASIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              aria-pressed={occasion === item}
                              onClick={() => setOccasion(item)}
                              className={`rounded-full border px-4 py-2 text-sm transition ${occasion === item ? PILL_ACTIVE : PILL_IDLE}`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-7">
                        <p className={LABEL}>Theme</p>
                        <div className="mt-2 grid gap-3">
                          {PALETTE_OPTIONS.map((option) => {
                            const active = palette.id === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setPalette(option)}
                                className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition ${active ? CHOICE_ACTIVE : CHOICE_IDLE}`}
                              >
                                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                  <SafeImage src={option.previewImage} alt="" className="h-full w-full object-cover" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-ink">{option.name}</span>
                                  <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{option.tagline}</span>
                                  <span className="mt-2 flex gap-1">
                                    {option.colorSwatches.map((color) => (
                                      <span
                                        key={color}
                                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </span>
                                </span>
                                <span
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                                    active ? 'border-brand bg-brand text-white' : 'border-slate-300'
                                  }`}
                                >
                                  {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h2 className="font-serif text-2xl text-ink">Add a photo &amp; letter</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Your photo is printed as a vintage polaroid; your letter is written by hand.
                      </p>

                      <div className="mt-6">
                        <p className={LABEL}>
                          Photo <span className="font-normal text-slate-400">(optional)</span>
                        </p>
                        {photo ? (
                          <div className="mt-2 flex items-center gap-4 rounded-2xl border border-slate-200 p-3">
                            <img src={photo} alt="Your keepsake" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink">Photo added</p>
                              <p className="text-xs text-slate-500">Printed as a polaroid keepsake.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-slate-300"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhoto(null)}
                              aria-label="Remove photo"
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-8 text-center transition hover:border-brand/50 hover:bg-brand-soft/40"
                          >
                            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
                              <ImagePlus className="h-5 w-5" />
                            </span>
                            <span className="text-sm font-semibold text-ink">Upload a photo</span>
                            <span className="text-xs text-slate-500">JPG or PNG · up to 10 MB</span>
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhoto}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="sr-only"
                        />
                        {photoError && (
                          <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
                            {photoError}
                          </p>
                        )}
                      </div>

                      <div className="mt-7">
                        <div className="flex items-baseline justify-between gap-3">
                          <label htmlFor="letter" className={LABEL}>
                            Your letter
                          </label>
                          <span className="text-xs tabular-nums text-slate-400">
                            {letter.length}/{LETTER_LIMIT}
                          </span>
                        </div>
                        <textarea
                          id="letter"
                          rows={4}
                          maxLength={LETTER_LIMIT}
                          value={letter}
                          onChange={(event) => setLetter(event.target.value)}
                          placeholder="Pour your heart out — we’ll write it by hand."
                          className={`${INPUT} mt-1.5 resize-none py-3`}
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">Need inspiration?</span>
                          {QUICK_SENTIMENTS.map((sentiment) => (
                            <button
                              key={sentiment.label}
                              type="button"
                              onClick={() => setLetter(sentiment.text)}
                              className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-brand-soft hover:text-brand"
                            >
                              {sentiment.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h2 className="font-serif text-2xl text-ink">Review your hamper</h2>
                      <p className="mt-1 text-sm text-slate-500">Pick a box finish, then add it to your cart.</p>

                      <div className="mt-6 lg:hidden">
                        <HamperPreview
                          palette={palette}
                          recipient={recipientName}
                          occasion={occasion}
                          photo={photo}
                          letter={letter.trim()}
                          boxName={box.name}
                        />
                      </div>

                      <div className="mt-6">
                        <p className={LABEL}>Box finish</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {BOX_FINISHES.map((finish) => {
                            const active = boxId === finish.id;
                            return (
                              <button
                                key={finish.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setBoxId(finish.id)}
                                className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition ${
                                  active ? CHOICE_ACTIVE : CHOICE_IDLE
                                }`}
                              >
                                <span className="h-8 w-8 rounded-full ring-1 ring-black/10" style={{ backgroundColor: finish.swatch }} />
                                <span className="text-xs font-medium leading-tight text-ink">{finish.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 text-sm">
                        {[
                          ['For', recipientName || '—'],
                          ['Occasion', occasion],
                          ['Theme', palette.name],
                          ['Box', box.name],
                          ['Photo', photo ? 'Polaroid keepsake' : 'Not added'],
                          ['Letter', letter.trim() ? 'Handwritten & wax-sealed' : 'Not added'],
                        ].map(([term, value]) => (
                          <div key={term} className="flex items-center justify-between gap-4 px-4 py-3">
                            <dt className="text-slate-500">{term}</dt>
                            <dd className="text-right font-medium text-ink">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-6 flex items-end justify-between">
                        <span className="text-sm text-slate-500">Total</span>
                        <span className="text-2xl font-semibold text-ink">{formatPrice(BASE_HAMPER_PRICE)}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div ref={actionsRef} className="mt-8 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goToStep(step - 1)}
                      className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-ink"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                  ) : (
                    <Link to="/catalog?category=Hampers" className="text-sm font-medium text-slate-500 transition hover:text-ink">
                      Shop ready-made hampers
                    </Link>
                  )}
                  <button
                    type="submit"
                    disabled={!canContinue}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {primaryLabel} <PrimaryIcon className="h-4 w-4" />
                  </button>
                </div>
                {!canContinue && <p className="mt-3 text-right text-xs text-slate-500">Add their name to continue.</p>}
              </div>
            </form>
          </div>

          <aside className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-28">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Live preview</p>
              <HamperPreview
                palette={palette}
                recipient={recipientName}
                occasion={occasion}
                photo={photo}
                letter={letter.trim()}
                boxName={box.name}
              />
            </div>
          </aside>
        </div>
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
          showStickyBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              tabIndex={showStickyBar ? 0 : -1}
              aria-label="Previous step"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 text-ink"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <button
            type="submit"
            form="builder-form"
            disabled={!canContinue}
            tabIndex={showStickyBar ? 0 : -1}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white transition hover:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-500"
          >
            {primaryLabel} <PrimaryIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HamperBuilderPage;
