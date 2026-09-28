import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  Check,
  LayoutDashboard,
  Ticket,
  Clock,
  BookOpen,
  Users,
  Shield,
  Building2,
  Package,
  Laptop,
  Calendar,
  Activity,
  Briefcase,
  Megaphone,
  Bell,
  BarChart3,
  FileText,
  Settings,
  Tag,
  X
} from 'lucide-react';
import { LogOut } from 'lucide-react';
import { canView, logout, getCurrentUser } from '../utils/permissions';
import api from '../services/api';
import { getOrgSettings, applySystemName, DEFAULT_SYSTEM_NAME } from '../utils/orgSettings';
import { useBranch } from '../contexts/BranchContext';

// ກວດ module ດຽວ ຫຼື array (any-of) — ໃຊ້ກັບ /branches ທີ່ອີງໃສ່ທັງ 'branches' ແລະ 'departments'
function canViewAny(moduleOrArray) {
  if (!moduleOrArray) return true;
  const mods = Array.isArray(moduleOrArray) ? moduleOrArray : [moduleOrArray];
  return mods.some((m) => canView(m));
}

// Backend ຫໍ່ທຸກ response ດ້ວຍ interceptor: { response, msg, data: <ຕົວຈິງ>, time }
// ຕ້ອງແກະຊັ້ນ .data ອອກກ່ອນ ບໍ່ດັ່ງນັ້ນຄ່າທີ່ອ່ານໄດ້ຈະເປັນ undefined ຕະຫຼອດ (badge ຈຶ່ງບໍ່ເຄີຍຂຶ້ນ)
function unwrap(payload) {
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

// ສະຖານະ ticket ທີ່ຍັງຖືວ່າ "ຄ້າງ/ຕ້ອງເຮັດ" (ບໍ່ນັບ RESOLVED/CLOSED) — ຕົງກັບ TicketStatus enum ຝັ່ງ backend
const ACTIVE_TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_USER'];

function countActiveTickets(byStatus) {
  if (!byStatus) return 0;
  return ACTIVE_TICKET_STATUSES.reduce((sum, status) => sum + (byStatus[status] || 0), 0);
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
      { to: '/issues', label: 'ປັນຫາທີ່ແຈ້ງເຂົ້າມາ', icon: Ticket, module: 'tickets', badgeKey: 'tickets' },
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
      { to: '/asset-registry', label: 'ທະບຽນຊັບສິນບໍລິສັດ', icon: Laptop, module: 'assets' },
    ],
  },
  {
    heading: 'ພື້ນທີ່ເຮັດວຽກ',
    items: [
      { to: '/meeting-rooms', label: 'ຈອງຫ້ອງປະຊຸມ', icon: Calendar, module: 'rooms' },
      { to: '/room-status', label: 'ສະຖານະຫ້ອງປະຊຸມຕົວຈິງ', icon: Activity, module: 'rooms' },
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

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const user = getCurrentUser();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [systemName, setSystemName] = useState(DEFAULT_SYSTEM_NAME);

  // ຈຳນວນແຈ້ງເຕືອນຕົວຈິງ ດຶງມາຈາກ API ແທນທີ່ຈະ hardcode — ໂຫຼດຕອນເປີດ ແລະ refresh ທຸກໆ 60 ວິນາທີ
  const [badgeCounts, setBadgeCounts] = useState({ tickets: 0, announcements: 0, notifications: 0 });

  // ຕົວເລືອກສາຂາທົ່ວລະບົບ (Branch Selector) — ອ່ານ/ຂຽນຈາກ BranchContext
  const { branches, loading: loadingBranches, selectedBranchId, selectedBranch, changeBranch } = useBranch();
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        // /dashboard ໃຫ້ທັງ ticket ທີ່ຄ້າງ (ຕາມສິດ: assignedToMe ຖ້າມີ, ບໍ່ດັ່ງນັ້ນໃຊ້ myTickets) ແລະ notifications.unreadCount ໃນຄັ້ງດຽວ
        // — ຖ້າເລືອກສາຂາໄວ້ ໃຫ້ສົ່ງ branchId ໄປພ້ອມ ເພື່ອໃຫ້ຕົວເລກກົງກັບສາຂາທີ່ເລືອກ
        const dashUrl = selectedBranchId
          ? `/dashboard?branchId=${encodeURIComponent(selectedBranchId)}`
          : '/dashboard';
        const [dashboardRes, announcementsRes] = await Promise.all([
          api.get(dashUrl),
          api.get('/announcements/active'),
        ]);

        if (cancelled) return;

        const dash = unwrap(dashboardRes.data);
        const ticketSource = dash?.assignedToMe ?? dash?.myTickets;
        const ticketsCount = countActiveTickets(ticketSource?.byStatus);
        const notificationsCount = dash?.notifications?.unreadCount ?? 0;

        const announcementsList = unwrap(announcementsRes.data);
        const announcementsCount = Array.isArray(announcementsList)
          ? announcementsList.filter((a) => !a.isRead).length
          : 0;

        setBadgeCounts({ tickets: ticketsCount, announcements: announcementsCount, notifications: notificationsCount });
      } catch {
        // ຖ້າ endpoint ໃດ fail (ເຊັ່ນ role ນີ້ບໍ່ມີສິດ) ໃຫ້ badge ບໍ່ສະແດງ ແທນທີ່ຈະລົ້ມທັງໜ້າ
      }
    }

    loadCounts();
    const interval = setInterval(loadCounts, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedBranchId]);

  // ດຶງຊື່ລະບົບຈາກການຕັ້ງຄ່າອົງກອນ ເພື່ອສະແດງໃນ header ຂ້າງຊ້າຍ + ແຖບຊື່ພາຍ (browser tab)
  useEffect(() => {
    let cancelled = false;
    getOrgSettings().then((settings) => {
      if (cancelled) return;
      setSystemName(settings.systemName);
      applySystemName(settings.systemName);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {/* Backdrop — ສະແດງເທິງ mobile ເທົ່ານັ້ນ ເມື່ອ drawer ເປີດ */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`w-64 bg-[#111827] text-gray-300 flex flex-col h-screen fixed left-0 top-0 border-r border-gray-800 z-30 overflow-y-auto transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Logo & Subtitle Section */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-black font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">
            HD
          </div>
          <div className="overflow-hidden flex-1">
            <h1 translate="no" className="text-white font-bold text-base truncate">{systemName}</h1>
            <p translate="no" className="text-[11px] text-gray-400 truncate">ລະບົບຊ່ວຍເຫຼືອພະນັກງານ</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
            aria-label="ປິດເມນູ"
          >
            <X size={20} />
          </button>
        </div>

      {/* Branch Selector Header — ເລືອກສາຂາທົ່ວລະບົບ (ກັ່ນຕອງຂໍ້ມູນໃນທຸກໜ້າ) */}
      <div className="p-4 border-b border-gray-800 relative" ref={branchMenuRef}>
        <button
          onClick={() => setBranchMenuOpen((v) => !v)}
          className="w-full bg-[#1f2937] hover:bg-gray-800 text-white px-3 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium transition border border-gray-700/50"
        >
          <span className="truncate">
            {selectedBranch ? `ສາຂາ: ${selectedBranch.name}` : 'ສາຂາ: ທຸກສາຂາ'}
          </span>
          <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${branchMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {branchMenuOpen && (
          <div className="absolute left-4 right-4 top-full z-40 mt-2 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            <button
              onClick={() => { changeBranch(''); setBranchMenuOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition ${!selectedBranchId ? 'text-amber-400' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <span className="truncate">ທຸກສາຂາ</span>
              {!selectedBranchId && <Check size={16} className="shrink-0" />}
            </button>
            {loadingBranches ? (
              <div className="px-3 py-2.5 text-sm text-gray-500">ກຳລັງໂຫຼດ...</div>
            ) : (
              branches.map((b) => (
                <button
                  key={b._id}
                  onClick={() => { changeBranch(b._id); setBranchMenuOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition ${selectedBranchId === b._id ? 'text-amber-400' : 'text-gray-300 hover:bg-gray-800'}`}
                >
                  <span className="truncate">{b.name}</span>
                  {selectedBranchId === b._id && <Check size={16} className="shrink-0" />}
                </button>
              ))
            )}
            {!loadingBranches && branches.length === 0 && (
              <div className="px-3 py-2.5 text-sm text-gray-500">ຍັງບໍ່ມີສາຂາ</div>
            )}
          </div>
        )}
      </div>

      {/* Menu List — ຄັດຕອງແຕ່ລະລາຍການດ້ວຍ canView(module) ກ່ອນສະແດງ */}
      <div className="flex-1 p-4 space-y-6">
        {MENU_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canViewAny(item.module));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.heading}>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">{section.heading}</p>
              <nav className="space-y-1">
                {visibleItems.map(({ to, label, icon: Icon, badgeKey, badgeColor }) => {
                  const count = badgeKey ? badgeCounts[badgeKey] : 0;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive(to) ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'hover:bg-gray-800/60 text-gray-300'
                        }`}
                    >
                      <Icon size={18} /> <span>{label}</span>
                      {count > 0 && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${badgeColor || 'bg-amber-500 text-black'}`}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* User info + Logout */}
      <div className="p-4 border-t border-gray-800">
        {user && (
          <div className="mb-2 px-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            <p className="text-[11px] text-gray-400 truncate">{user.role}</p>
          </div>
        )}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition"
        >
          <LogOut size={18} />
          <span>ອອກຈາກລະບົບ</span>
        </button>
      </div>

      {/* Portal ໄປທີ່ document.body — aside ມີ transform (drawer) ເຮັດໃຫ້ `fixed` ອ້າງອີງ aside ແທນໜ້າຈໍ */}
      {showLogoutConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
              <LogOut size={22} />
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">ອອກຈາກລະບົບ</h3>
            <p className="text-sm text-gray-500 mb-6">ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ?</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={logout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                ອອກຈາກລະບົບ
              </button>
            </div>
          </div>
        </div>
        , document.body)}
    </aside>
    </>
  );
}
