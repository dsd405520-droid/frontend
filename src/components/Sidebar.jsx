import React, { useState, useEffect } from 'react';
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
  Settings,
  Tag
} from 'lucide-react';

import { canView } from '../utils/permissions';

function canViewAny(moduleOrArray) {
  if (!moduleOrArray) return true;
  const mods = Array.isArray(moduleOrArray) ? moduleOrArray : [moduleOrArray];
  return mods.some((m) => canView(m));
}

// ແຕ່ລະລາຍການ menu ຜູກກັບ module key (ຕົງກັບ AVAILABLE_MODULES ໃນ RolesManagement.jsx)
// ຖ້າ module ເປັນ null = ບໍ່ຮຽກຮ້ອງ permission ພິເສດ (ທຸກຄົນທີ່ login ແລ້ວເຫັນໄດ້)
const MENU_SECTIONS = [
  {
    heading: 'ພາບລວມ',
    items: [
      { to: '/', label: 'ໜ້າຫຼັກ', icon: LayoutDashboard, module: null },
    ],
  },
  {
    heading: 'ການບໍລິການ',
    items: [
      { to: '/issues', label: 'ປັນຫາທີ່ແຈ້ງເຂົ້າມາ', icon: Ticket, module: 'tickets', badge: '4' },
      { to: '/sla-management', label: 'ການຈັດການ SLA', icon: Clock, module: 'sla' },
      { to: '/ticket-types', label: 'ປະເພດບັນຫາ', icon: Tag, module: 'ticket-types' },
      { to: '/knowledge-base', label: 'ຖານຂໍ້ມູນຄວາມຮູ້ / FAQ', icon: BookOpen, module: 'kb' },
    ],
  },
  {
    heading: 'ອົງກອນ',
    items: [
      { to: '/users', label: 'ຈັດການຜູ້ໃຊ້', icon: Users, module: 'users' },
      { to: '/roles', label: 'ສິດ ແລະ ບົດບາດ', icon: Shield, module: 'roles' },
      { to: '/branches', label: 'ສາຂາ ແລະ ພະແນກ', icon: Building2, module: ['branches', 'departments'] },
      { to: '/assets', label: 'ຈັດການຊັບສິນ', icon: Package, module: 'supplies' },
    ],
  },
  {
    heading: 'ພື້ນທີ່ເຮັດວຽກ',
    items: [
      { to: '/meeting-rooms', label: 'ຈອງຫ້ອງປະຊຸມ', icon: Calendar, module: 'rooms' },
      { to: '/supplies', label: 'ຂໍອຸປະກອນສິ້ນເປືອງ', icon: Briefcase, module: 'supplies' },
    ],
  },
  {
    heading: 'ລະບົບ',
    items: [
      { to: '/announcements', label: 'ປະກາດ', icon: Megaphone, module: 'announcements', badgeKey: 'announcements', badgeColor: 'bg-red-600 text-white' },
      { to: '/notifications', label: 'ການແຈ້ງເຕືອນ', icon: Bell, module: null, badgeKey: 'notifications', badgeColor: 'bg-red-600 text-white' },
      { to: '/reports', label: 'ບົດລາຍງານ', icon: BarChart3, module: 'reports' },
      { to: '/audit-logs', label: 'ບັນທຶກການກວດສອບ', icon: FileText, module: 'audit-logs' },
      { to: '/settings', label: 'ການຕັ້ງຄ່າ', icon: Settings, module: null },
    ],
  },
];


export default function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadCounts = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    fetch('http://localhost:3000/api/notifications/unread-count', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(body => {
        if (body) setUnreadNotifications(body.data ?? body ?? 0);
      })
      .catch(err => console.error('Error fetching notification count:', err));

    fetch('http://localhost:3000/api/announcements/active', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(body => {
        if (!body) return;
        const list = Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : []);
        setUnreadAnnouncements(list.filter(a => !a.isRead).length);
      })
      .catch(err => console.error('Error fetching announcement count:', err));
  };

  useEffect(() => {
    fetchUnreadCounts();
  }, [location.pathname]);

  useEffect(() => {
    window.addEventListener('unread-counts-changed', fetchUnreadCounts);
    return () => window.removeEventListener('unread-counts-changed', fetchUnreadCounts);
  }, []);

  const badgeCounts = {
    announcements: unreadAnnouncements,
    notifications: unreadNotifications,
  };

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
        {MENU_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canViewAny(item.module));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.heading}>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">{section.heading}</p>
              <nav className="space-y-1">
                {visibleItems.map(({ to, label, icon: Icon, badge, badgeKey, badgeColor }) => {
                  const liveCount = badgeKey ? badgeCounts[badgeKey] : null;
                  const displayBadge = badgeKey
                    ? (liveCount > 0 ? (liveCount > 9 ? '9+' : liveCount) : null)
                    : badge;

                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive(to) ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
                        }`}
                    >
                      <Icon size={18} /> <span>{label}</span>
                      {displayBadge && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${badgeColor || 'bg-amber-500 text-black'}`}>{displayBadge}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
    </aside>
  );
}