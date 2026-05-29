import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home' },
  { to: '/predictions', label: 'Predictions' },
  { to: '/ai-profiles', label: 'AI Profiles' },
  { to: '/faq', label: 'FAQ' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-gray-900 tracking-tight text-lg">KickGPT</span>
            <span className="hidden sm:inline text-gray-400 text-sm font-normal ml-1">World Cup 2026</span>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-tab ${isActive ? 'nav-tab-active' : 'nav-tab-inactive'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
