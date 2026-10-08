import { useState, useEffect } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import { useBranch } from '../contexts/BranchContext';
import { API_BASE_URL } from '../config';

const REPORT_TYPE_LABELS = {
  sla: 'SLA Compliance',
  tickets: 'ແຍກຕາມພະແນກ/ສາຂາ/ປະເພດ/ເຈົ້າໜ້າທີ່',
  workload: 'ວຽກງານຂອງເຈົ້າໜ້າທີ່',
  csat: 'ຄວາມພໍໃຈ (CSAT)',
};

function SlaDonut({ percent, loading }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const hasData = !loading && percent !== null && percent !== undefined;
  const color = percent >= 90 ? '#16a34a' : percent >= 70 ? '#f59e0b' : '#dc2626';

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 240 165" className="w-full max-w-[260px]">
        <circle cx="120" cy="83" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {hasData && (
          <circle
            cx="120"
            cy="83"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            transform="rotate(-90 120 83)"
          />
        )}
      </svg>
      {/* translate="no": Google Translate ຂອງ browser ເຮັດໃຫ້ React ອັບເດດຕົວເລກບໍ່ໄດ້ (ຄ້າງ "-") */}
      <div translate="no" className="text-2xl font-bold text-gray-800">
        <span>{hasData ? `${percent}%` : loading ? '-' : 'N/A'}</span>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
          ປະຕິບັດຕາມ SLA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
          ບໍ່ໄດ້ຕາມ SLA
        </span>
      </div>
    </div>
  );
}

function CsatDonut({ value, loading }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const min = 1;
  const max = 5;
  const hasData = typeof value === 'number' && !Number.isNaN(value);
  const clamped = hasData ? Math.max(min, Math.min(max, value)) : 0;
  const fill = clamped / max; // 4.2 / 5 = 84% ຂອງວົງ
  const pct = (clamped - min) / (max - min);
  const color = pct < 0.35 ? '#dc2626' : pct < 0.65 ? '#f59e0b' : '#16a34a';

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 240 165" className="w-full max-w-[260px]">
        <circle cx="120" cy="83" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {hasData && (
          <circle
            cx="120"
            cy="83"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${fill * circumference} ${circumference}`}
            transform="rotate(-90 120 83)"
          />
        )}
      </svg>
      <div translate="no" className="text-2xl font-bold text-gray-800">
        <span>{hasData ? value.toFixed(1) : loading ? '-' : 'N/A'}</span>
        {hasData && <span className="text-sm text-gray-400 font-medium"> / 5</span>}
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: hasData ? color : '#16a34a' }} />
          ຄະແນນເຉລ່ຍ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
          ຄະແນນເຕັມ 5
        </span>
      </div>
    </div>
  );
}

export default function Reports() {
  const { selectedBranchId } = useBranch();
  const canExport = hasPermission('reports', 'export');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportType, setExportType] = useState('tickets');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    const branchParam = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : '';
    fetch(`${API_BASE_URL}/reports/summary${branchParam}`, { headers })
      .then(async res => {
        if (res.status === 403) {
          throw new Error('ບໍ່ມີສິດເຂົ້າເຖິງລາຍງານ (reports:read)');
        }
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.msg || result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(body => {
        if (cancelled) return;
        setData(body?.data ?? body);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const totalTickets = data?.tickets?.byDepartment?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const slaRate = data?.sla?.complianceRate;
  const csatByAgent = data?.csat?.byAgent || [];
  const csatAvg = csatByAgent.length > 0
    ? csatByAgent.reduce((sum, a) => sum + a.avgRating * a.count, 0) / csatByAgent.reduce((sum, a) => sum + a.count, 0)
    : null;

  const handleExport = () => {
    setExporting(true);
    const branchParam = selectedBranchId ? `&branchId=${encodeURIComponent(selectedBranchId)}` : '';
    fetch(`${API_BASE_URL}/reports/export/${exportFormat}?type=${exportType}${branchParam}`, { headers })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.msg || result.message || 'ສົ່ງອອກລາຍງານບໍ່ສຳເລັດ');
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
            {canExport && (
              <>
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
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <p className="text-sm text-gray-500">ປັນຫາທັງໝົດ (ຕາມພະແນກ)</p>
            <div className="flex-1 flex items-center justify-center">
              <h3 translate="no" className="text-5xl font-bold text-gray-800"><span>{loading ? '-' : totalTickets}</span></h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ອັດຕາການເຮັດຕາມ SLA</p>
            <SlaDonut percent={loading ? null : slaRate === null || slaRate === undefined ? null : Math.round(slaRate * 100)} loading={loading} />
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <p className="text-sm text-gray-500">ຄະແນນຄວາມພໍໃຈ (CSAT)</p>
            <CsatDonut value={csatAvg} loading={loading} />
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
