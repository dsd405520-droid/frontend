import { useCallback, useEffect, useState } from 'react';
import { QrCode, Lock, Globe, UserPlus, Trash2, FileDown, FileSpreadsheet, Printer, CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
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
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (tab !== 'account' || term.length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${base}/invite/accounts?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await parseError(res));
        const json = await res.json();
        setResults(json.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, tab, base, token]);

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

  const addAccount = async (u) => {
    const ok = await act('add', `${base}/invitees`, { method: 'POST', body: JSON.stringify({ userId: u.userId }) });
    if (ok) {
      setQ('');
      setResults([]);
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
              <p className="text-xs text-gray-600">ເພີ່ມຄົນເທື່ອລະຄົນ — ແຕ່ລະຄົນຈະມີ QR ສ່ວນຕົວ. ຄົນທີ່ບໍ່ຢູ່ໃນລາຍຊື່ຈະຖືກປະຕິເສດ.</p>
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
                      placeholder="ຄົ້ນຫາຊື່ ຫຼື Account ID (ຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ)"
                      maxLength={60}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  {searching && <p className="text-[11px] text-gray-400">ກຳລັງຄົ້ນຫາ...</p>}
                  {!searching && q.trim().length >= 2 && results.length === 0 && <p className="text-[11px] text-gray-400">ບໍ່ພົບບັນຊີ</p>}
                  {results.length > 0 && (
                    <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {results.map((u) => (
                        <li key={u.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-gray-800">{u.name}</p>
                            <p className="truncate text-[11px] text-gray-400">ID: {u.employeeCode}</p>
                          </div>
                          {u.alreadyInvited ? (
                            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">ຢູ່ໃນລາຍຊື່ແລ້ວ</span>
                          ) : (
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => addAccount(u)}
                              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg px-2.5 py-1 text-xs font-medium"
                            >
                              {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} ເພີ່ມ
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
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
