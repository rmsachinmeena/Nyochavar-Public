import React from 'react';

/** The logo files live in /public/brand. Swap those files to change the logo everywhere; no code needs to change. */
export const LOGO_SRC = '/brand/logo.png';
export const LOGO_MARK_SRC = '/brand/logo-mark.png';
export const BRAND_NAME = 'Nyochavar';

// The wordmark is 897 x 230 px (about 3.9 : 1): the size is set by height, the width follows
const LOGO_WIDTH = 897;
const LOGO_HEIGHT = 230;

interface BrandLogoProps {
  /** Kept so older call sites keep working: the logo is a picture now, so there is no light/dark text colour. */
  tone?: 'dark' | 'light';
  /** Kept for the same reason: the logo has no tagline line any more. */
  tagline?: 'always' | 'desktop' | 'never';
  /**
   * Height of the logo. It grows with the screen: phone / tablet / desktop.
   *  sm: header of small panels   md (default): site header and footer   lg: the sign-in page
   */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const HEIGHT_BY_SIZE: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-6 sm:h-7',
  md: 'h-7 sm:h-8 lg:h-9',
  lg: 'h-12 sm:h-14 lg:h-16',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => (
  <img
    src={LOGO_SRC}
    alt={BRAND_NAME}
    width={LOGO_WIDTH}
    height={LOGO_HEIGHT}
    decoding="async"
    draggable={false}
    className={`block w-auto max-w-full select-none object-contain ${HEIGHT_BY_SIZE[size]} ${className}`}
  />
);
