import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, HelpCircle, Plus, Menu, Ticket, BookOpen, UserRound, Loader2,
  ChevronDown, Tag, Clock, Users, Shield, Building2, Layers, Package, Laptop,
  Calendar, Briefcase, Megaphone,
} from 'lucide-react';
import { canView, hasPermission } from '../utils/permissions';
import api from '../services/api';

function unwrap(payload) {
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

function toArray(payload) {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.tickets)) return data.tickets;
  return [];
}

// ກວດ module ດຽວ ຫຼື array (any-of) ກ່ອນຄົ້ນຫາ — ໃຫ້ສອດຄ່ອງກັບ Sidebar ແລະ Route guard
function canViewAny(moduleOrArray) {
  if (!moduleOrArray) return true;
  const mods = Array.isArray(moduleOrArray) ? moduleOrArray : [moduleOrArray];
  return mods.some((m) => canView(m));
}

// ລາຍການທັງໝົດທີ່ສາມາດສ້າງໄດ້ — ກັ່ນຕາມສິດ create ຂອງແຕ່ລະ module
const CREATE_OPTIONS = [
  {
    section: 'ການບໍລິການ',
    items: [
      { label: 'ສ້າງປີ້ (Ticket)', icon: Ticket, module: 'tickets', to: '/issues?create=1' },
      { label: 'ສ້າງປະເພດບັນຫາ', icon: Tag, module: 'ticket-types', to: '/ticket-types?create=1' },
      { label: 'ສ້າງນະໂຍບາຍ SLA', icon: Clock, module: 'sla', to: '/sla-management?create=1' },
      { label: 'ສ້າງບົດຄວາມ (KB/FAQ)', icon: BookOpen, module: 'kb', to: '/knowledge-base?create=1' },
    ],
  },
  {
    section: 'ອົງກອນ',
    items: [
      { label: 'ສ້າງຜູ້ໃຊ້', icon: Users, module: 'users', to: '/users?create=1' },
      { label: 'ສ້າງບົດບາດ/ສິດ', icon: Shield, module: 'roles', to: '/roles?create=1' },
      { label: 'ສ້າງສາຂາ', icon: Building2, module: 'branches', to: '/branches?create=branch' },
      { label: 'ສ້າງພະແນກ', icon: Layers, module: 'departments', to: '/branches?create=department' },
      { label: 'ເພີ່ມລາຍການຊັບສິນ', icon: Package, module: 'supplies', to: '/assets?create=1' },
      { label: 'ສ້າງທະບຽນຊັບສິນ', icon: Laptop, module: 'assets', to: '/asset-registry?create=1' },
    ],
  },
  {
    section: 'ພື້ນທີ່ເຮັດວຽກ',
    items: [
      { label: 'ຈອງຫ້ອງປະຊຸມ', icon: Calendar, module: 'rooms', to: '/meeting-rooms?create=1' },
      { label: 'ຂໍອຸປະກອນສິ້ນເປືອງ', icon: Briefcase, module: 'supplies', to: '/supplies?create=1' },
    ],
  },
  {
    section: 'ລະບົບ',
    items: [
      { label: 'ສ້າງປະກາດ', icon: Megaphone, module: 'announcements', to: '/announcements?create=1' },
    ],
  },
];

// ຄົ້ນຫາທົ່ວລະບົບ — ແຕ່ລະແຫຼ່ງຂໍ້ມູນຈະຖືກຄົ້ນຫາກໍ່ຕໍ່ເມື່ອມີສິດ read ຂອງ module ນັ້ນ (canView), ກົງກັບ Sidebar/Route guard
const SEARCH_SOURCES = [
  {
    key: 'tickets',
    module: 'tickets',
    label: 'ປີ້',
    icon: Ticket,
    iconClass: 'bg-blue-50 text-blue-600',
    endpoint: '/tickets',
    match: (t, ql) =>
      (t.title && t.title.toLowerCase().includes(ql)) ||
      (t.ticketNumber && String(t.ticketNumber).toLowerCase().includes(ql)),
    text: (t) => t.title,
    sub: (t) => t.ticketNumber || t.status,
    to: (t) => `/issues/${t._id || t.id}`,
  },
  {
    key: 'articles',
    module: 'kb',
    label: 'ບົດຄວາມ',
    icon: BookOpen,
    iconClass: 'bg-emerald-50 text-emerald-600',
    endpoint: '/kb-articles/search',
    backendSearch: true,
    text: (a) => a.title,
    sub: (a) => a.category || 'FAQ',
    to: () => '/knowledge-base',
  },
  {
    key: 'users',
    module: 'users',
    label: 'ຜູ້ໃຊ້',
    icon: UserRound,
    iconClass: 'bg-purple-50 text-purple-600',
    endpoint: '/users',
    match: (u, ql) => {
      const n = [u.firstName, u.lastName].filter(Boolean).join(' ');
      return (n && n.toLowerCase().includes(ql)) || (u.email && String(u.email).toLowerCase().includes(ql));
    },
    text: (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    sub: (u) => u.email,
    to: (u) => `/users/${u._id || u.id}`,
  },
  {
    key: 'branches',
    module: 'branches',
    label: 'ສາຂາ',
    icon: Building2,
    iconClass: 'bg-amber-50 text-amber-600',
    endpoint: '/branches',
    match: (b, ql) => b.name && b.name.toLowerCase().includes(ql),
    text: (b) => b.name,
    sub: () => 'ສາຂາ',
    to: () => '/branches',
  },
  {
    key: 'departments',
    module: 'departments',
    label: 'ພະແນກ',
    icon: Layers,
    iconClass: 'bg-sky-50 text-sky-600',
    endpoint: '/departments',
    match: (d, ql) => d.name && d.name.toLowerCase().includes(ql),
    text: (d) => d.name,
    sub: () => 'ພະແນກ',
    to: () => '/branches',
  },
  {
    key: 'ticketTypes',
    module: 'ticket-types',
    label: 'ປະເພດບັນຫາ',
    icon: Tag,
    iconClass: 'bg-rose-50 text-rose-600',
    endpoint: '/ticket-types',
    match: (t, ql) => t.name && t.name.toLowerCase().includes(ql),
    text: (t) => t.name,
    sub: (t) => (t.isActive ? 'ໃຊ້ງານຢູ່' : 'ປິດໃຊ້ງານ'),
    to: () => '/ticket-types',
  },
  {
    key: 'slaPolicies',
    module: 'sla',
    label: 'SLA',
    icon: Clock,
    iconClass: 'bg-teal-50 text-teal-600',
    endpoint: '/sla-policies',
    match: (s, ql) => s.name && s.name.toLowerCase().includes(ql),
    text: (s) => s.name,
    sub: (s) => `${s.responseTimeMinutes || 0}m ຕອບ · ${s.resolutionTimeMinutes || 0}m ແກ້`,
    to: () => '/sla-management',
  },
  {
    key: 'announcements',
    module: 'announcements',
    label: 'ປະກາດ',
    icon: Megaphone,
    iconClass: 'bg-red-50 text-red-600',
    endpoint: '/announcements',
    match: (a, ql) => a.title && a.title.toLowerCase().includes(ql),
    text: (a) => a.title,
    sub: (a) => a.scope || 'ປະກາດ',
    to: () => '/announcements',
  },
  {
    key: 'rooms',
    module: 'rooms',
    label: 'ຫ້ອງປະຊຸມ',
    icon: Calendar,
    iconClass: 'bg-indigo-50 text-indigo-600',
    endpoint: '/rooms',
    match: (r, ql) => r.name && r.name.toLowerCase().includes(ql),
    text: (r) => r.name,
    sub: (r) => r.location || `ຮອງຮັບ ${r.capacity || 0} ຄົນ`,
    to: () => '/meeting-rooms',
  },
  {
    key: 'supplyCatalog',
    module: 'supplies',
    label: 'ອຸປະກອນສິ້ນເປືອງ',
    icon: Package,
    iconClass: 'bg-orange-50 text-orange-600',
    endpoint: '/supply-catalog',
    match: (i, ql) =>
      (i.name && i.name.toLowerCase().includes(ql)) ||
      (i.category && i.category.toLowerCase().includes(ql)),
    text: (i) => i.name,
    sub: (i) => `${i.category} · ຄົງເຫຼືອ ${i.stockQty ?? 0} ${i.unit || ''}`,
    to: () => '/assets',
  },
  {
    key: 'assets',
    module: 'assets',
    label: 'ທະບຽນຊັບສິນ',
    icon: Laptop,
    iconClass: 'bg-cyan-50 text-cyan-600',
    endpoint: '/assets',
    match: (a, ql) =>
      (a.assetTag && String(a.assetTag).toLowerCase().includes(ql)) ||
      (a.type && a.type.toLowerCase().includes(ql)),
    text: (a) => a.assetTag,
    sub: (a) => a.type || a.status,
    to: () => '/asset-registry',
  },
  {
    key: 'roles',
    module: 'roles',
    label: 'ບົດບາດ',
    icon: Shield,
    iconClass: 'bg-slate-50 text-slate-600',
    endpoint: '/roles',
    match: (r, ql) => r.name && r.name.toLowerCase().includes(ql),
    text: (r) => r.name,
    sub: () => 'Role',
    to: () => '/roles',
  },
];

export default function Navbar({ onMenuClick }) {
  const navigate = useNavigate();

  // ຈຳນວນແຈ້ງເຕືອນທີ່ຍັງບໍ່ໄດ້ອ່ານ — ດຶງຈາກ /dashboard ຄືກັບ Sidebar
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification dropdown
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifRef = useRef(null);

  const loadNotifications = async () => {
    setNotifsLoading(true);
    try {
      const res = await api.get('/notifications/my');
      setNotifs(toArray(res.data).slice(0, 6));
    } catch {
      setNotifs([]);
    } finally {
      setNotifsLoading(false);
    }
  };

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState({});
  const searchRef = useRef(null);

  // Create-new dropdown
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function loadUnread() {
      try {
        const res = await api.get('/dashboard');
        if (cancelled) return;
        const dash = unwrap(res.data);
        setUnreadCount(dash?.notifications?.unreadCount ?? 0);
      } catch {
        // ຖ້າດຶງບໍ່ໄດ້ໃຫ້ badge ບໍ່ສະແດງ ບໍ່ຄວນລົ້ມທັງແຖບ
      }
    }

    loadUnread();
    timer = setInterval(loadUnread, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // ໂຫຼດລາຍການແຈ້ງເຕືອນລ່າສຸດຕອນເປີດ dropdown ແລະຕອນໂຫຼດແຖບໃໝ່
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
  }, []);

  // ປິດ dropdown ເມື່ອກົດບ່ອນອື່ນ
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (createRef.current && !createRef.current.contains(e.target)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ຄົ້ນຫາທົ່ວລະບົບ — ດຶງທຸກແຫຼ່ງທີ່ບັນຊີມີສິດ read (canView) ເປັນຈຸພຽງຄັ້ງດຽວ
  useEffect(() => {
    const q = searchQuery.trim();

    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setResults({});
        setSearching(false);
        return;
      }

      setSearching(true);
      const ql = q.toLowerCase();
      const res = {};
      const jobs = [];

      SEARCH_SOURCES.forEach((src) => {
        if (!canViewAny(src.module)) return;

        jobs.push(
          (src.backendSearch
            ? api.get(src.endpoint, { params: { q } })
            : api.get(src.endpoint))
            .then((r) => {
              const list = toArray(r.data);
              if (src.backendSearch) {
                res[src.key] = list.slice(0, 5);
                return;
              }
              res[src.key] = list.filter((item) => src.match(item, ql)).slice(0, 5);
            })
            .catch(() => {})
        );
      });

      await Promise.all(jobs);
      setResults(res);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const go = (path) => {
    setSearchOpen(false);
    setNotifOpen(false);
    setCreateOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  const toggleNotifications = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) loadNotifications();
  };

  const markNotifRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(notifs.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ຖ້າບໍ່ສຳເລັດໃຫ້ປະໄວ້ຢ່າງດັ່ງເກົ່າ
    }
  };

  const formatNotifTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasQuery = searchQuery.trim().length >= 2;
  const anyResults = SEARCH_SOURCES.some((src) => (results[src.key] || []).length > 0);

  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 lg:left-64 z-10 flex items-center justify-between px-4 sm:px-6">
      {/* Mobile menu + Search Bar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          aria-label="ເປີດເມນູ"
        >
          <Menu size={20} />
        </button>

        <div className="relative flex-1 sm:block max-w-md mr-2" ref={searchRef}>
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="ຄົ້ນຫາ ປີ້, ຜູ້ໃຊ້, ບົດຄວາມ..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          {searchOpen && hasQuery && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
              {searching ? (
                <div className="p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  ກຳລັງຄົ້ນຫາ...
                </div>
              ) : anyResults ? (
                <>
                  {SEARCH_SOURCES.map((src) => {
                    const items = results[src.key] || [];
                    if (items.length === 0) return null;
                    const Icon = src.icon;
                    return (
                      <div key={src.key} className="p-2 border-t border-gray-100 first:border-t-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-1 pb-1.5">
                          {src.label}
                        </p>
                        {items.map((item, idx) => (
                          <button
                            key={item._id || item.id || `${src.key}-${idx}`}
                            onClick={() => go(src.to(item))}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-amber-50 text-left transition"
                          >
                            <span className={`p-1.5 rounded-lg shrink-0 ${src.iconClass}`}><Icon size={16} /></span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-gray-800 truncate">{src.text(item)}</span>
                              <span className="block text-xs text-gray-400 truncate">{src.sub(item)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="p-4 text-center text-sm text-gray-400">
                  ບໍ່ພົບລາຍການທີ່ກົງກັບ "{searchQuery.trim()}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-4">
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition"
            title="ການແຈ້ງເຕືອນ"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-800 text-sm">ການແຈ້ງເຕືອນ</p>
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-500">ມີ {unreadCount} ລາຍການຍັງບໍ່ໄດ້ອ່ານ</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifsLoading ? (
                  <div className="py-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    ກຳລັງໂຫຼດ...
                  </div>
                ) : notifs.length > 0 ? (
                  notifs.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => !item.isRead && markNotifRead(item._id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${
                        !item.isRead ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`p-2 rounded-xl shrink-0 ${!item.isRead ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Bell size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm truncate ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {item.title}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">{item.body || item.message}</span>
                        <span className="block text-[11px] text-gray-400 mt-1">{formatNotifTime(item.createdAt)}</span>
                      </span>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0 mt-1.5"></span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400">
                    ບໍ່ມີການແຈ້ງເຕືອນ
                  </div>
                )}
              </div>

              <button
                onClick={() => go('/notifications')}
                className="w-full py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 border-t border-gray-100 transition"
              >
                ເບິ່ງທັງໝົດ
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/knowledge-base')}
          className="hidden sm:block p-2 text-gray-600 hover:bg-gray-100 rounded-full transition"
          title="ຄູ່ມື / ຖາມ-ຕອບ"
        >
          <HelpCircle size={20} />
        </button>
        <div className="relative" ref={createRef}>
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-2 sm:px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">ສ້າງໃໝ່</span>
            <ChevronDown size={14} className={`hidden sm:block transition-transform ${createOpen ? 'rotate-180' : ''}`} />
          </button>

          {createOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-40 max-h-[70vh] overflow-y-auto">
              {CREATE_OPTIONS.map((group) => {
                const items = group.items.filter((item) => hasPermission(item.module, 'create'));
                if (items.length === 0) return null;
                return (
                  <div key={group.section} className="p-2">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-1 pb-1.5">
                      {group.section}
                    </p>
                    {items.map(({ label, icon: Icon, to }) => (
                      <button
                        key={to}
                        onClick={() => go(to)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-amber-50 text-left transition"
                      >
                        <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0"><Icon size={16} /></span>
                        <span className="text-sm font-medium text-gray-700 truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
              {CREATE_OPTIONS.every((g) => g.items.filter((i) => hasPermission(i.module, 'create')).length === 0) && (
                <div className="p-4 text-center text-sm text-gray-400">
                  ບໍ່ມີສິດສ້າງລາຍການໃດໆ
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}