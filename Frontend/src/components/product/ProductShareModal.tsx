import React, { useState, useEffect } from 'react';
import { X, Link2, Check, MoreHorizontal } from 'lucide-react';
import type { Product } from '../../types';

interface ProductShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export const ProductShareModal: React.FC<ProductShareModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = product.name;
  const shareSubtitle = product.tagline || product.category || 'Artisanal Luxury Gift';
  const shareText = `Check out ${product.name} on Nyochavar:`;

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Copy link failed', e);
    }
  };

  const shareChannels = [
    {
      id: 'copy',
      name: copied ? 'Copied!' : 'Copy Link',
      bgColor: copied ? 'bg-emerald-600' : 'bg-[#1877F2]',
      icon: copied ? (
        <Check className="h-5 w-5 text-white" strokeWidth={2.8} />
      ) : (
        <Link2 className="h-5 w-5 text-white" strokeWidth={2.2} />
      ),
      action: copyToClipboard,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      bgColor: 'bg-[#25D366]',
      icon: (
        <svg className="h-5.5 w-5.5 fill-white" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      action: () => {
        const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'instagram',
      name: 'Instagram',
      bgColor: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
      icon: (
        <svg className="h-5.5 w-5.5 fill-white" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.441-1.44z" />
        </svg>
      ),
      action: async () => {
        await copyToClipboard();
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'messenger',
      name: 'Facebook messenger',
      bgColor: 'bg-gradient-to-tr from-[#00B2FF] to-[#006AFF]',
      icon: (
        <svg className="h-5.5 w-5.5 fill-white" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.913 1.455 5.518 3.734 7.205V22l3.391-1.86c.91.252 1.879.388 2.875.388 5.523 0 10-4.145 10-9.27S17.523 2 12 2zm1.066 12.443l-2.73-2.914-5.326 2.914 5.86-6.223 2.784 2.914 5.272-2.914-5.86 6.223z" />
        </svg>
      ),
      action: () => {
        const messengerUrl = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        const fallbackUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        // Try messenger protocol, fallback to web
        try {
          window.location.href = messengerUrl;
          setTimeout(() => {
            window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
          }, 600);
        } catch {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
      },
    },
    {
      id: 'gmail',
      name: 'Gmail',
      bgColor: 'bg-white border border-slate-200 shadow-2xs',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
      ),
      action: () => {
        const subject = encodeURIComponent(`Thought you would love this: ${product.name}`);
        const body = encodeURIComponent(`Hi,\n\nI found this artisanal gift on Nyochavar and thought of you:\n\n${product.name}\n${url}\n\nHope you love it!`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      },
    },
    {
      id: 'sms',
      name: 'SMS',
      bgColor: 'bg-[#0084FF]',
      icon: (
        <svg className="h-5.5 w-5.5 fill-white" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V9h2v2zm-4 0H7V9h2v2zm8 0h-2V9h2v2z" />
        </svg>
      ),
      action: () => {
        const body = encodeURIComponent(`${shareText} ${url}`);
        window.location.href = `sms:?body=${body}`;
      },
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      bgColor: 'bg-[#0A66C2]',
      icon: (
        <svg className="h-4.5 w-4.5 fill-white" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
      action: () => {
        const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
      },
    },
    {
      id: 'hangouts',
      name: 'Hangouts',
      bgColor: 'bg-[#0F9D58]',
      icon: (
        <svg className="h-5.5 w-5.5 fill-white" viewBox="0 0 24 24">
          <path d="M11.5 3C6.8 3 3 6.8 3 11.5c0 2.6 1.2 5 3.1 6.5l-.8 3.5 3.9-1.6c.7.3 1.5.4 2.3.4 4.7 0 8.5-3.8 8.5-8.5S16.2 3 11.5 3zm-2.8 10.3c-.9 0-1.7-.7-1.7-1.7s.7-1.7 1.7-1.7 1.7.7 1.7 1.7-.7 1.7-1.7 1.7zm5.6 0c-.9 0-1.7-.7-1.7-1.7s.7-1.7 1.7-1.7 1.7.7 1.7 1.7-.8 1.7-1.7 1.7z" />
        </svg>
      ),
      action: () => {
        // Telegram / Direct message fallback
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'more',
      name: 'More Apps',
      bgColor: 'bg-slate-100 border border-slate-200',
      icon: <MoreHorizontal className="h-5.5 w-5.5 text-slate-700" />,
      action: async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: product.name,
              text: shareText,
              url: url,
            });
            onClose();
          } catch {
            // User cancelled share dialog
          }
        } else {
          copyToClipboard();
        }
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Flipkart-Style Bottom Sheet / Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl transition-all overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        {/* Header: [✕ Share] (Left-aligned close button and title exactly like Flipkart) */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100 transition active:scale-95"
            aria-label="Close share sheet"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.2} />
          </button>
          <h3 id="share-modal-title" className="text-base font-semibold text-slate-900">
            Share
          </h3>
        </div>

        {/* Product Preview Card */}
        <div className="p-3.5 sm:p-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="h-12 w-12 shrink-0 rounded-md border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
              <img
                src={product.image || '/banners/hero-banner-1.png'}
                alt={product.name}
                className="h-full w-full object-contain p-0.5"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/banners/hero-banner-1.png';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{shareTitle}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{shareSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Share Channels Grid (4 columns, exactly matching Flipkart's layout) */}
        <div className="px-3 pb-6 pt-1 sm:px-4">
          <div className="grid grid-cols-4 gap-y-5 gap-x-1.5">
            {shareChannels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={channel.action}
                className="group flex flex-col items-center gap-1.5 focus:outline-hidden"
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-full ${channel.bgColor} shadow-xs transition-transform duration-150 group-hover:scale-105 active:scale-95`}
                >
                  {channel.icon}
                </div>
                <span className="text-[11px] font-medium text-slate-700 text-center leading-tight max-w-[76px] line-clamp-2 group-hover:text-slate-900">
                  {channel.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Toast alert banner when link is copied */}
        {copied && (
          <div className="bg-emerald-50 border-t border-emerald-200 px-4 py-2.5 text-center animate-in fade-in duration-150">
            <p className="text-xs font-semibold text-emerald-800 flex items-center justify-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />
              Link copied to clipboard!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductShareModal;
