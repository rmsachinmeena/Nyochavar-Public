import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; to: string };
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  headingLevel?: 'h1' | 'h2';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  tone = 'light',
  headingLevel = 'h2',
  className = '',
}) => {
  const Heading = headingLevel;
  const centered = align === 'center';
  const dark = tone === 'dark';

  return (
    <div
      className={`flex flex-col gap-4 ${
        centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
      } ${className}`}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-blue-300' : 'text-brand'}`}
          >
            {eyebrow}
          </p>
        )}
        <Heading
          className={`mt-2 font-serif text-[26px] leading-[1.15] tracking-[-0.01em] sm:text-3xl lg:text-[2.5rem] ${
            dark ? 'text-white' : 'text-ink'
          }`}
        >
          {title}
        </Heading>
        {description && (
          <p className={`mt-3 text-[15px] leading-relaxed ${dark ? 'text-white/70' : 'text-slate-500'}`}>
            {description}
          </p>
        )}
      </div>

      {action && (
        <Link
          to={action.to}
          className={`group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors hover:text-brand ${
            dark ? 'text-white' : 'text-ink'
          }`}
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
};
