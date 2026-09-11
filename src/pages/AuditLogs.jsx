import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  const fetchLogs = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (from) params.set('from', new Date(from + 'T00:00:00').toISOString());
    if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());

    fetch(`http://localhost:3000/api/audit-logs?${params.toString()}`, { headers })
      .then(async res => {
        if (res.status === 403) {
          throw new Error('ບໍ່ມີສິດເຂົ້າເຖິງບັນທຶກການກວດສອບ (audit-logs:read)');
        }
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(body => {
        const rows = body?.data ?? body;
        setLogs(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLogs([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actorName = (actorId) => {
    if (!actorId) return 'ບໍ່ລະບຸ';
    if (typeof actorId === 'object') {
      const fullName = [actorId.firstName, actorId.lastName].filter(Boolean).join(' ');
      return fullName || actorId.email || 'ບໍ່ລະບຸ';
    }
    return actorId;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ບັນທຶກການກວດສອບ (Audit Logs)</h1>
          <p className="text-sm text-gray-500 mt-1">ຕິດຕາມກວດສອບການກະທຳທີ່ມີຄວາມລະອຽດອ່ອນໃນລະບົບ</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ປະເພດ (Entity Type)</label>
            <input
              type="text"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="ເຊັ່ນ: Ticket, RoomBooking..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ຈາກວັນທີ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ຫາວັນທີ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <button
            onClick={fetchLogs}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
          >
            ຄົ້ນຫາ
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ (_id)</th>
                <th className="p-4 font-medium">ຜູ້ກະທຳ</th>
                <th className="p-4 font-medium">ການກະທຳ (Action)</th>
                <th className="p-4 font-medium">ລາຍລະອຽດ</th>
                <th className="p-4 font-medium">ເວລາ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ກຳລັງໂຫຼດຂໍ້ມູນ...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-xs text-gray-400">{item._id}</td>
                    <td className="p-4 font-medium text-gray-800">{actorName(item.actorId)}</td>
                    <td className="p-4">{item.action}</td>
                    <td className="p-4 text-xs text-gray-500">{item.entityType} · {item.entityId}</td>
                    <td className="p-4 text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີບັນທຶກ Audit Log
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
