import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2, RotateCcw, Rocket } from 'lucide-react';
import { useSeller } from '../../../context/SellerContext';
import { sellerApi } from '../../../services/sellerApi';
import type { SellerProduct } from '../../../data/mockSellerData';
import { cloudinaryOptimized } from '../../../../utils/imageAssets';
import { StepBasics } from './StepBasics';
import { StepPhotos } from './StepPhotos';
import { StepPricing } from './StepPricing';
import { StepVariants } from './StepVariants';
import { StepDetails } from './StepDetails';
import { StepReview, type Confirmations } from './StepReview';
import { WizardStepper } from './WizardParts';
import {
  WIZARD_STEPS,
  buildProductPayload,
  clearDraft,
  emptyDraft,
  loadDraft,
  saveDraft,
  toAmount,
  validateStep,
  type DraftErrors,
  type ProductDraft,
  type StepId,
} from './productFormState';

// The steps a seller fills in, in order (the last step only reviews them)
const FILL_STEPS: StepId[] = ['basics', 'photos', 'pricing', 'variants', 'details'];

/**
 * "List a new product": the step-by-step form. Each step checks its own fields before the seller may continue,
 * and what the seller has typed is kept on the device, so a refresh does not lose it.
 */
export const SellerProductWizardPage: React.FC = () => {
  const { profile, commissionRate, addProduct } = useSeller();

  const [draft, setDraft] = useState<ProductDraft>(() => loadDraft(profile.storeName));
  const [step, setStep] = useState<StepId>('basics');
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  // True while pictures are still being uploaded (step 2, or an option's pictures in step 4): Continue waits for them
  const [photosBusy, setPhotosBusy] = useState(false);
  const [busyOptions, setBusyOptions] = useState<Set<string>>(new Set());
  const uploadBusy = photosBusy || busyOptions.size > 0;
  const [confirmations, setConfirmations] = useState<Confirmations>({ accurate: false, rights: false, fssai: false });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<SellerProduct | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const stepIndex = WIZARD_STEPS.findIndex((candidate) => candidate.id === step);
  const current = WIZARD_STEPS[stepIndex];
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  useEffect(() => {
    void sellerApi.listStoreCategories().then((list) => {
      setCategories(list);
      setCategoriesLoaded(true);
    });
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const update = useCallback((changes: Partial<ProductDraft>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    // A field that was marked wrong is cleared as soon as the seller edits it
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(changes) as Array<keyof ProductDraft>) delete next[key];
      return next;
    });
  }, []);

  const addImage = useCallback((url: string) => {
    setDraft((previous) => ({ ...previous, images: [...previous.images, url] }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next.images;
      return next;
    });
  }, []);

  const problems = useMemo(() => {
    const found: Partial<Record<StepId, number>> = {};
    for (const id of FILL_STEPS) found[id] = Object.keys(validateStep(id, draft)).length;
    return found;
  }, [draft]);
  const totalProblems = (Object.values(problems) as Array<number | undefined>).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const confirmed = confirmations.accurate && confirmations.rights && (!draft.isFood || confirmations.fssai);

  const addVariantImage = useCallback((variantId: string, url: string) => {
    setDraft((previous) => ({
      ...previous,
      variants: previous.variants.map((variant) => (variant.id === variantId ? { ...variant, images: [...variant.images, url] } : variant)),
    }));
  }, []);

  const setOptionBusy = useCallback((variantId: string, busy: boolean) => {
    setBusyOptions((previous) => {
      if (previous.has(variantId) === busy) return previous;
      const next = new Set(previous);
      if (busy) next.add(variantId);
      else next.delete(variantId);
      return next;
    });
  }, []);

  const goTo = (target: StepId) => {
    setErrors({});
    setStep(target);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleContinue = () => {
    const found = validateStep(step, draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Bring the first wrong field into view
      const first = Object.keys(found)[0];
      const field = document.getElementById(`wz-${first === 'inTheBox' ? 'box' : first}`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
      return;
    }
    setDone((previous) => new Set(previous).add(step));
    if (!isLast) goTo(WIZARD_STEPS[stepIndex + 1].id);
  };

  const handlePublish = async () => {
    if (publishing) return;
    // Every step is checked again, so nothing wrong can be sent
    const wrongStep = FILL_STEPS.find((id) => Object.keys(validateStep(id, draft)).length > 0);
    if (wrongStep) {
      setPublishError('Some steps are not complete yet. Press Edit on the sections marked in red.');
      return;
    }
    if (!confirmed) {
      setPublishError('Please tick the confirmations above before you publish.');
      return;
    }
    setPublishError(null);
    setPublishing(true);
    try {
      const created = await addProduct(buildProductPayload(draft));
      clearDraft();
      setPublished(created);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'The product could not be published. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const listAnother = () => {
    setDraft(emptyDraft(profile.storeName));
    setDone(new Set());
    setErrors({});
    setConfirmations({ accurate: false, rights: false, fssai: false });
    setPublishError(null);
    setPublished(null);
    setStep('basics');
  };

  const startOver = () => {
    if (!window.confirm('Clear everything you have typed for this product and start again?')) return;
    clearDraft();
    setDraft(emptyDraft(profile.storeName));
    setDone(new Set());
    setErrors({});
    setConfirmations({ accurate: false, rights: false, fssai: false });
    setPublishError(null);
    goTo('basics');
  };

  const stepBody = useMemo(() => {
    if (step === 'basics') {
      return <StepBasics draft={draft} errors={errors} onChange={update} categories={categories} categoriesLoaded={categoriesLoaded} />;
    }
    if (step === 'photos') {
      return <StepPhotos images={draft.images} errors={errors} onChange={(images) => update({ images })} onAdd={addImage} onBusyChange={setPhotosBusy} />;
    }
    if (step === 'pricing') {
      return <StepPricing draft={draft} errors={errors} onChange={update} commissionRate={commissionRate} />;
    }
    if (step === 'variants') {
      return <StepVariants draft={draft} errors={errors} onChange={update} onAddVariantImage={addVariantImage} onVariantBusy={setOptionBusy} />;
    }
    if (step === 'details') {
      return <StepDetails draft={draft} errors={errors} onChange={update} />;
    }
    return (
      <StepReview
        draft={draft}
        problems={problems}
        confirmations={confirmations}
        onConfirm={(changes) => {
          setConfirmations((previous) => ({ ...previous, ...changes }));
          setPublishError(null);
        }}
        onEdit={goTo}
        commissionRate={commissionRate}
        publishError={publishError}
      />
    );
  }, [step, draft, errors, update, addImage, addVariantImage, setOptionBusy, categories, categoriesLoaded, commissionRate, problems, confirmations, publishError]);

  if (published) {
    return (
      <div className="mx-auto max-w-lg py-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-4 font-serif text-2xl text-ink">{profile.isVacationMode ? 'Your product is saved' : 'Your product is live!'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {profile.isVacationMode
            ? 'Your store is on vacation, so buyers cannot see it yet. It goes live when you resume your store.'
            : 'Buyers can now find it in the Nyochavar store.'}
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
          <div className="flex items-center gap-3 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {published.images[0] && <img src={cloudinaryOptimized(published.images[0], 200)} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{published.title}</p>
              <p className="text-xs text-slate-500">
                ₹{published.price.toLocaleString('en-IN')} · {published.stock} in stock
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          {!profile.isVacationMode && (
            <Link to={`/product/${published.id}`} className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark">
              View in store
            </Link>
          )}
          <Link to="/seller/products" className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
            Go to my products
          </Link>
          <button
            type="button"
            onClick={listAnother}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            List another product
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="space-y-6 scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/seller/products"
            aria-label="Back to products"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-ink">List a new product</h1>
            <p className="truncate text-xs text-slate-500">It goes live in the Nyochavar store as soon as you publish.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startOver}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Start over</span>
        </button>
      </div>

      <WizardStepper steps={WIZARD_STEPS} current={step} done={done} onGo={goTo} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <header className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
              Step {stepIndex + 1} of {WIZARD_STEPS.length}
            </p>
            <h2 className="mt-0.5 font-serif text-xl text-ink">{current.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{current.hint}</p>
          </header>

          <div className="px-5 py-5 sm:px-6 sm:py-6">{stepBody}</div>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => goTo(WIZARD_STEPS[stepIndex - 1].id)}
              disabled={stepIndex === 0}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:invisible"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing || totalProblems > 0 || !confirmed}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                {publishing ? 'Publishing...' : 'Publish product'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleContinue}
                disabled={uploadBusy && (step === 'photos' || step === 'variants')}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploadBusy && (step === 'photos' || step === 'variants') ? 'Uploading...' : 'Continue'} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </footer>
        </section>

        {/* How the product looks to buyers; it fills in as the steps are completed */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Eye className="h-3.5 w-3.5" /> How buyers will see it
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
              {draft.images[0] ? (
                <img src={cloudinaryOptimized(draft.images[0], 600)} alt="" className="h-44 w-full object-cover" />
              ) : (
                <div className="grid h-44 place-items-center bg-slate-100 text-xs text-slate-400">Your cover picture shows here</div>
              )}
              <div className="space-y-2 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">{draft.category || 'Category'}</span>
                <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">{draft.title.trim() || 'Your product name'}</p>
                {draft.tagline.trim() && <p className="line-clamp-2 text-xs text-slate-500">{draft.tagline.trim()}</p>}
                {toAmount(draft.price) > 0 && (
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-base font-extrabold text-ink">₹{toAmount(draft.price).toLocaleString('en-IN')}</span>
                    {toAmount(draft.mrp) > toAmount(draft.price) && (
                      <>
                        <span className="text-xs text-slate-400 line-through">₹{toAmount(draft.mrp).toLocaleString('en-IN')}</span>
                        <span className="text-[11px] font-bold text-emerald-600">
                          {Math.round(((toAmount(draft.mrp) - toAmount(draft.price)) / toAmount(draft.mrp)) * 100)}% OFF
                        </span>
                      </>
                    )}
                  </div>
                )}
                {draft.hasVariants && draft.variants.some((variant) => variant.name.trim()) && (
                  <p className="text-[11px] font-medium text-slate-500">
                    {draft.variantLabel.trim() || 'Options'}: Original{draft.variants.filter((variant) => variant.name.trim()).map((variant) => `, ${variant.name.trim()}`).join('')}
                  </p>
                )}
                {draft.occasions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {draft.occasions.slice(0, 4).map((occasion) => (
                      <span key={occasion} className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
                        {occasion}
                      </span>
                    ))}
                    {draft.occasions.length > 4 && <span className="text-[10px] font-semibold text-slate-400">+{draft.occasions.length - 4}</span>}
                  </div>
                )}
                <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  Sold by <strong className="text-slate-700">{draft.brand.trim() || profile.storeName}</strong>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SellerProductWizardPage;
