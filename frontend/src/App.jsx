import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Rangliste from './pages/Rangliste.jsx';
import Spiele from './pages/Spiele.jsx';
import KiProfile from './pages/KiProfile.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-8">
        <Routes>
          <Route path="/" element={<Rangliste />} />
          <Route path="/spiele" element={<Spiele />} />
          <Route path="/ki-profile" element={<KiProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
