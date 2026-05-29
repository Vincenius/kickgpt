import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import DonationBanner from './components/DonationBanner.jsx';
import Footer from './components/Footer.jsx';
import Rangliste from './pages/Rangliste.jsx';
import Spiele from './pages/Spiele.jsx';
import KiProfile from './pages/KiProfile.jsx';
import Privacy from './pages/Privacy.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <DonationBanner />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-8">
        <Routes>
          <Route path="/" element={<Rangliste />} />
          <Route path="/matches" element={<Spiele />} />
          <Route path="/ai-profiles" element={<KiProfile />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* Legacy redirects */}
          <Route path="/spiele" element={<Navigate to="/matches" replace />} />
          <Route path="/ki-profile" element={<Navigate to="/ai-profiles" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
