import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, DoorOpen, Clock, MapPin, LogIn, LogOut, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';

const REASON_LO = {
  INVALID_QR: 'QR ນີ້ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ',
  BOOKING_NOT_ACTIVE: 'ການຈອງນີ້ຖືກຍົກເລີກ ຫຼື ຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ',
  INVITES_CLOSED: 'ເຈົ້າຂອງການຈອງປິດການເຊີນແລ້ວ',
  TOO_EARLY: 'ຍັງບໍ່ຮອດເວລາເຂົ້າຫ້ອງ — ກະລຸນາກັບມາໃໝ່ໃກ້ເວລານັດ',
  ENDED: 'ກອງປະຊຸມນີ້ສິ້ນສຸດແລ້ວ',
  NOT_ON_LIST: 'ທ່ານບໍ່ຢູ່ໃນລາຍຊື່ແຂກທີ່ຖືກເຊີນ',
  REVOKED: 'ການເຊີນຂອງທ່ານຖືກຍົກເລີກແລ້ວ',
  ROOM_FULL: 'ຫ້ອງເຕັມແລ້ວ',
  ACCOUNT_MISMATCH: 'ບັດນີ້ເປັນຂອງບັນຊີອື່ນ — ກະລຸນາເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີທີ່ຖືກເຊີນ',
  ACCOUNT_INACTIVE: 'ບັນຊີນີ້ຖືກປິດໃຊ້ງານ',
};

function getToken() {
  const t = localStorage.getItem('token');
  if (!t) return '';
  try {
    const { exp } = JSON.parse(atob(t.split('.')[1]));
    return exp && exp * 1000 > Date.now() ? t : '';
  } catch {
    return '';
  }
}

async function call(path, options) {
  const t = getToken();
  const res = await fetch(`${API_BASE_URL}/join/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  if (res.status === 429) throw new Error('ສະແກນຖີ່ເກີນໄປ — ກະລຸນາລໍຖ້າຈັກຄູ່ແລ້ວລອງໃໝ່');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.msg || json.message || 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່');
  return json.data;
}

export default function JoinRoom() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const autoRan = useRef(false);

  const goLogin = () => navigate('/login', { state: { from: location } });

  const switchAccount = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    goLogin();
  };

  const logoutHere = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  const submit = async (payload = {}) => {
    setSubmitting(true);
    setError('');
    try {
      const data = await call(token, { method: 'POST', body: JSON.stringify(payload) });
      if (data.result === 'NEEDS_INFO') {
        setInfo((prev) => ({ ...(prev || {}), needsName: true, needsContact: data.needsContact }));
      } else if (data.result === 'LOGIN_REQUIRED') {
        setInfo((prev) => ({ ...(prev || {}), requiresAccount: true, loggedIn: false, guestName: data.guestName }));
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call(token);
        if (cancelled) return;
        setInfo(data);
        if (data.valid && !data.needsName && !(data.requiresAccount && !data.loggedIn) && !autoRan.current) {
          autoRan.current = true;
          submit({});
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const booking = result?.booking || info;
  const fmt = (d) => (d ? new Date(d).toLocaleString() : '');

  const BookingBox = () =>
    booking?.title ? (
      <div className="bg-white/70 rounded-xl p-3 text-sm text-gray-700 space-y-1 mt-4 text-left">
        <p className="font-semibold text-gray-800">{booking.title}</p>
        <p className="flex items-center gap-1.5"><MapPin size={14} className="text-gray-400" /> {booking.roomName}</p>
        <p className="flex items-center gap-1.5"><Clock size={14} className="text-gray-400" /> {fmt(booking.startAt)} – {fmt(booking.endAt)}</p>
      </div>
    ) : null;

  let body;
  if (loading || (submitting && !result)) {
    body = (
      <div className="text-center text-gray-500 py-10">
        <Loader2 className="animate-spin mx-auto mb-3" size={36} />
        <p className="text-sm">ກຳລັງກວດສອບ...</p>
      </div>
    );
  } else if (result?.result === 'ADMITTED') {
    body = (
      <div className="text-center bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <CheckCircle2 size={72} className="mx-auto text-emerald-500" />
        <h1 className="text-2xl font-bold text-emerald-700 mt-3">ເຂົ້າໄດ້ ✓</h1>
        <p className="text-gray-700 mt-1 text-base">{result.name}</p>
        {result.employeeCode && <p className="text-xs text-gray-500">ID: {result.employeeCode}</p>}
        {result.alreadyJoined && <p className="text-xs text-emerald-700 mt-1">ທ່ານໄດ້ເຂົ້າຮ່ວມແລ້ວກ່ອນໜ້ານີ້</p>}
        <BookingBox />
      </div>
    );
  } else if (result?.result === 'DENIED' || (info && info.valid === false)) {
    const reason = result?.reason || 'INVALID_QR';
    body = (
      <div className="text-center bg-red-50 border border-red-200 rounded-2xl p-6">
        <XCircle size={72} className="mx-auto text-red-500" />
        <h1 className="text-2xl font-bold text-red-700 mt-3">ບໍ່ອະນຸຍາດ</h1>
        <p className="text-gray-700 mt-2 text-sm">{REASON_LO[reason] || result?.message || 'ບໍ່ສາມາດເຂົ້າໄດ້'}</p>
        {result?.name && <p className="text-xs text-gray-500 mt-2">ຊື່ທີ່ກວດ: {result.name}</p>}
        <BookingBox />
      </div>
    );
  } else if (info?.valid && info.requiresAccount && !info.loggedIn) {
    body = (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
        <LogIn size={44} className="mx-auto text-amber-500" />
        <h1 className="text-xl font-bold text-gray-800 mt-2">ເຂົ້າສູ່ລະບົບເພື່ອເຂົ້າຫ້ອງ</h1>
        <p className="text-xs text-gray-500 mt-1">ບັດນີ້ອອກໃຫ້ບັນຊີ: {info.guestName}</p>
        <BookingBox />
        <button
          type="button"
          onClick={goLogin}
          className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 text-base"
        >
          ເຂົ້າສູ່ລະບົບ
        </button>
      </div>
    );
  } else if (info?.valid && info.needsName) {
    const canSend = name.trim() && (!info.needsContact || contact.trim());
    body = (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="text-center">
          <DoorOpen size={44} className="mx-auto text-amber-500" />
          <h1 className="text-xl font-bold text-gray-800 mt-2">ເຂົ້າຮ່ວມກອງປະຊຸມ</h1>
          <p className="text-xs text-gray-500 mt-1">
            {info.mode === 'PRIVATE' ? 'ສະເພາະຜູ້ທີ່ຖືກເຊີນ' : 'ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ ຫຼື ບອກຊື່ຂອງທ່ານ'}
          </p>
        </div>
        <BookingBox />
        <button
          type="button"
          onClick={goLogin}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 text-base"
        >
          <LogIn size={18} /> ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ
        </button>
        <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-400">
          <span className="flex-1 border-t border-gray-200" />
          {info.mode === 'PRIVATE' ? 'ຫຼື ແຂກພາຍນອກ: ກອກຂໍ້ມູນທີ່ເຈົ້າພາບມີໃນລາຍຊື່' : 'ຫຼື ເຂົ້າໃນນາມແຂກ'}
          <span className="flex-1 border-t border-gray-200" />
        </div>
        <form
          className="space-y-3 mt-3"
          onSubmit={(e) => { e.preventDefault(); if (canSend) submit({ name: name.trim(), contact: contact.trim() }); }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="ຊື່ ແລະ ນາມສະກຸນ"
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            autoFocus
          />
          {info.needsContact && (
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              placeholder="ອີເມວ ຫຼື ເບີໂທ ທີ່ໃຊ້ຕອນຖືກເຊີນ"
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <button
            type="submit"
            disabled={!canSend || submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-base"
          >
            {submitting ? 'ກຳລັງກວດ...' : 'ເຂົ້າຫ້ອງ'}
          </button>
        </form>
      </div>
    );
  } else {
    body = (
      <div className="text-center bg-red-50 border border-red-200 rounded-2xl p-6">
        <XCircle size={56} className="mx-auto text-red-500" />
        <p className="text-sm text-gray-700 mt-3">{error || 'ບໍ່ສາມາດກວດ QR ໄດ້'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {body}
        {info?.loggedIn && info.account && (
          <div className="mt-4 flex flex-col items-center gap-2 text-xs text-gray-500">
            <p>
              ເຂົ້າສູ່ລະບົບເປັນ <span className="font-medium text-gray-700">{info.account.name}</span> ({info.account.employeeCode})
            </p>
            <div className="flex gap-4">
              <button type="button" onClick={switchAccount} className="inline-flex items-center gap-1 underline hover:text-gray-700">
                <UserRound size={13} /> ປ່ຽນບັນຊີ
              </button>
              <button type="button" onClick={logoutHere} className="inline-flex items-center gap-1 underline hover:text-gray-700">
                <LogOut size={13} /> ອອກຈາກລະບົບ
              </button>
            </div>
          </div>
        )}
        {error && (result || info?.valid) && <p className="text-center text-xs text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
