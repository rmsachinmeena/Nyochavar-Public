import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, PenLine, ShoppingBag, X } from 'lucide-react';
import { useCart, useUI } from '../../context';
import { formatPrice } from '../../utils/format';
import { Sheet } from '../ui/Sheet';
import { SafeImage } from '../ui/SafeImage';
import { QuantityStepper } from '../ui/QuantityStepper';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BESPOKE_PRODUCT_ID = 'bespoke-hamper';

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { cart, cartTotalCount, cartSubtotal, handleUpdateQuantity, handleRemoveCartItem } = useCart();
  const { dismissToast } = useUI();

  useEffect(() => {
    if (isOpen) dismissToast();
  }, [isOpen, dismissToast]);

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const title = (
    <span className="flex items-baseline gap-2">
      Your cart
      {cartTotalCount > 0 && (
        <span className="font-body text-sm font-medium text-slate-400">
          {cartTotalCount} {cartTotalCount === 1 ? 'item' : 'items'}
        </span>
      )}
    </span>
  );

  const footer =
    cart.length > 0 ? (
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Subtotal</span>
          <span className="text-lg font-semibold text-ink">{formatPrice(cartSubtotal)}</span>
        </div>
        <p className="text-xs text-slate-500">Delivery slot and taxes are calculated at checkout.</p>
        <button
          type="button"
          onClick={() => goTo('/checkout')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Checkout <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-1 text-center text-sm font-medium text-slate-500 transition hover:text-ink"
        >
          Continue shopping
        </button>
      </div>
    ) : undefined;

  return (
    <Sheet open={isOpen} onClose={onClose} side="right" title={title} footer={footer}>
      {cart.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
            <ShoppingBag className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <h3 className="mt-5 font-serif text-2xl text-ink">Your cart is empty</h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
            Find something lovely — every gift comes with a free handwritten note.
          </p>
          <button
            type="button"
            onClick={() => goTo('/catalog')}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-soft"
          >
            Explore gifts <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <p className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-xs font-medium text-brand">
            <PenLine className="h-4 w-4 shrink-0" />A handwritten note is included with every gift.
          </p>
          <ul className="divide-y divide-slate-100 px-5">
            {cart.map((item) => {
              const productPath = item.productId !== BESPOKE_PRODUCT_ID ? `/product/${item.productId}` : null;
              const details = [item.variant?.name, item.selectedHue, item.palette, ...(item.addons ?? []).map((addon) => `+ ${addon.name}`)].filter(
                Boolean
              );
              const thumbnail = <SafeImage src={item.image} alt="" className="h-full w-full object-cover" />;

              return (
                <li key={item.id} className="flex gap-4 py-5">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    {productPath ? (
                      <Link to={productPath} onClick={onClose} tabIndex={-1} aria-hidden="true" className="block h-full w-full">
                        {thumbnail}
                      </Link>
                    ) : (
                      thumbnail
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-serif text-[15px] leading-snug text-ink">
                        {productPath ? (
                          <Link to={productPath} onClick={onClose} className="transition-colors hover:text-brand">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="-mr-2 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {details.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{details.join(' · ')}</p>}
                    {item.message && (
                      <p className="mt-1 line-clamp-1 font-script text-lg leading-tight text-brand">“{item.message}”</p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={5}
                        onChange={(next) => handleUpdateQuantity(item.id, next - item.quantity)}
                        onRemove={() => handleRemoveCartItem(item.id)}
                      />
                      <span className="text-sm font-semibold text-ink">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
};
