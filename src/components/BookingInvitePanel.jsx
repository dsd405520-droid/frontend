import { useCallback, useEffect, useState } from 'react';
import { QrCode, Lock, Globe, UserPlus, Trash2, FileDown, FileSpreadsheet, Printer, CheckCircle2, XCircle, Loader2, Search, Users } from 'lucide-react';
import { API_BASE_URL } from '../config';

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

  const inviteMode = data?.inviteMode || null;

  // ໂຫຼດຕົວເລືອກຕົວກອງ ຄັ້ງດຽວ ເມື່ອເປີດແຖບ "ບັນຊີໃນລະບົບ" ຂອງໂໝດສ່ວນຕົວ
  useEffect(() => {
    if (tab !== 'account' || inviteMode !== 'PRIVATE') return undefined;
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
  }, [tab, inviteMode, base, token]);

  useEffect(() => {
    const term = q.trim();
    const hasFilter = !!(filters.branchId || filters.departmentId || filters.role);
    if (tab !== 'account' || (term.length < 2 && !hasFilter)) {
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
  }, [q, tab, base, token, filters.branchId, filters.departmentId, filters.role, refreshKey]);

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
    if (ok) setForm({ name: '', email: '', phone: '' });
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
      setSelected(new Set());
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
              <p className="text-xs text-gray-600">ເພີ່ມຄົນ (ກອງຕາມສາຂາ/ພະແນກ/ສິດ ແລ້ວຕິກເລືອກຫຼາຍຄົນໄດ້) — ແຕ່ລະຄົນຈະມີ QR ສ່ວນຕົວ. ຄົນທີ່ບໍ່ຢູ່ໃນລາຍຊື່ຈະຖືກປະຕິເສດ.</p>
              <div className="flex gap-2">
                <TabButton value="account" label="ບັນຊີໃນລະບົບ" />
                <TabButton value="external" label="ແຂກພາຍນອກ" />
              </div>
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
                      <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
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

                  {(selected.size > 0 || notice) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.size > 0 && (
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={inviteSelected}
                          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"
                        >
                          {busy === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} ເຊີນ {selected.size} ຄົນ
                        </button>
                      )}
                      {notice && <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">{notice}</span>}
                    </div>
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
                  className="sm:col-span-2 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"
                >
                  {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} ເພີ່ມເຂົ້າລາຍຊື່
                </button>
              </form>
              )}

              {data.invitees.length > 0 && (
                <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg max-h-56 overflow-y-auto">
                  {data.invitees.map((i) => (
                    <li key={i._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-gray-800">{i.name}</p>
                        <p className="truncate text-[11px] text-gray-400">{[i.employeeCode && `ID: ${i.employeeCode}`, i.email, i.phone].filter(Boolean).join(' • ') || '—'}</p>
                      </div>
                      {i.joinedAt ? (
                        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">ເຂົ້າແລ້ວ</span>
                      ) : (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">ຍັງບໍ່ມາ</span>
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
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">ເຂົ້າແລ້ວ {stats.joined}</span>
                {mode === 'PRIVATE' && <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">ຍັງບໍ່ມາ {stats.notJoined}</span>}
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
