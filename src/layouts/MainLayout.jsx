import React from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar ດ້ານຊ້າຍ */}
      <Sidebar />

      {/* Main Content Area (เว้นระยะซ้าย 64 สำหรับ Sidebar) */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Navbar />
        <main className="p-6 mt-16 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}