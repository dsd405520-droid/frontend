import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Laptop, Wrench, AlertCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { hasPermission } from '../utils/permissions';
import { API_BASE_URL } from '../config';

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const token = localStorage.getItem('token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const canUpdate = hasPermission('assets', 'update');

  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Modal ສ້ອມແປງ
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairForm, setRepairForm] = useState({ description: '', cost: '', vendor: '' });
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [repairError, setRepairError] = useState('');

  function unwrap(body) {
    return body?.data !== undefined ? body.data : body;
  }

  function fetchAssetDetail(quiet = false) {
    if (!quiet) setLoading(true);
    setError('');
    fetch(`${API_BASE_URL}/assets/${id}`, { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຊັບສິນໄດ້');
        setAsset(unwrap(body));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function fetchMaintenanceLogs() {
    setLoadingLogs(true);
    fetch(`${API_BASE_URL}/assets/${id}/maintenance`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setMaintenanceLogs(unwrap(body) || []))
      .catch(() => setMaintenanceLogs([]))
      .finally(() => setLoadingLogs(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssetDetail();
    fetchMaintenanceLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const submitRepair = (e) => {
    e.preventDefault();
    setRepairSubmitting(true);
    setRepairError('');
    fetch(`${API_BASE_URL}/assets/${id}/maintenance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...repairForm,
        cost: repairForm.cost ? Number(repairForm.cost) : undefined,
      }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດບັນທຶກປະຫວັດການສ້ອມແປງໄດ້');
        setShowRepairModal(false);
        setRepairForm({ description: '', cost: '', vendor: '' });
        fetchMaintenanceLogs();
        fetchAssetDetail(true);
      })
      .catch((err) => setRepairError(err.message))
      .finally(() => setRepairSubmitting(false));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64 text-gray-500">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
      </MainLayout>
    );
  }

  if (error || !asset) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <button onClick={() => navigate('/assets')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> ກັບຄືນທະບຽນຊັບສິນ
          </button>
          <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2">
            <AlertCircle size={18} /> {error || 'ບໍ່ພົບຊັບສິນນີ້'}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/assets')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
            <ArrowLeft size={16} /> ກັບຄືນທະບຽນຊັບສິນ
          </button>
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => setShowRepairModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
              >
                <Wrench size={16} /> <span>ບັນທຶກການສ້ອມແປງ</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Laptop size={24} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{asset.assetTag}</div>
              <div className="text-sm text-gray-500 mt-0.5">ປະເພດ: {asset.type}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
              asset.status === 'UNDER_REPAIR' ? 'bg-amber-100 text-amber-700' :
              asset.status === 'RETIRED' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'
            }`}>
              {asset.status}
            </span>
          </div>
        </div>

        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => handleTabChange('overview')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'overview' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍລະອຽດທົ່ວໄປ
          </button>
          <button
            onClick={() => handleTabChange('maintenance')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'maintenance' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ປະຫວັດການສ້ອມແປງ ({maintenanceLogs.length})
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">ຂໍ້ມູນທົ່ວໄປ</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ວັນທີຊື້</span>
                  <span className="font-medium text-gray-800">{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ວັນໝົດປະກັນ</span>
                  <span className="font-medium text-gray-800">{asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800">ປະຫວັດການສ້ອມແປງ ແລະ บຳລຸງຮັກສາ</div>
            <div className="divide-y divide-gray-100">
              {loadingLogs ? (
                <div className="p-6 text-center text-sm text-gray-500">ກຳລັງໂຫຼດ...</div>
              ) : maintenanceLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">ຍังບໍ່ມີປະຫວັດການສ້ອມແປງ</div>
              ) : (
                maintenanceLogs.map((log) => (
                  <div key={log._id || log.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-gray-800">{log.description}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {log.vendor ? `ຮ້ານ/ຜູ້ໃຫ້ບໍລິການ: ${log.vendor} — ` : ''}
                        ວັນທີ: {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    {log.cost > 0 && (
                      <div className="text-sm font-bold text-gray-700">{log.cost.toLocaleString()} ₭</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showRepairModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitRepair} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ບັນທຶກການສ້ອມແປງ</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ລາຍລະອຽດການສ້ອມແປງ</label>
                <textarea required rows={3} value={repairForm.description} onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value })} placeholder="ປ່ຽນແບັດເຕີຣີ, ສ້ອມແປງຈໍ..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ລາຄາ (ກີບ)</label>
                <input type="number" value={repairForm.cost} onChange={(e) => setRepairForm({ ...repairForm, cost: e.target.value })} placeholder="0" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຮ້ານ/ຜູ້ໃຫ້ບໍລິການ</label>
                <input type="text" value={repairForm.vendor} onChange={(e) => setRepairForm({ ...repairForm, vendor: e.target.value })} placeholder="ຊື່ຮ້ານ..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              {repairError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{repairError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRepairModal(false)} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
                <button type="submit" disabled={repairSubmitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {repairSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
