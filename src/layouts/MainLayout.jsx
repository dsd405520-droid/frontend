import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { Bell } from 'lucide-react';
import { getSocket } from '../utils/socket';

export default function MainLayout({ children }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setToast(notification);
      // ອັບເດດ badge ຢູ່ Sidebar ທັນທີ (ຮອງຮັບ event ດຽວກັນທີ່ Sidebar ຟັງຢູ່)
      window.dispatchEvent(new Event('unread-counts-changed'));

      // ເຊື່ອງ toast ອັດຕະໂນມັດຫຼັງ 5 ວິນາທີ
      setTimeout(() => setToast(null), 5000);
    };

    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, []);

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

      {/* Toast ແຈ້ງເຕືອນແບບ Real-time */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-gray-200 shadow-lg rounded-2xl p-4 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{toast.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-gray-300 hover:text-gray-500 ml-auto shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}