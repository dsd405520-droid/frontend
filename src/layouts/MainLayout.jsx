import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar ດ້ານຊ້າຍ — ເປັນ drawer ສຳລັບ mobile, sidebar ຢູ່ຄົງທີ່ສຳລັບ desktop */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area (lg ເທົ່ານັ້ນທີ່ເລື່ອນໄປທາງຂວາ 16rem ສຳລັບ Sidebar) */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 mt-16 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}