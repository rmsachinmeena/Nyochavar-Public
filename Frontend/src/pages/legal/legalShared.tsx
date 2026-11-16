import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../hooks/useSeo';

// The business behind the store, shown on every legal page (privacy, terms, refund, shipping, contact) and in the
// footer. Razorpay's website review compares these with the KYC details, so the name and address must match the
// business details entered in Razorpay exactly. Change the email here once the domain mailbox exists.
export const BUSINESS = {
  name: 'Nyochavar',
  legalName: 'Demo Store Owner',
  // An individual seller (not a registered company or firm)
  operatorType: 'individual seller',
  address: '123 Demo Street, Sample City, State 000000, India',
  email: 'support@example.com',
  phone: '+91 99999 99999',
  supportHours: 'Every day, all 7 days of the week',
  grievanceOfficer: 'Demo Store Owner',
};

export const LAST_UPDATED = '4 November 2026';

export const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="font-serif text-xl text-ink sm:text-2xl">{title}</h2>
    <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
  </section>
);

export const List: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-brand">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

export const ContactCard: React.FC = () => (
  <address className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 not-italic text-sm leading-relaxed text-slate-700">
    <strong className="text-ink">{BUSINESS.name}</strong>, operated by {BUSINESS.legalName} ({BUSINESS.operatorType})
    <br />
    {BUSINESS.address}
    <br />
    Email: <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-brand hover:underline">{BUSINESS.email}</a>
    <br />
    Phone: <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className="font-semibold text-brand hover:underline">{BUSINESS.phone}</a>
    <br />
    Support hours: {BUSINESS.supportHours}
    <br />
    Grievance officer: {BUSINESS.grievanceOfficer}
  </address>
);

/** Shared frame of every legal page: heading, last-updated line, content and a way back home. */
export const LegalPage: React.FC<{ title: string; intro?: React.ReactNode; children: React.ReactNode }> = ({ title, intro, children }) => {
  useSeo({ title, description: `${title} of ${BUSINESS.name}.` });
  return (
  <article className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-16">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Legal</p>
    <h1 className="mt-2 font-serif text-[32px] leading-tight text-ink sm:text-4xl">{title}</h1>
    <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
    {intro && <p className="mt-6 text-[15px] leading-relaxed text-slate-600">{intro}</p>}

    <div className="mt-10 space-y-10">{children}</div>

    <p className="mt-12 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
      <Link to="/" className="font-semibold text-brand hover:underline">Back to home</Link>
      <Link to="/terms" className="hover:underline">Terms</Link>
      <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
      <Link to="/refund-policy" className="hover:underline">Refunds &amp; cancellation</Link>
      <Link to="/shipping-policy" className="hover:underline">Shipping</Link>
      <Link to="/contact" className="hover:underline">Contact</Link>
    </p>
  </article>
  );
};
