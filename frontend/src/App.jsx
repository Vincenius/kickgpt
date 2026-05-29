import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import KiProfile from './pages/KiProfile.jsx';
import BonusTips from './pages/BonusTips.jsx';
import Privacy from './pages/Privacy.jsx';
import FAQ from './pages/FAQ.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ai-profiles" element={<KiProfile />} />
          <Route path="/predictions" element={<BonusTips />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* Legacy redirects */}
          <Route path="/matches" element={<Navigate to="/" replace />} />
          <Route path="/spiele" element={<Navigate to="/" replace />} />
          <Route path="/ki-profile" element={<Navigate to="/ai-profiles" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
