import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, Lock, Globe, UserPlus, Trash2, FileDown, FileSpreadsheet, Printer, CheckCircle2, XCircle, Loader2, Search, Users, X, Clock, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getSocket } from '../utils/socket';

// ແຜງ "ເຊີນຄົນເຂົ້າຫ້ອງ" ໃນ popup ລາຍລະອຽດການຈອງ
//  - PRIVATE: ເພີ່ມຄົນເທື່ອລະຄົນ, ແຕ່ລະຄົນມີ QR ສ່ວນຕົວ; ຄົນທີ່ບໍ່ຢູ່ໃນລາຍຊື່ຖືກປະຕິເສດ
//  - PUBLIC: QR ດຽວ ໃຜສະແກນກໍເຂົ້າໄດ້
//  - ລາຍງານຜູ້ເຂົ້າ/ບໍ່ເຂົ້າ ດາວໂຫຼດເປັນ CSV ຫຼື PDF
const REASON_LO = {
  INVALID_QR: 'QR ບໍ່ຖືກຕ້ອງ',
  BOOKING_NOT_ACTIVE: 'ການຈອງບໍ່ເປີດໃຊ້',
  INVITES_CLOSED: 'ປິດການເຊີນ',
  TOO_EARLY: 'ມາກ່ອນເວລາ',
  ENDED: 'ກອງປະຊຸມສິ້ນສຸດ',
  NOT_ON_LIST: 'ບໍ່ຢູ່ໃນລາຍຊື່',
  REVOKED: 'ຖືກລຶບອອກຈາກລາຍຊື່',
  ROOM_FULL: 'ຫ້ອງເຕັມ',
  ACCOUNT_MISMATCH: 'ໃຊ້ບັນຊີອື່ນ',
  ACCOUNT_INACTIVE: 'ບັນຊີຖືກປິດ',
};

const parseError = async (res) => {
  const j = await res.json().catch(() => ({}));
  const m = j.msg ?? j.message;
  return Array.isArray(m) ? m.join(', ') : m || 'ດຳເນີນການບໍ່ສຳເລັດ';
};

export default function BookingInvitePanel({ booking, past = false }) {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const base = `${API_BASE_URL}/room-bookings/${booking._id}`;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [tab, setTab] = useState('account');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  // ຕົວກອງ ສາຂາ / ພະແນກ / ສິດ + ລາຍຊື່ທີ່ຕິກເລືອກ (ຈື່ໄວ້ຂ້າມການປ່ຽນຕົວກອງ ເພື່ອລວມຫຼາຍກຸ່ມໄດ້)
  const [filters, setFilters] = useState({ branchId: '', departmentId: '', role: '' });
  const [filterOptions, setFilterOptions] = useState({ branches: [], departments: [], roles: [] });
  const [selected, setSelected] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [selectedInvitees, setSelectedInvitees] = useState(() => new Set()); // ຄົນທີ່ຕິກເລືອກໃນລາຍຊື່ຜູ້ຖືກເຊີນ (ລຶບ/ພິມ QR ຫຼາຍຄົນ)
  // ຄົ້ນຫາ/ກອງໃນລາຍຊື່ຜູ້ຖືກເຊີນ (ກອງຝັ່ງ client ຈາກລາຍຊື່ທີ່ໂຫຼດມາແລ້ວ): ປະເພດ (ບັນຊີ/ແຂກ) + ສາຂາ/ພະແນກ/ສິດ
  const [inviteeQ, setInviteeQ] = useState('');
  const [inviteeFilters, setInviteeFilters] = useState({ type: '', arrival: '', branchId: '', departmentId: '', role: '' });
  const [live, setLive] = useState(false); // socket ເຊື່ອມຕໍ່ຢູ່ ⇒ ເຫັນຄົນເຂົ້າແບບທັນທີ
  const [flashIds, setFlashIds] = useState(() => new Set()); // ຄົນທີ່ຫາກໍມາຮອດ (ເນັ້ນສີສອງສາມວິນາທີ)
  const prevJoinedRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false); // popup "ເພີ່ມຄົນ" (ຄົ້ນຫາ + ຕົວກອງ) — ເປີດຕອນກົດປຸ່ມເທົ່ານັ້ນ ເພື່ອບໍ່ໃຫ້ແຜງຮົກ

  const inviteMode = data?.inviteMode || null;

  // ໂຫຼດຕົວເລືອກຕົວກອງ ຄັ້ງດຽວ ເມື່ອເປີດແຖບ "ບັນຊີໃນລະບົບ" ຂອງໂໝດສ່ວນຕົວ
  useEffect(() => {
    if (!addOpen || tab !== 'account' || inviteMode !== 'PRIVATE') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/invite/account-filters`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(await parseError(res));
        const json = await res.json();
        if (!cancelled) setFilterOptions(json.data || { branches: [], departments: [], roles: [] });
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [addOpen, tab, inviteMode, base, token]);

  useEffect(() => {
    const term = q.trim();
    const hasFilter = !!(filters.branchId || filters.departmentId || filters.role);
    if (!addOpen || tab !== 'account' || (term.length < 2 && !hasFilter)) {
      setResults([]);
      setTotal(0);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (term.length >= 2) params.set('q', term);
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.departmentId) params.set('departmentId', filters.departmentId);
        if (filters.role) params.set('role', filters.role);
        const res = await fetch(`${base}/invite/accounts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await parseError(res));
        const json = await res.json();
        setResults(json.data?.items || []);
        setTotal(json.data?.total || 0);
      } catch (e) {
        setError(e.message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, addOpen, tab, base, token, filters.branchId, filters.departmentId, filters.role, refreshKey]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}/invite`, { headers: authHeaders });
      if (!res.ok) throw new Error(await parseError(res));
      const json = await res.json();
      setData(json.data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking._id]);

  useEffect(() => {
    load();
    // ດຶງໃໝ່ທຸກ 10 ວິ ເພື່ອໃຫ້ເຫັນຄົນທີ່ກຳລັງສະແກນເຂົ້າມາແບບເກືອບ real-time
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  // Real-time: backend ສົ່ງ 'room-bookings:changed' (ມີ bookingId) ທຸກຄັ້ງທີ່ມີຄົນສະແກນເຂົ້າ/ຖືກປະຕິເສດ → ດຶງລາຍຊື່ໃໝ່ທັນທີ
  // (polling ທຸກ 10 ວິ ຍັງຢູ່ເປັນ fallback ຖ້າ socket ຫຼຸດ)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const roomId = String(booking.roomId?._id || booking.roomId || '');
    let timer = null;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
    const onChanged = (evt) => {
      if (evt?.bookingId && String(evt.bookingId) !== String(booking._id)) return;
      if (!evt?.bookingId && evt?.roomId && roomId && String(evt.roomId) !== roomId) return;
      refresh();
    };
    const onConnect = () => { setLive(true); refresh(); };
    const onDisconnect = () => setLive(false);
    setLive(!!socket.connected);
    socket.on('room-bookings:changed', onChanged);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      clearTimeout(timer);
      socket.off('room-bookings:changed', onChanged);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [load, booking._id, booking.roomId]);

  // ເນັ້ນແຖວຂອງຄົນທີ່ຫາກໍມາຮອດ (ປຽບທຽບກັບການໂຫຼດຄັ້ງກ່ອນ; ຄັ້ງທຳອິດບໍ່ເນັ້ນ)
  useEffect(() => {
    if (!data?.invitees) return;
    const nowJoined = new Set(data.invitees.filter((i) => i.joinedAt).map((i) => i._id));
    if (prevJoinedRef.current) {
      const fresh = [...nowJoined].filter((id) => !prevJoinedRef.current.has(id));
      if (fresh.length > 0) {
        setFlashIds((prev) => new Set([...prev, ...fresh]));
        setTimeout(() => setFlashIds((prev) => {
          const next = new Set(prev);
          fresh.forEach((id) => next.delete(id));
          return next;
        }), 5000);
      }
    }
    prevJoinedRef.current = nowJoined;
  }, [data]);

  const act = async (key, url, options = {}, expectBlob) => {
    setBusy(key);
    setError('');
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      });
      if (!res.ok) throw new Error(await parseError(res));
      if (expectBlob) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = expectBlob;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      } else {
        await load();
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const setMode = (mode) => act('mode', `${base}/invite`, { method: 'PATCH', body: JSON.stringify({ mode }) });

  const addInvitee = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim() };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    const ok = await act('add', `${base}/invitees`, { method: 'POST', body: JSON.stringify(payload) });
    if (ok) {
      setNotice(`ເພີ່ມ "${payload.name}" ແລ້ວ`);
      setForm({ name: '', email: '', phone: '' });
    }
  };

  const selectable = results.filter((u) => !u.alreadyInvited);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.userId));

  const toggleOne = (userId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  // ເລືອກ/ຍົກເລີກທຸກຄົນທີ່ກຳລັງສະແດງ (ຫຼັງກອງ) — ຂ້າມຄົນທີ່ຢູ່ໃນລາຍຊື່ແລ້ວ
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((u) => next.delete(u.userId));
      else selectable.forEach((u) => next.add(u.userId));
      return next;
    });

  const setBranchFilter = (branchId) =>
    setFilters((f) => {
      const stillValid = !f.departmentId || !branchId || filterOptions.departments.some((d) => d.id === f.departmentId && d.branchId === branchId);
      return { ...f, branchId, departmentId: stillValid ? f.departmentId : '' };
    });

  const clearFilters = () => {
    setFilters({ branchId: '', departmentId: '', role: '' });
    setQ('');
  };

  const openAdd = () => {
    setNotice('');
    setError('');
    setAddOpen(true);
  };

  // ປິດ popup — ລ້າງລາຍຊື່ທີ່ຕິກຄ້າງ ແລະ ຕົວກອງ ເພື່ອເປີດຄັ້ງຕໍ່ໄປສະອາດ
  const closeAdd = () => {
    setAddOpen(false);
    setSelected(new Set());
    setFilters({ branchId: '', departmentId: '', role: '' });
    setQ('');
  };

  // Esc ປິດສະເພາະ popup ນີ້ (capture + stopPropagation ເພື່ອບໍ່ໃຫ້ popup ແມ່ທີ່ຄອບຢູ່ປິດຕາມ)
  useEffect(() => {
    if (!addOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeAdd();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen]);

  const inviteSelected = async () => {
    const userIds = [...selected];
    if (userIds.length === 0) return;
    setBusy('bulk');
    setError('');
    setNotice('');
    try {
      const res = await fetch(`${base}/invitees/bulk`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const r = (await res.json()).data || {};
      const parts = [`ເພີ່ມແລ້ວ ${r.added ?? 0} ຄົນ`];
      if (r.alreadyOnList) parts.push(`ຢູ່ໃນລາຍຊື່ແລ້ວ ${r.alreadyOnList}`);
      if (r.overLimit) parts.push(`ເກີນຈຳນວນສູງສຸດ ${r.limit} ຄົນ: ${r.overLimit}`);
      if (r.unavailable) parts.push(`ເພີ່ມບໍ່ໄດ້ ${r.unavailable}`);
      setNotice(parts.join(' • '));
      closeAdd();
      setRefreshKey((k) => k + 1);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const removeInvitee = (i) => {
    if (!window.confirm(`ລຶບ "${i.name}" ອອກຈາກລາຍຊື່? QR ຂອງຄົນນີ້ຈະໃຊ້ບໍ່ໄດ້ອີກ`)) return;
    act(`rm-${i._id}`, `${base}/invitees/${i._id}`, { method: 'DELETE' });
  };

  // ---- ເລືອກຫຼາຍຄົນໃນລາຍຊື່ຜູ້ຖືກເຊີນ ----
  const invitees = data?.invitees || [];
  const accountCount = invitees.filter((i) => i.isAccount).length;
  const guestCount = invitees.length - accountCount;
  const arrivedCount = invitees.filter((i) => i.joinedAt).length;
  const pendingCount = invitees.length - arrivedCount;
  // ຄວາມຈຸຫ້ອງ: ເຕືອນເມື່ອເຊີນເກີນ ແຕ່ "ບໍ່ຫ້າມ" (ເພີ່ມເກົ້າອີ້ພາຍຫຼັງໄດ້)
  const capacity = Number(data?.capacity) > 0 ? Number(data.capacity) : null;
  const invitedCount = invitees.length;
  const overBy = capacity ? Math.max(0, invitedCount - capacity) : 0;
  const pendingAdd = tab === 'account' ? selected.size : (form.name.trim() ? 1 : 0); // ຈຳນວນທີ່ກຳລັງຈະເພີ່ມໃນ popup
  const projectedCount = invitedCount + pendingAdd;
  const projectedOverBy = capacity ? Math.max(0, projectedCount - capacity) : 0;
  const arrivedPct = invitees.length ? Math.round((arrivedCount / invitees.length) * 100) : 0;

  const orgFilterOn = !!(inviteeFilters.branchId || inviteeFilters.departmentId || inviteeFilters.role);
  const inviteeFilterOn = !!(inviteeQ.trim() || inviteeFilters.type || inviteeFilters.arrival || orgFilterOn);
  const term = inviteeQ.trim().toLowerCase();
  // ຕົວກອງສາຂາ/ພະແນກ/ສິດ ໃຊ້ໄດ້ສະເພາະບັນຊີໃນລະບົບ (ແຂກພາຍນອກບໍ່ມີຂໍ້ມູນນີ້) — ຖ້າເລືອກຕົວກອງເຫຼົ່ານີ້ ແຂກຈະຖືກຊ່ອນ
  const filteredInvitees = invitees.filter((i) => {
    if (inviteeFilters.type === 'account' && !i.isAccount) return false;
    if (inviteeFilters.type === 'guest' && i.isAccount) return false;
    if (inviteeFilters.arrival === 'arrived' && !i.joinedAt) return false;
    if (inviteeFilters.arrival === 'pending' && i.joinedAt) return false;
    if (inviteeFilters.branchId && i.branchId !== inviteeFilters.branchId) return false;
    if (inviteeFilters.departmentId && i.departmentId !== inviteeFilters.departmentId) return false;
    if (inviteeFilters.role && i.roleId !== inviteeFilters.role) return false;
    if (term && ![i.name, i.employeeCode, i.email, i.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))) return false;
    return true;
  });

  // ຕົວເລືອກຂອງ dropdown — ເອົາສະເພາະທີ່ມີຢູ່ໃນລາຍຊື່ຜູ້ຖືກເຊີນຈິງ
  const optionsFrom = (list, idKey, nameKey) => {
    const m = new Map();
    list.forEach((i) => { if (i[idKey] && i[nameKey]) m.set(i[idKey], i[nameKey]); });
    return [...m].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
  };
  const inviteeBranchOpts = optionsFrom(invitees, 'branchId', 'branch');
  const inviteeDeptOpts = optionsFrom(invitees.filter((i) => !inviteeFilters.branchId || i.branchId === inviteeFilters.branchId), 'departmentId', 'department');
  const inviteeRoleOpts = optionsFrom(invitees, 'roleId', 'role');

  const setInviteeBranch = (branchId) =>
    setInviteeFilters((f) => {
      const deptStillValid = !f.departmentId || !branchId || invitees.some((i) => i.departmentId === f.departmentId && i.branchId === branchId);
      return { ...f, branchId, departmentId: deptStillValid ? f.departmentId : '' };
    });

  const clearInviteeFilters = () => {
    setInviteeQ('');
    setInviteeFilters({ type: '', arrival: '', branchId: '', departmentId: '', role: '' });
  };

  // ຕິກເລືອກຈື່ໄວ້ຂ້າມການປ່ຽນຕົວກອງ; "ເລືອກທັງໝົດ" ໝາຍເຖິງສະເພາະຄົນທີ່ເຫັນຢູ່ຫຼັງກອງ
  const pickedIds = invitees.filter((i) => selectedInvitees.has(i._id)).map((i) => i._id); // ຕັດ id ທີ່ຖືກລຶບໄປແລ້ວອອກອັດຕະໂນມັດ
  const visiblePickedCount = filteredInvitees.filter((i) => selectedInvitees.has(i._id)).length;
  const hiddenPickedCount = pickedIds.length - visiblePickedCount;
  const allInviteesPicked = filteredInvitees.length > 0 && visiblePickedCount === filteredInvitees.length;

  const toggleInvitee = (id) =>
    setSelectedInvitees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllInvitees = () =>
    setSelectedInvitees((prev) => {
      const next = new Set(prev);
      if (allInviteesPicked) filteredInvitees.forEach((i) => next.delete(i._id));
      else filteredInvitees.forEach((i) => next.add(i._id));
      return next;
    });

  const removePicked = async () => {
    const ids = pickedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`ລຶບ ${ids.length} ຄົນ ອອກຈາກລາຍຊື່? QR ຂອງຄົນເຫຼົ່ານີ້ຈະໃຊ້ບໍ່ໄດ້ອີກ`)) return;
    setNotice('');
    const ok = await act('rm-bulk', `${base}/invitees/bulk-remove`, { method: 'POST', body: JSON.stringify({ inviteeIds: ids }) });
    if (ok) {
      setSelectedInvitees(new Set());
      setNotice(`ລຶບແລ້ວ ${ids.length} ຄົນ`);
    }
  };

  // ພິມ QR ສ່ວນຕົວສະເພາະຄົນທີ່ເລືອກ ໃນ PDF ໄຟລ໌ດຽວ
  const printPicked = () =>
    act(
      'qr-sel',
      `${base}/invite/qr.pdf`,
      { method: 'POST', body: JSON.stringify({ inviteeIds: pickedIds, baseUrl: window.location.origin }) },
      `invite-passes-selected-${booking._id}.pdf`,
    );

  const qrUrl = (extra = '') => `${base}/invite/qr.pdf?baseUrl=${encodeURIComponent(window.location.origin)}${extra}`;
  const mode = data?.inviteMode || null;
  const stats = data?.stats;
  const modeLocked = past || booking.status !== 'CONFIRMED';

  const ModeButton = ({ value, icon: Icon, label }) => (
    <button
      type="button"
      disabled={modeLocked || busy === 'mode'}
      onClick={() => value !== mode && setMode(value)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition disabled:opacity-50 ${
        (mode || 'NONE') === value
          ? 'bg-amber-500 text-white border-amber-500'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
      }`}
    >
      {Icon && <Icon size={14} />} {label}
    </button>
  );

  const TabButton = ({ value, label }) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
        tab === value ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
      }`}
    >
      {label}
    </button>
  );

  const Btn = ({ k, onClick, icon: Icon, children, tone = 'gray' }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 ${
        tone === 'amber' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
      }`}
    >
      {busy === k ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />} {children}
    </button>
  );

  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode size={16} className="text-amber-600" />
        <h3 className="text-sm font-bold text-gray-800">ເຊີນຄົນເຂົ້າຫ້ອງດ້ວຍ QR</h3>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">ກຳລັງໂຫຼດ...</p>
      ) : (
        <>
          <div className="flex gap-2">
            <ModeButton value="NONE" label="ບໍ່ເປີດ" />
            <ModeButton value="PRIVATE" icon={Lock} label="ສ່ວນຕົວ" />
            <ModeButton value="PUBLIC" icon={Globe} label="ສາທາລະນະ" />
          </div>
          {modeLocked && <p className="text-[11px] text-gray-400">ເປີດ/ປ່ຽນໂໝດໄດ້ສະເພາະການຈອງທີ່ອະນຸມັດແລ້ວ ແລະ ຍັງບໍ່ສິ້ນສຸດ</p>}

          {mode === 'PUBLIC' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">ໃຜສະແກນ QR ນີ້ກໍເຂົ້າໄດ້ (ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ ຫຼື ບອກຊື່ ເພື່ອບັນທຶກລາຍງານ)</p>
              <Btn k="qr" tone="amber" icon={Printer} onClick={() => act('qr', qrUrl(), {}, `invite-qr-${booking._id}.pdf`)}>
                ພິມ QR (PDF)
              </Btn>
            </div>
          )}

          {mode === 'PRIVATE' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-600">ແຕ່ລະຄົນຈະມີ QR ສ່ວນຕົວ. ຄົນທີ່ບໍ່ຢູ່ໃນລາຍຊື່ຈະຖືກປະຕິເສດ.</p>
                <button
                  type="button"
                  onClick={openAdd}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <UserPlus size={14} /> ເພີ່ມຄົນ
                </button>
              </div>
              {notice && !addOpen && (
                <span className="inline-block text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">{notice}</span>
              )}
              {capacity && (overBy > 0 ? (
                <div className="flex items-start gap-2 text-xs text-orange-800 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>ເຊີນ {invitedCount} ຄົນ ເກີນຄວາມຈຸຫ້ອງ ({capacity} ຄົນ) ຢູ່ {overBy} ຄົນ — ຍັງເພີ່ມໄດ້ ແຕ່ກະລຸນາກຽມເກົ້າອີ້ເພີ່ມ</span>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500">ຄວາມຈຸຫ້ອງ {capacity} ຄົນ • ເຊີນແລ້ວ {invitedCount} ຄົນ</p>
              ))}

              {addOpen && createPortal(
                <div
                  className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
                  onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdd(); }}
                >
                  <div role="dialog" aria-modal="true" className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl">
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                      <h3 className="text-base font-bold text-gray-800">ເພີ່ມຄົນເຂົ້າລາຍຊື່</h3>
                      <button type="button" onClick={closeAdd} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-5 space-y-3 overflow-y-auto">
                      <div className="flex gap-2">
                        <TabButton value="account" label="ບັນຊີໃນລະບົບ" />
                        <TabButton value="external" label="ແຂກພາຍນອກ" />
                      </div>
                      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                      {tab === 'account' && (
                        <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ຄົ້ນຫາຊື່ ຫຼື Account ID (ບໍ່ບັງຄັບ ຖ້າໃຊ້ຕົວກອງ)"
                      maxLength={60}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={filters.branchId}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                    >
                      <option value="">ທຸກສາຂາ</option>
                      {filterOptions.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select
                      value={filters.departmentId}
                      onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                    >
                      <option value="">ທຸກພະແນກ</option>
                      {filterOptions.departments
                        .filter((d) => !filters.branchId || d.branchId === filters.branchId)
                        .map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                    >
                      <option value="">ທຸກສິດ (Role)</option>
                      {filterOptions.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  {(filters.branchId || filters.departmentId || filters.role || q) && (
                    <button type="button" onClick={clearFilters} className="text-[11px] text-amber-700 underline">ລ້າງຕົວກອງ</button>
                  )}

                  {searching && <p className="text-[11px] text-gray-400">ກຳລັງຄົ້ນຫາ...</p>}
                  {!searching && results.length === 0 && (q.trim().length >= 2 || filters.branchId || filters.departmentId || filters.role) && (
                    <p className="text-[11px] text-gray-400">ບໍ່ພົບບັນຊີ</p>
                  )}

                  {results.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            disabled={selectable.length === 0 || !!busy}
                            onChange={toggleAll}
                            className="accent-amber-500"
                          />
                          <span className="font-medium text-gray-700">ເລືອກທັງໝົດ ({selectable.length})</span>
                        </label>
                        <span className="ml-auto text-gray-400">ເລືອກແລ້ວ {selected.size}</span>
                        {selected.size > 0 && (
                          <button type="button" onClick={() => setSelected(new Set())} className="text-gray-500 underline">ລ້າງ</button>
                        )}
                      </div>
                      <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                        {results.map((u) => (
                          <li key={u.userId}>
                            <label className={`flex items-center gap-2 px-3 py-2 text-sm ${u.alreadyInvited ? 'opacity-60' : 'cursor-pointer hover:bg-amber-50/60'}`}>
                              <input
                                type="checkbox"
                                checked={u.alreadyInvited || selected.has(u.userId)}
                                disabled={u.alreadyInvited || !!busy}
                                onChange={() => toggleOne(u.userId)}
                                className="accent-amber-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-gray-800">{u.name}</p>
                                <p className="truncate text-[11px] text-gray-400">
                                  {[`ID: ${u.employeeCode}`, u.branch, u.department, u.role].filter(Boolean).join(' • ')}
                                </p>
                              </div>
                              {u.alreadyInvited && (
                                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">ຢູ່ໃນລາຍຊື່ແລ້ວ</span>
                              )}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {total > results.length && (
                    <p className="text-[11px] text-gray-500">ສະແດງ {results.length} ຈາກ {total} ຄົນ — ກອງໃຫ້ແຄບລົງເພື່ອເຫັນຄົບ</p>
                  )}

                        </div>
                      )}
                      {tab === 'external' && (
                <form onSubmit={addInvitee} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ຊື່ *"
                    maxLength={80}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
                  />
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ອີເມວ (ບໍ່ບັງຄັບ)"
                    type="email"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="ເບີໂທ (ບໍ່ບັງຄັບ)"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!form.name.trim() || !!busy}
                    className={`sm:col-span-2 flex items-center justify-center gap-1.5 ${projectedOverBy > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-500 hover:bg-amber-600'} disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium`}
                  >
                    {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} ເພີ່ມເຂົ້າລາຍຊື່
                  </button>
                </form>
                      )}
                    </div>

                    {capacity && (projectedOverBy > 0 ? (
                      <div className="mx-5 mb-3 flex items-start gap-2 text-xs text-orange-800 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>ຈະເຊີນລວມ {projectedCount} ຄົນ ເກີນຄວາມຈຸຫ້ອງ ({capacity} ຄົນ) ຢູ່ {projectedOverBy} ຄົນ — ຍັງເພີ່ມໄດ້ ຖ້າຈະເພີ່ມເກົ້າອີ້ພາຍຫຼັງ</span>
                      </div>
                    ) : (
                      <p className="px-5 pb-3 text-[11px] text-gray-500">
                        ຄວາມຈຸຫ້ອງ {capacity} ຄົນ • ເຊີນແລ້ວ {invitedCount}{pendingAdd > 0 ? ` → ຈະເປັນ ${projectedCount}` : ''} ຄົນ
                      </p>
                    ))}

                    <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-gray-100">
                      {notice && <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">{notice}</span>}
                      <button type="button" onClick={closeAdd} className="ml-auto px-3 py-2 text-sm text-gray-600">ປິດ</button>
                      {tab === 'account' && selected.size > 0 && (
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={inviteSelected}
                          className={`flex items-center gap-1.5 ${projectedOverBy > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-500 hover:bg-amber-600'} disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium`}
                        >
                          {busy === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} ເຊີນ {selected.size} ຄົນ
                        </button>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {invitees.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 space-y-2 border-b border-gray-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-gray-700">ມາແລ້ວ {arrivedCount} / {invitees.length} ຄົນ</span>
                        <span className={`flex items-center gap-1.5 ${live ? 'text-emerald-600' : 'text-gray-400'}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                          {live ? 'ອັບເດດສົດ' : 'ອັບເດດທຸກ 10 ວິ'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${arrivedPct}%` }} />
                      </div>
                    </div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        value={inviteeQ}
                        onChange={(e) => setInviteeQ(e.target.value)}
                        placeholder="ຄົ້ນຫາໃນລາຍຊື່ (ຊື່, Account ID, ອີເມວ, ເບີໂທ)"
                        maxLength={60}
                        className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={inviteeFilters.type}
                        onChange={(e) => setInviteeFilters((f) => ({ ...f, type: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                      >
                        <option value="">ທຸກປະເພດ ({invitees.length})</option>
                        <option value="account">ບັນຊີໃນລະບົບ ({accountCount})</option>
                        <option value="guest">ແຂກພາຍນອກ ({guestCount})</option>
                      </select>
                      <select
                        value={inviteeFilters.arrival}
                        onChange={(e) => setInviteeFilters((f) => ({ ...f, arrival: e.target.value }))}
                        className={`border rounded-lg px-2 py-2 text-xs ${
                          inviteeFilters.arrival === 'arrived'
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-medium'
                            : inviteeFilters.arrival === 'pending'
                              ? 'border-gray-400 bg-gray-100 text-gray-700 font-medium'
                              : 'border-gray-300 bg-white'
                        }`}
                      >
                        <option value="">ທຸກສະຖານະ ({invitees.length})</option>
                        <option value="arrived">ມາແລ້ວ ({arrivedCount})</option>
                        <option value="pending">ຍັງບໍ່ມາ ({pendingCount})</option>
                      </select>
                    </div>
                    {accountCount > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={inviteeFilters.branchId}
                          onChange={(e) => setInviteeBranch(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                        >
                          <option value="">ທຸກສາຂາ</option>
                          {inviteeBranchOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <select
                          value={inviteeFilters.departmentId}
                          onChange={(e) => setInviteeFilters((f) => ({ ...f, departmentId: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                        >
                          <option value="">ທຸກພະແນກ</option>
                          {inviteeDeptOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <select
                          value={inviteeFilters.role}
                          onChange={(e) => setInviteeFilters((f) => ({ ...f, role: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white"
                        >
                          <option value="">ທຸກສິດ (Role)</option>
                          {inviteeRoleOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                    )}
                    {inviteeFilterOn && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-gray-500">ສະແດງ {filteredInvitees.length} ຈາກ {invitees.length} ຄົນ{orgFilterOn ? ' (ແຂກພາຍນອກຖືກຊ່ອນ ເພາະບໍ່ມີຂໍ້ມູນສາຂາ/ພະແນກ/ສິດ)' : ''}</span>
                        <button type="button" onClick={clearInviteeFilters} className="text-amber-700 underline">ລ້າງຕົວກອງ</button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allInviteesPicked}
                        disabled={!!busy || filteredInvitees.length === 0}
                        onChange={toggleAllInvitees}
                        className="accent-amber-500"
                      />
                      <span className="font-medium text-gray-700">ເລືອກທັງໝົດ ({filteredInvitees.length})</span>
                    </label>
                    {pickedIds.length > 0 ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <span className="text-gray-500">ເລືອກແລ້ວ {pickedIds.length}{hiddenPickedCount > 0 ? ` (ຖືກກອງອອກ ${hiddenPickedCount})` : ''}</span>
                        <button type="button" disabled={!!busy} onClick={() => setSelectedInvitees(new Set())} className="text-gray-500 underline disabled:opacity-50">ລ້າງ</button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={printPicked}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
                        >
                          {busy === 'qr-sel' ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} ພິມ QR ({pickedIds.length})
                        </button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={removePicked}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium disabled:opacity-50"
                        >
                          {busy === 'rm-bulk' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} ລຶບ ({pickedIds.length})
                        </button>
                      </div>
                    ) : (
                      <span className="ml-auto text-gray-400">ຕິກເລືອກເພື່ອລຶບ ຫຼື ພິມ QR ຫຼາຍຄົນ</span>
                    )}
                  </div>
                  <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {filteredInvitees.length === 0 && (
                      <li className="px-3 py-4 text-center text-[11px] text-gray-400">ບໍ່ພົບຄົນໃນລາຍຊື່</li>
                    )}
                    {filteredInvitees.map((i) => (
                      <li
                        key={i._id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm border-l-4 transition-colors ${
                          i.joinedAt ? 'bg-emerald-50 border-l-emerald-500' : 'bg-gray-50 border-l-gray-300'
                        } ${flashIds.has(i._id) ? 'ring-2 ring-inset ring-emerald-400 animate-pulse' : selectedInvitees.has(i._id) ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                      >
                      <input
                        type="checkbox"
                        checked={selectedInvitees.has(i._id)}
                        disabled={!!busy}
                        onChange={() => toggleInvitee(i._id)}
                        aria-label={`ເລືອກ ${i.name}`}
                        className="accent-amber-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${i.joinedAt ? 'font-semibold text-emerald-900' : 'text-gray-500'}`}>{i.name}</p>
                        <p className="truncate text-[11px] text-gray-400">{[i.employeeCode && `ID: ${i.employeeCode}`, i.branch, i.department, i.role, i.email, i.phone].filter(Boolean).join(' • ') || '—'}</p>
                      </div>
                      {i.joinedAt ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <CheckCircle2 size={12} /> ມາແລ້ວ {new Date(i.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Clock size={12} /> ຍັງບໍ່ມາ
                        </span>
                      )}
                      <button
                        type="button"
                        title="ພິມ QR ຂອງຄົນນີ້"
                        disabled={!!busy}
                        onClick={() => act(`qr-${i._id}`, qrUrl(`&inviteeId=${i._id}`), {}, `pass-${i.name.replace(/[^\w-]+/g, '_')}.pdf`)}
                        className="text-gray-400 hover:text-amber-600 disabled:opacity-50"
                      >
                        <Printer size={15} />
                      </button>
                      <button type="button" title="ລຶບອອກ" disabled={!!busy} onClick={() => removeInvitee(i)} className="text-gray-400 hover:text-red-600 disabled:opacity-50">
                        <Trash2 size={15} />
                      </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Btn k="qr" tone="amber" icon={Printer} onClick={() => act('qr', qrUrl(), {}, `invite-passes-${booking._id}.pdf`)}>
                  ພິມ QR ທຸກຄົນ (PDF)
                </Btn>
                <Btn k="door" icon={QrCode} onClick={() => act('door', qrUrl('&target=door'), {}, `door-qr-${booking._id}.pdf`)}>
                  ພິມ QR ປະຕູ (ກວດຊື່)
                </Btn>
              </div>
            </div>
          )}

          {mode && stats && (
            <div className="space-y-2 pt-2 border-t border-amber-200">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {mode === 'PRIVATE' && <span className="px-2 py-1 rounded-full bg-white border border-gray-200">ເຊີນ {stats.invited}</span>}
                <span className="px-2 py-1 rounded-full bg-emerald-500 text-white font-semibold border border-emerald-500">ເຂົ້າແລ້ວ {stats.joined}</span>
                {mode === 'PRIVATE' && <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700 border border-gray-300">ຍັງບໍ່ມາ {stats.notJoined}</span>}
                <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">ຖືກປະຕິເສດ {stats.denied}</span>
              </div>

              {data.recentScans.length > 0 && (
                <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                  {data.recentScans.map((s, idx) => (
                    <li key={idx} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      {s.result === 'ADMITTED' ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />}
                      <span className="truncate flex-1 text-gray-700">{s.name}{s.employeeCode ? ` (${s.employeeCode})` : ''}</span>
                      {s.result === 'DENIED' && <span className="text-red-600 whitespace-nowrap">{REASON_LO[s.reason] || s.reason}</span>}
                      <span className="text-gray-400 whitespace-nowrap">{new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(mode || (stats && (stats.joined > 0 || stats.denied > 0))) && (
            <div className="flex flex-wrap gap-2">
              <Btn k="csv" icon={FileSpreadsheet} onClick={() => act('csv', `${base}/invite/attendance.csv`, {}, `attendance-${booking._id}.csv`)}>
                ລາຍງານ CSV
              </Btn>
              <Btn k="pdf" icon={FileDown} onClick={() => act('pdf', `${base}/invite/attendance.pdf`, {}, `attendance-${booking._id}.pdf`)}>
                ລາຍງານ PDF
              </Btn>
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
