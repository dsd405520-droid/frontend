import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Monitor, LogOut, Info } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

function decodeJwtSessionId(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sessionId || null;
  } catch {
    return null;
  }
}

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };
  const currentSessionId = decodeJwtSessionId(token);

  const fetchSessions = () => {
    setLoadingSessions(true);
    fetch('http://localhost:3000/api/sessions/me', { headers })
      .then(res => res.json())
      .then(body => {
        const rows = body?.data ?? body;
        setSessions(Array.isArray(rows) ? rows : []);
        setLoadingSessions(false);
      })
      .catch(() => setLoadingSessions(false));
  };

  useEffect(() => {
    setLoadingProfile(true);
    fetch('http://localhost:3000/api/auth/me', { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(body => {
        setProfile(body?.data ?? body);
        setLoadingProfile(false);
      })
      .catch(err => {
        setError(err.message);
        setLoadingProfile(false);
      });

    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokeSession = (id) => {
    if (!window.confirm('ຕ້ອງການອອກຈາກລະບົບອຸປະກອນນີ້ແທ້ບໍ?')) return;
    setRevokingId(id);
    fetch(`http://localhost:3000/api/sessions/me/${id}`, {
      method: 'DELETE',
      headers,
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ອອກຈາກລະບົບບໍ່ສຳເລັດ');
        }
        fetchSessions();
      })
      .catch(err => alert(err.message))
      .finally(() => setRevokingId(null));
  };

  const fullName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ການຕັ້ງຄ່າ</h1>
          <p className="text-sm text-gray-500 mt-1">ຂໍ້ມູນສ່ວນຕົວ ແລະ ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບຢູ່</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* ຂໍ້ມູນສ່ວນຕົວ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 text-base border-b pb-3">ຂໍ້ມູນສ່ວນຕົວ</h3>
          {loadingProfile ? (
            <div className="py-6 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : profile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ຊື່</p>
                <p className="font-medium text-gray-800">{fullName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ອີເມວ</p>
                <p className="font-medium text-gray-800">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ສິດ (Role)</p>
                <p className="font-medium text-gray-800">{profile.role?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">ພະແນກ</p>
                <p className="font-medium text-gray-800">{profile.departmentId?.name || '-'}</p>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">ບໍ່ສາມາດດຶງຂໍ້ມູນໄດ້</div>
          )}
        </div>

        {/* ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800 text-base border-b pb-3">ອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບຢູ່</h3>
          {loadingSessions ? (
            <div className="py-6 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
          ) : sessions.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {sessions.map((s) => {
                const isCurrent = s._id === currentSessionId;
                return (
                  <div key={s._id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-gray-100 text-gray-500 p-2 rounded-lg"><Monitor size={16} /></span>
                      <div className="text-sm">
                        <p className="font-medium text-gray-800 flex items-center gap-2">
                          {s.deviceInfo?.browser || 'ບໍ່ຮູ້ browser'} · {s.deviceInfo?.os || 'ບໍ່ຮູ້ OS'}
                          {isCurrent && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">ອຸປະກອນນີ້</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          IP: {s.deviceInfo?.ip || '-'} · ໃຊ້ຫຼ້າສຸດ: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '-'}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => revokeSession(s._id)}
                        disabled={revokingId === s._id}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <LogOut size={14} />
                        {revokingId === s._id ? 'ກຳລັງອອກ...' : 'ອອກຈາກລະບົບ'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">ບໍ່ມີອຸປະກອນທີ່ເຂົ້າສູ່ລະບົບ</div>
          )}
        </div>

        {/* ໝາຍເຫດ: ການຕັ້ງຄ່າອົງກອນ (S3 / SMTP / Integration Keys) ຍັງບໍ່ໄດ້ສ້າງໃນ backend */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            ການຕັ້ງຄ່າອົງກອນລະດັບເລິກ (ຊື່ລະບົບ, S3, SMTP, Integration Keys) ຍັງບໍ່ມີ backend ຮອງຮັບ —
            ໜ້ານີ້ຈຶ່ງສະແດງສະເພາະຂໍ້ມູນສ່ວນຕົວ ແລະ ການຈັດການອຸປະກອນ ທີ່ມີ API ພ້ອມໃຊ້ງານແທ້.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
