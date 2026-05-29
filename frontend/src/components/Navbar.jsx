import React from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Rangliste', emoji: '🏆' },
  { to: '/spiele', label: 'Spiele', emoji: '⚽' },
  { to: '/ki-profile', label: 'KI-Profile', emoji: '🤖' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0F]/90 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="font-extrabold text-white tracking-tight">KickGPT</span>
            <span className="hidden sm:inline text-gray-500 text-sm font-medium ml-1">WM 2026</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1">
            {TABS.map(({ to, label, emoji }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-tab ${isActive ? 'nav-tab-active' : 'nav-tab-inactive'}`
                }
              >
                <span className="text-base">{emoji}</span>
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
