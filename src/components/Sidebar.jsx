import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  LayoutDashboard, 
  Ticket, 
  Clock, 
  BookOpen, 
  Users, 
  Shield, 
  Building2, 
  Package, 
  Calendar, 
  Briefcase, 
  Megaphone, 
  Bell, 
  BarChart3, 
  FileText, 
  Settings 
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-[#111827] text-gray-300 flex flex-col h-screen fixed left-0 top-0 border-r border-gray-800 z-20 overflow-y-auto">
      
      {/* Logo & Subtitle Section */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-black font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">
          HD
        </div>
        <div className="overflow-hidden">
          <h1 className="text-white font-bold text-base truncate">Helpdesk Enterprise</h1>
          <p className="text-[11px] text-gray-400 truncate">ລະບົບຊ່ວຍເຫຼືອພະນັກງານ</p>
        </div>
      </div>

      {/* Branch Selector Header */}
      <div className="p-4 border-b border-gray-800">
        <button className="w-full bg-[#1f2937] hover:bg-gray-800 text-white px-3 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium transition border border-gray-700/50">
          <span className="truncate">ສາຂາ: ສຳນັກງານໃຫຍ່ ວຽງຈັນ</span>
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        </button>
      </div>

      {/* Menu List */}
      <div className="flex-1 p-4 space-y-6">
        
        {/* ພາບລວມ */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">ພາບລວມ</p>
          <nav className="space-y-1">
            <Link 
              to="/" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <LayoutDashboard size={18} /> <span>ໜ້າຫຼັກ</span>
            </Link>
          </nav>
        </div>

        {/* ການບໍລິການ */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">ການບໍລິການ</p>
          <nav className="space-y-1">
            <Link 
              to="/issues" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/issues') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Ticket size={18} /> <span>ປັນຫາທີ່ແຈ້ງເຂົ້າມາ</span>
              <span className="ml-auto bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">4</span>
            </Link>
            <Link 
              to="/sla-management" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/sla-management') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Clock size={18} /> <span>ການຈັດການ SLA</span>
            </Link>
            <Link 
              to="/knowledge-base" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/knowledge-base') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <BookOpen size={18} /> <span>ຖານຂໍ້ມູນຄວາມຮູ້ / FAQ</span>
            </Link>
          </nav>
        </div>

        {/* ອົງກອນ */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">ອົງກອນ</p>
          <nav className="space-y-1">
            <Link 
              to="/users" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/users') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Users size={18} /> <span>ຈັດການຜູ້ໃຊ້</span>
            </Link>
            <Link 
              to="/roles" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/roles') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Shield size={18} /> <span>ສິດ ແລະ ບົດບາດ</span>
            </Link>
            <Link 
              to="/branches" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/branches') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Building2 size={18} /> <span>ສາຂາ ແລະ ພະແນກ</span>
            </Link>
            <Link 
              to="/assets" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/assets') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Package size={18} /> <span>ຈັດການຊັບສິນ</span>
            </Link>
          </nav>
        </div>

        {/* ພື້ນທີ່ເຮັດວຽກ */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">ພື້ນທີ່ເຮັດວຽກ</p>
          <nav className="space-y-1">
            <Link 
              to="/meeting-rooms" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/meeting-rooms') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Calendar size={18} /> <span>ຈອງຫ້ອງປະຊຸມ</span>
            </Link>
            <Link 
              to="/supplies" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/supplies') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Briefcase size={18} /> <span>ຂໍອຸປະກອນສິ້ນເປືອງ</span>
            </Link>
          </nav>
        </div>

        {/* ລະບົບ */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">ລະບົບ</p>
          <nav className="space-y-1">
            <Link 
              to="/announcements" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/announcements') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Megaphone size={18} /> <span>ປະກາດ</span>
              <span className="ml-auto bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">2</span>
            </Link>
            <Link 
              to="/notifications" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/notifications') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Bell size={18} /> <span>ການແຈ້ງເຕືອນ</span>
              <span className="ml-auto bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">6</span>
            </Link>
            <Link 
              to="/reports" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/reports') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <BarChart3 size={18} /> <span>ບົດລາຍງານ</span>
            </Link>
            <Link 
              to="/audit-logs" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/audit-logs') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <FileText size={18} /> <span>ບັນທຶກການກວດສອບ</span>
            </Link>
            <Link 
              to="/settings" 
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive('/settings') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
              }`}
            >
              <Settings size={18} /> <span>ການຕັ້ງຄ່າ</span>
            </Link>
          </nav>
        </div>

      </div>
    </aside>
  );
}