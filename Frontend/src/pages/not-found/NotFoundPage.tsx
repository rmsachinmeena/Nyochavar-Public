import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gift } from 'lucide-react';

export const NotFoundPage: React.FC = () => (
  <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center sm:py-28">
    <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-brand">
      <Gift className="h-9 w-9" strokeWidth={1.5} />
    </span>
    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Error 404</p>
    <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">We couldn’t find that page</h1>
    <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
      The link may be broken or the page may have moved. Let’s get you back to something lovely.
    </p>
    <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Link
        to="/catalog"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Shop all gifts <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        to="/"
        className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
      >
        Back to home
      </Link>
    </div>
  </section>
);

export default NotFoundPage;
