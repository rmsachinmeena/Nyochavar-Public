// Big banner pictures live on Cloudinary (a fast image CDN) instead of in /public, so the page does not have to carry
// megabytes of PNG itself. `f_auto,q_auto` makes Cloudinary send the lightest format the browser understands
// (WebP / AVIF) and `w_` sizes the picture for where it is shown.
const CLOUD = 'https://res.cloudinary.com/dodhs4r1l/image/upload';

const fast = (width: number, versionAndFile: string) => `${CLOUD}/f_auto,q_auto,w_${width}/${versionAndFile}`;

export const IMAGE_ASSETS = {
  /** "Complete your profile" banner: phone */
  profileBannerMobile: fast(900, 'v1793093622/profile-banner-mobile_pn07xs.png'),
  /** "Complete your profile" banner: tablet and desktop */
  profileBannerDesktop: fast(1600, 'v1793093621/profile-banner-desktop_nmwzpu.png'),
  /** Offers picture in the phone's menu sheet */
  romanticGiftCarousel: fast(900, 'v1793093621/Romantic_Gift_Category_Carousel_hkzwcw.png'),
  /** Hamper builder picture in the phone's menu sheet */
  hamperImage: fast(900, 'v1793093621/Hammper_image_i1v4c8.png'),
} as const;

/**
 * Ask Cloudinary for a lighter copy of an uploaded picture: `f_auto` (WebP/AVIF where supported), `q_auto`, and a
 * width cap so a phone never downloads the 2400px desktop file. Anything that is not a plain Cloudinary upload URL
 * (local files, other sites, URLs that already carry their own transformation) is returned untouched.
 */
export const cloudinaryOptimized = (url: string | undefined, width: number): string => {
  if (!url) return '';
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at === -1 || !url.includes('res.cloudinary.com')) return url;
  const rest = url.slice(at + marker.length);
  // A transformation segment looks like "f_auto,q_auto,w_800/"; a plain upload goes straight to "v123/file.png"
  if (/^[a-z]{1,3}_[^/]*\//.test(rest)) return url;
  return `${url.slice(0, at + marker.length)}f_auto,q_auto,w_${width},c_limit/${rest}`;
};
