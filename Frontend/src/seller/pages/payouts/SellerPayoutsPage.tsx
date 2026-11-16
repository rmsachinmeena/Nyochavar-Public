import React from 'react';
import { Lock } from 'lucide-react';

// Public portfolio copy: the payout ledger and settlement screen are not included.
export const SellerPayoutsPage: React.FC = () => (
  <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
    <Lock className="mx-auto h-8 w-8 text-slate-400" />
    <h1 className="mt-4 font-serif text-xl text-ink">Payouts &amp; Ledger</h1>
    <p className="mt-2 text-sm text-slate-500">
      This screen is not part of the public demo. In the full project, sellers see weekly earnings and settlements here.
    </p>
  </div>
);
