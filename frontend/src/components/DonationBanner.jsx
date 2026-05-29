import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'kickgpt_banner_dismissed';

export default function DonationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative bg-gradient-to-r from-amber-950/80 via-orange-950/80 to-amber-950/80 border-b border-amber-500/20">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">🤖</span>
          <p className="text-sm text-amber-200/90 leading-snug">
            <span className="font-semibold text-amber-100">5 AIs, 104 matches, a lot of tokens.</span>
            {' '}Help me keep feeding the AIs!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://ko-fi.com/wweb_dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#FF5E5B] hover:bg-[#ff4542] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>☕</span> Buy me a coffee
          </a>
          <button
            onClick={dismiss}
            className="text-amber-400/60 hover:text-amber-300 transition-colors text-lg leading-none p-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
