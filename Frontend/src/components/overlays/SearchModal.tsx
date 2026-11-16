import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Search, SearchX, TrendingUp, X } from 'lucide-react';
import type { Product } from '../../types';
import { useProducts } from '../../hooks/useCatalog';
import { useBodyScrollLock, useEscapeKey } from '../../hooks/useOverlay';
import { EMPTY_FILTERS, pickMostLoved, productMatches } from '../../utils/catalog';
import { formatPrice } from '../../utils/format';
import { SafeImage } from '../ui/SafeImage';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = ['Hampers', 'Flowers', 'Birthday', 'Anniversary', 'Diwali', 'Personalized'];

const RECIPIENT_LINKS = [
  { label: 'Gifts for her', to: '/catalog?for=her' },
  { label: 'Gifts for him', to: '/catalog?for=him' },
];

const SECTION_TITLE = 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400';

const ResultRow: React.FC<{ product: Product; onSelect: () => void }> = ({ product, onSelect }) => (
  <li>
    <Link
      to={`/product/${product.id}`}
      onClick={onSelect}
      className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-slate-50"
    >
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        <SafeImage src={product.image} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[15px] text-ink">{product.name}</span>
        <span className="block truncate text-xs text-slate-500">{product.category}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-ink">{formatPrice(product.price)}</span>
    </Link>
  </li>
);

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { products } = useProducts();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const term = query.trim();
  const matches = useMemo(
    () => (term ? products.filter((product) => productMatches(product, { ...EMPTY_FILTERS, query: term })) : []),
    [products, term]
  );
  const trending = useMemo(() => pickMostLoved(products, 3), [products]);

  const showAllResults = () => {
    if (!term) return;
    onClose();
    navigate(`/catalog?q=${encodeURIComponent(term)}`);
  };

  const renderChip = (label: string) => (
    <button
      key={label}
      type="button"
      onClick={() => {
        setQuery(label);
        inputRef.current?.focus();
      }}
      className="rounded-full border border-slate-200 px-4 py-2 text-sm text-ink transition hover:border-blue-200 hover:bg-brand-soft hover:text-brand"
    >
      {label}
    </button>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="search"
          role="dialog"
          aria-modal="true"
          aria-label="Search gifts"
          className="storefront fixed inset-0 z-[70] font-body text-ink antialiased"
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            className="absolute inset-0 flex flex-col bg-white sm:inset-x-4 sm:bottom-auto sm:top-6 sm:mx-auto sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:shadow-float"
          >
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                showAllResults();
              }}
              className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-4 sm:h-[4.5rem] sm:px-6"
            >
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search flowers, hampers, occasions…"
                aria-label="Search gifts"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-slate-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-slate-500 transition hover:text-ink"
              >
                <span className="sm:hidden">Cancel</span>
                <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 font-body text-[11px] text-slate-400 sm:inline">
                  Esc
                </kbd>
              </button>
            </form>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
              {!term ? (
                <div className="space-y-7">
                  <section>
                    <h3 className={SECTION_TITLE}>Popular searches</h3>
                    <div className="mt-3 flex flex-wrap gap-2">{POPULAR_SEARCHES.map((label) => renderChip(label))}</div>
                  </section>
                  <section>
                    <h3 className={SECTION_TITLE}>Shop by recipient</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {RECIPIENT_LINKS.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={onClose}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5 text-sm font-medium text-ink transition hover:bg-brand-soft hover:text-brand"
                        >
                          {link.label}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ))}
                    </div>
                  </section>
                  {trending.length > 0 && (
                    <section>
                      <h3 className={SECTION_TITLE}>
                        <TrendingUp className="h-3.5 w-3.5" /> Trending gifts
                      </h3>
                      <ul className="mt-2">
                        {trending.map((product) => (
                          <ResultRow key={product.id} product={product} onSelect={onClose} />
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              ) : matches.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400">
                    <SearchX className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-serif text-xl text-ink">No gifts found for “{term}”</p>
                  <p className="mt-1 text-sm text-slate-500">Try another word, or start with a popular search.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {POPULAR_SEARCHES.slice(0, 4).map((label) => renderChip(label))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500">
                    {matches.length} {matches.length === 1 ? 'gift' : 'gifts'} found
                  </p>
                  <ul className="mt-2">
                    {matches.slice(0, 6).map((product) => (
                      <ResultRow key={product.id} product={product} onSelect={onClose} />
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={showAllResults}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink-soft"
                  >
                    <span className="truncate">See all results for “{term}”</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
