import React, { useState, useEffect } from 'react';
import { BarChart3, Download } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const REPORT_TYPE_LABELS = {
  sla: 'SLA Compliance',
  tickets: 'ແຍກຕາມພະແນກ/ສາຂາ/ປະເພດ/ເຈົ້າໜ້າທີ່',
  workload: 'ວຽກງານຂອງເຈົ້າໜ້າທີ່',
  csat: 'ຄວາມພໍໃຈ (CSAT)',
};

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportType, setExportType] = useState('tickets');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('http://localhost:3000/api/reports/summary', { headers })
      .then(async res => {
        if (res.status === 403) {
          throw new Error('ບໍ່ມີສິດເຂົ້າເຖິງລາຍງານ (reports:read)');
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalTickets = data?.tickets?.byDepartment?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const slaRate = data?.sla?.complianceRate;
  const csatByAgent = data?.csat?.byAgent || [];
  const csatAvg = csatByAgent.length > 0
    ? csatByAgent.reduce((sum, a) => sum + a.avgRating * a.count, 0) / csatByAgent.reduce((sum, a) => sum + a.count, 0)
    : null;

  const handleExport = () => {
    setExporting(true);
    fetch(`http://localhost:3000/api/reports/export/${exportFormat}?type=${exportType}`, { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ສົ່ງອອກລາຍງານບໍ່ສຳເລັດ');
        }
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportType}-report.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => alert(err.message))
      .finally(() => setExporting(false));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ບົດລາຍງານສະຫຼຸບ ແລະ ວິເຄາະ</h1>
            <p className="text-sm text-gray-500 mt-1">ສະຖິຕິ ແລະ ປະສິດທິພາບການເຮັດວຽກຂອງລະບົບ (Analytics)</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Download size={18} />
              <span>{exporting ? 'ກຳລັງສົ່ງອອກ...' : 'ສົ່ງອອກລາຍງານ'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ປັນຫາທັງໝົດ (ຕາມພະແນກ)</p>
            <h3 className="text-3xl font-bold text-gray-800">{loading ? '-' : totalTickets}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ອັດຕາການເຮັດຕາມ SLA</p>
            <h3 className="text-3xl font-bold text-green-600">
              {loading || slaRate === null || slaRate === undefined ? '-' : `${Math.round(slaRate * 100)}%`}
            </h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ຄະແນນຄວາມພໍໃຈ (CSAT)</p>
            <h3 className="text-3xl font-bold text-amber-500">
              {loading || csatAvg === null ? '-' : csatAvg.toFixed(1)}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-gray-400" />
              ປັນຫາຕາມພະແນກ
            </h3>
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</div>
            ) : data?.tickets?.byDepartment?.length > 0 ? (
              <div className="space-y-2.5">
                {data.tickets.byDepartment.map((d) => {
                  const max = Math.max(1, ...data.tickets.byDepartment.map(x => x.count));
                  return (
                    <div key={d.id}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{d.name}</span>
                        <span className="font-medium text-gray-700">{d.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຂໍ້ມູນ</div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800">ວຽກງານຂອງເຈົ້າໜ້າທີ່</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                    <th className="p-3 font-medium">ເຈົ້າໜ້າທີ່</th>
                    <th className="p-3 font-medium">ໄດ້ຮັບມອບໝາຍ</th>
                    <th className="p-3 font-medium">ແກ້ໄຂແລ້ວ</th>
                    <th className="p-3 font-medium">ເວລາສະເລ່ຍ (ນທ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {loading ? (
                    <tr><td colSpan="4" className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດ...</td></tr>
                  ) : data?.workload?.length > 0 ? (
                    data.workload.map((w) => (
                      <tr key={w.id}>
                        <td className="p-3">{w.name}</td>
                        <td className="p-3">{w.totalAssigned}</td>
                        <td className="p-3">{w.resolved}</td>
                        <td className="p-3">{w.avgResolutionMinutes ? Math.round(w.avgResolutionMinutes) : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" className="py-8 text-center text-sm text-gray-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
