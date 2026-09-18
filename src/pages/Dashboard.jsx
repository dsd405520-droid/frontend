import { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Bell, 
  Info
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const STATUS_LABELS = {
  OPEN: 'ເປີດ',
  ASSIGNED: 'ມອບໝາຍແລ້ວ',
  IN_PROGRESS: 'ກຳລັງດຳເນີນການ',
  WAITING_ON_USER: 'ລໍຖ້າຜູ້ໃຊ້',
  RESOLVED: 'ແກ້ໄຂແລ້ວ',
  CLOSED: 'ປິດແລ້ວ',
};

const PRIORITY_STYLES = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState(null);
  const [supplyRequests, setSupplyRequests] = useState(null);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch('http://localhost:3000/api/dashboard', { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(body => {
        setData(body?.data ?? body);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    // ຫ້ອງປະຊຸມ ແລະ ຄຳຂໍອຸປະກອນ ບໍ່ໄດ້ຢູ່ໃນ payload ຂອງ /dashboard —
    // ດຶງແຍກຕ່າງຫາກ, ແລະ ບໍ່ໃຫ້ຄ້າງທັງໜ້າຖ້າບໍ່ມີສິດເຂົ້າເຖິງ (403)
    fetch('http://localhost:3000/api/rooms', { headers })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(body => setRooms(body?.data ?? body))
      .catch(() => setRooms(null));

    fetch('http://localhost:3000/api/supply-requests/my', { headers })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(body => setSupplyRequests(body?.data ?? body))
      .catch(() => setSupplyRequests(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myTickets = data?.myTickets;
  const byStatus = myTickets?.byStatus || {};
  const openCount = myTickets
    ? myTickets.total - (byStatus.RESOLVED || 0) - (byStatus.CLOSED || 0)
    : null;
  const resolvedCount = (byStatus.RESOLVED || 0) + (byStatus.CLOSED || 0);
  const pinnedAnnouncement = data?.announcements?.pinned?.[0];

  const fmt = (n) => (n === null || n === undefined ? '-' : n);

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ປະກາດປັກໝຸດ (Announcement Banner) */}
        {pinnedAnnouncement && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between text-blue-900 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="bg-red-500 text-white p-1 rounded-lg flex items-center justify-center">
                <Info size={18} />
              </span>
              <span className="text-sm font-medium">
                <strong>ປະກາດປັກໝຸດ:</strong> {pinnedAnnouncement.title}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ລາຍການທີ່ເປີດຢູ່</span>
              <span className="bg-amber-100 text-amber-700 p-2 rounded-lg"><AlertCircle size={20} /></span>
            </div>
            <h2 className={`text-3xl font-bold mt-2 ${loading ? 'text-gray-300' : 'text-gray-800'}`}>{loading ? '-' : fmt(openCount)}</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ຈາກທັງໝົດ {loading ? '-' : fmt(myTickets?.total)} ລາຍການຂອງຂ້ອຍ</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ໃກ້ຄົບກຳນົດ SLA</span>
              <span className="bg-red-100 text-red-700 p-2 rounded-lg"><Clock size={20} /></span>
            </div>
            <h2 className={`text-3xl font-bold mt-2 ${loading ? 'text-gray-300' : 'text-gray-800'}`}>{loading ? '-' : fmt(myTickets?.slaDueSoon)}</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ພາຍໃນ 4 ຊົ່ວໂມງຂ້າງໜ້າ</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ແກ້ໄຂແລ້ວ</span>
              <span className="bg-emerald-100 text-emerald-700 p-2 rounded-lg"><CheckCircle2 size={20} /></span>
            </div>
            <h2 className={`text-3xl font-bold mt-2 ${loading ? 'text-gray-300' : 'text-gray-800'}`}>{loading ? '-' : fmt(resolvedCount)}</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ລາຍການຂອງຂ້ອຍ</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-500 text-sm">ປະກາດໃໝ່</span>
              <span className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Bell size={20} /></span>
            </div>
            <h2 className={`text-3xl font-bold mt-2 ${loading ? 'text-gray-300' : 'text-gray-800'}`}>{loading ? '-' : fmt(data?.announcements?.recent?.length)}</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">ການແຈ້ງເຕືອນທີ່ຍັງບໍ່ອ່ານ: {loading ? '-' : fmt(data?.notifications?.unreadCount)}</p>
          </div>
        </div>

        {/* Main Content Grid (Left Table & Right Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: ລາຍການແຈ້ງຊ່ວຍເຫຼືອຂອງຂ້ອຍ */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-gray-800 text-base">ລາຍການແຈ້ງຂອງຂ້ອຍ — ໃຫ້ທັນກຳນົດ</h3>
                <p className="text-xs text-gray-500">ຮຽງຕາມເວລາ SLA ທີ່ເຫຼືອນ້ອຍສຸດ</p>
              </div>
              <a href="/tickets" className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition">
                ເບິ່ງທັງໝົດ
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="pb-3 font-medium">SLA</th>
                    <th className="pb-3 font-medium">ລະຫັດ</th>
                    <th className="pb-3 font-medium">ຫົວຂໍ້</th>
                    <th className="pb-3 font-medium">ຄວາມສຳຄັນ</th>
                    <th className="pb-3 font-medium">ສະຖານະ</th>
                    <th className="pb-3 font-medium">ກຳນົດສົ່ງ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {loading ? (
                    <tr><td colSpan="6" className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                  ) : myTickets?.recent?.length > 0 ? (
                    myTickets.recent.map((t) => (
                      <tr key={t.id}>
                        <td className="py-3">
                          {t.slaBreached ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">ຜິດພາດ</span>
                          ) : t.resolutionDueAt ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">ປົກກະຕິ</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">-</span>
                          )}
                        </td>
                        <td className="py-3 font-medium text-gray-800">{t.ticketNumber}</td>
                        <td className="py-3">{t.title}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3">{STATUS_LABELS[t.status] || t.status}</td>
                        <td className="py-3 text-xs text-gray-400">
                          {t.resolutionDueAt ? new Date(t.resolutionDueAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-sm text-gray-400">
                        ບໍ່ມີລາຍການແຈ້ງຂອງທ່ານ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: ກິດຈະກຳຫຼ້າສຸດ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-base mb-4">ກິດຈະກຳຫຼ້າສຸດ</h3>
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
            ) : data?.notifications?.recent?.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.notifications.recent.map((n, idx) => (
                  <div key={n._id || idx} className={`p-2.5 rounded-lg text-sm ${n.isRead ? 'bg-gray-50' : 'bg-amber-50'}`}>
                    <p className="font-medium text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400">
                ຍັງບໍ່ມີກິດຈະກຳ
              </div>
            )}
          </div>

        </div>

        {/* Bottom 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* 1. ລາຍການຕາມສະຖານະ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ລາຍການຕາມສະຖານະ</h3>
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(byStatus).map(([status, count]) => {
                  const max = Math.max(1, ...Object.values(byStatus));
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{STATUS_LABELS[status] || status}</span>
                        <span className="font-medium text-gray-700">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. ຫ້ອງປະຊຸມ — ຕອນນີ້ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ຫ້ອງປະຊຸມ — ຕອນນີ້</h3>
            {rooms === null ? (
              <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີສິດເຂົ້າເຖິງ ຫຼື ຍັງບໍ່ມີຂໍ້ມູນ</div>
            ) : rooms.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {rooms.map((r) => {
                  const liveStatus = r.liveStatus || r.status;
                  const statusStyle =
                    liveStatus === 'MAINTENANCE' ? 'bg-red-100 text-red-700' :
                    liveStatus === 'BOOKED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                  const statusLabel =
                    liveStatus === 'MAINTENANCE' ? 'ປິດບຳລຸງ' :
                    liveStatus === 'BOOKED' ? 'ກຳລັງໃຊ້ງານ' : 'ວ່າງ';
                  return (
                    <div key={r._id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{r.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຫ້ອງປະຊຸມ</div>
            )}
          </div>

          {/* 3. ຄຳຂໍອຸປະກອນຫຼ້າສຸດ */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 text-base mb-4">ຄຳຂໍອຸປະກອນຫຼ້າສຸດ</h3>
            {supplyRequests === null ? (
              <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີສິດເຂົ້າເຖິງ ຫຼື ຍັງບໍ່ມີຂໍ້ມູນ</div>
            ) : supplyRequests.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {supplyRequests.slice(0, 5).map((r) => (
                  <div key={r._id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 truncate">{r.items?.map(i => i.name).join(', ')}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2">{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">ຍັງບໍ່ມີຄຳຂໍ</div>
            )}
          </div>

        </div>

      </div>
    </MainLayout>
  );
}
