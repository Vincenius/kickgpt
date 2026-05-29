import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 mt-12 py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span>© {year}</span>
          <a
            href="https://vincentwill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors font-medium"
          >
            Vincent Will
          </a>
          <span className="mx-1">·</span>
          <span>Made with ☕ &amp; too many API tokens</span>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://vincentwill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-300 transition-colors"
          >
            vincentwill.com
          </a>
          <Link
            to="/privacy"
            className="hover:text-gray-300 transition-colors"
          >
            Privacy Policy
          </Link>
          <a
            href="https://ko-fi.com/wweb_dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-300 transition-colors"
          >
            ☕ Ko-fi
          </a>
        </div>
      </div>
    </footer>
  );
}
