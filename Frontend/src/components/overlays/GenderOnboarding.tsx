import React from 'react';
import { Sparkles, Heart, Shield, ArrowRight } from 'lucide-react';
import styles from '../../styles/productPage.module.css';

interface GenderOnboardingProps {
  onSelectGender: (gender: 'men' | 'women') => void;
}

export const GenderOnboarding: React.FC<GenderOnboardingProps> = ({ onSelectGender }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0B]/90 backdrop-blur-md p-4">
      {/* Container Card */}
      <div className="relative max-w-md w-full bg-[#121214] border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
        
        {/* Glow effects inside card */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

        {/* Small Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/15 text-blue-400 border border-blue-500/30 text-[9px] font-bold tracking-[0.15em] uppercase mb-4">
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>Concierge Preference</span>
        </div>

        {/* Headings */}
        <h2 className={`text-2xl font-bold text-[#F4F4F4] mb-2 ${styles.serifHeading}`}>
          Who are you shopping for?
        </h2>
        <p className="text-xs text-white/50 mb-6 max-w-xs mx-auto">
          Choose a palette and product curation to match their personality.
        </p>

        {/* 1-Click Action Buttons */}
        <div className="flex flex-col gap-3">
          
          {/* Option: Gift for Women */}
          <button
            onClick={() => onSelectGender('women')}
            className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-[#17171A] hover:border-blue-500/50 transition-all duration-300 text-left group cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-600/15 text-blue-400 border border-blue-500/35 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F4F4F4]">Gift for Women</h4>
                <p className="text-[10px] text-white/40">Curated florals & delicate arrangements</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Option: Gift for Men */}
          <button
            onClick={() => onSelectGender('men')}
            className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-[#17171A] hover:border-[#8E9AAF]/50 transition-all duration-300 text-left group cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#8E9AAF]/15 text-[#9FB1BC] border border-[#8E9AAF]/35 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F4F4F4]">Gift for Men</h4>
                <p className="text-[10px] text-white/40">Sleek slate theme & professional curations</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-[#9FB1BC] group-hover:translate-x-1 transition-all" />
          </button>

        </div>

        {/* Footer info */}
        <p className="text-[9px] text-white/30 uppercase tracking-widest mt-6">
          Same-day shipping is standard.
        </p>

      </div>
    </div>
  );
};
