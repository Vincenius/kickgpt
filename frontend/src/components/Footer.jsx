import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 mt-12 py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span>© {year}</span>
          <a
            href="https://vincentwill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-900 transition-colors font-medium ml-1"
          >
            Vincent Will
          </a>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://vincentwill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            vincentwill.com
          </a>
          <Link to="/privacy" className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </Link>
          <a
            href="https://ko-fi.com/wweb_dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            Help me feed the AIs
          </a>
        </div>
      </div>
    </footer>
  );
}
