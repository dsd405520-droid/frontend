import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Laptop, Wrench, AlertCircle, UserCheck, X, CheckCircle2, History } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { hasPermission, getCurrentUser } from '../utils/permissions';
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

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modal ຍັນຍົນຮັບເຄື່ອງ — ມອບໝາຍໃຫ້ຜູ້ທີ່ກຳລັງ login ເທົ່ານັ້ນ (PATCH /assets/:id/claim)
  const currentUser = getCurrentUser();
  const claimUser = users.find((u) => u._id === currentUser?._id) || currentUser;
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimDone, setClaimDone] = useState(false);

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
    fetch(`${API_BASE_URL}/maintenance-history/asset/${id}`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setMaintenanceLogs(unwrap(body) || []))
      .catch(() => setMaintenanceLogs([]))
      .finally(() => setLoadingLogs(false));
  }

  function fetchLookups() {
    fetch(`${API_BASE_URL}/users`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setUsers(unwrap(body) || []))
      .catch(() => setUsers([]));
    fetch(`${API_BASE_URL}/branches`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setBranches(unwrap(body) || []))
      .catch(() => setBranches([]));
    fetch(`${API_BASE_URL}/departments`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setDepartments(unwrap(body) || []))
      .catch(() => setDepartments([]));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssetDetail();
    fetchMaintenanceLogs();
    fetchLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // ສະແກນ QR/ບາໂຄ໊ດ → /assets/:id?claim=1 ເປີດໜ້າຢືນຢັນຮັບເຄື່ອງອັດຕະໂນມັດ
  useEffect(() => {
    if (searchParams.get('claim') === '1' && asset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClaimOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('claim');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, asset]);

  const openClaim = () => {
    setClaimError('');
    setClaimDone(false);
    setClaimOpen(true);
  };

  const closeClaim = () => {
    const wasDone = claimDone;
    setClaimOpen(false);
    setClaimError('');
    setClaimDone(false);
    if (wasDone) fetchAssetDetail(true);
  };

  const confirmClaim = () => {
    setClaimSubmitting(true);
    setClaimError('');
    fetch(`${API_BASE_URL}/assets/${id}/claim`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        note: 'ຮັບເຄື່ອງດ້ວຍຕົນເອງ — ຢືນຢັນຕົວຕົນຂອງຜູ້ໃຊ້ທີ່ກຳລັງ login',
      }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດບັນທຶກການຮັບເຄື່ອງໄດ້');
        setClaimDone(true);
      })
      .catch((err) => setClaimError(err.message))
      .finally(() => setClaimSubmitting(false));
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const branchName = (bid) => {
    if (bid && typeof bid === 'object') return bid.name || '—';
    return branches.find((b) => b._id === bid)?.name || '—';
  };

  const deptName = (d) => {
    if (!d) return '—';
    if (typeof d === 'object') return d.name || '—';
    return departments.find((x) => x._id === d)?.name || '—';
  };

  const assignee = (() => {
    const ref = asset?.currentAssigneeId;
    if (!ref) return null;
    if (typeof ref === 'object') return ref;
    return users.find((u) => u._id === ref) || null;
  })();

  const assigneeLabel = assignee
    ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() + (assignee.employeeCode ? ` (${assignee.employeeCode})` : '')
    : 'ຍັງບໍ່ມີຜູ້ດູແລ';

  const assigneeName = (uid) => {
    if (!uid) return '—';
    const u = users.find((x) => x._id === uid);
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() + (u.employeeCode ? ` (${u.employeeCode})` : '') : uid;
  };

  const lastMaintenanceAt = maintenanceLogs.reduce((latest, log) => {
    const t = log.createdAt ? new Date(log.createdAt).getTime() : 0;
    return t > latest ? t : latest;
  }, 0);

  const submitRepair = (e) => {
    e.preventDefault();
    setRepairSubmitting(true);
    setRepairError('');
    fetch(`${API_BASE_URL}/maintenance-history`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assetId: id,
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
          <button onClick={() => navigate('/asset-registry')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
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
          <button onClick={() => navigate('/asset-registry')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">
            <ArrowLeft size={16} /> ກັບຄືນທະບຽນຊັບສິນ
          </button>
          <div className="flex items-center gap-2">
            {asset.status === 'AVAILABLE' && (
              <button
                onClick={openClaim}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
              >
                <UserCheck size={16} /> <span>ຮັບເຄື່ອງ / ຍັນຍົນ</span>
              </button>
            )}
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
              <div className="text-sm mt-1 flex items-center gap-1.5">
                <span className="text-gray-500">ຜູ້ດູແລ:</span>
                <span className={`font-medium ${assignee ? 'text-blue-600' : 'text-gray-400'}`}>{assigneeLabel}</span>
              </div>
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
          <button
            onClick={() => handleTabChange('assignment')}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-1.5 ${activeTab === 'assignment' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <History size={14} />
            ປະຫວັດການມອບໝາຍ ({Array.isArray(asset.assignmentHistory) ? asset.assignmentHistory.length : 0})
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">ຂໍ້ມູນທົ່ວໄປ</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ປະເພດ</span>
                  <span className="font-medium text-gray-800">{asset.type || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ສາຂາ</span>
                  <span className="font-medium text-gray-800">{branchName(asset.branchId)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ສະຖານະ</span>
                  <span className="font-medium text-gray-800">{asset.status || '—'}</span>
                </div>
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
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">ການດູແລຮັກສາ</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ຜູ້ດູແລ/ຜູ້ຖືກມອບໝາຍ</span>
                  <span className={`font-medium text-right ${assignee ? 'text-blue-600' : 'text-gray-400'}`}>{assigneeLabel}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ພະແນກ</span>
                  <span className="font-medium text-gray-800">
                    {assignee ? (assignee.departmentId?.name || '—') : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ບັນທຶກສ້ອມແປງລ່າສຸດ</span>
                  <span className="font-medium text-gray-800">{lastMaintenanceAt ? new Date(lastMaintenanceAt).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">ຈຳນວນຄັ້ງສ້ອມແປງ</span>
                  <span className="font-medium text-gray-800">{maintenanceLogs.length} ຄັ້ງ</span>
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

        {activeTab === 'assignment' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex items-center gap-2">
              <History size={16} className="text-amber-500" />
              ປະຫວັດການມອບໝາຍ (ຜູ້ຖືຄອງອຸປະກອນ)
            </div>
            <div className="divide-y divide-gray-100">
              {!Array.isArray(asset.assignmentHistory) || asset.assignmentHistory.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">ຍັງບໍ່ເຄີຍຖືກມອບໝາຍ</div>
              ) : (
                [...asset.assignmentHistory].reverse().map((h, i) => (
                  <div key={h._id || i} className="p-4 text-sm">
                    <div className="font-semibold text-gray-800">{assigneeName(h.assigneeId)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {h.assignedAt ? new Date(h.assignedAt).toLocaleString() : '—'} —{' '}
                      {h.returnedAt ? new Date(h.returnedAt).toLocaleString() : <span className="text-blue-600 font-medium">ຍັງຖືຢູ່</span>}
                    </div>
                    {h.note && <div className="text-xs text-gray-500 mt-1 italic">"{h.note}"</div>}
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
        {claimOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ຢືນຢັນການຮັບເຄື່ອງ</h2>
                <button type="button" onClick={closeClaim} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {asset.status !== 'AVAILABLE' && !claimDone && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  ອຸປະກອນນີ້ບໍ່ວ່າງ (ສະຖານະ: {asset.status}) — ບໍ່ສາມາດຮັບໄດ້
                </div>
              )}

              {claimDone ? (
                <div className="text-center space-y-3 py-2">
                  <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
                  <div className="font-semibold text-gray-800">ບັນທຶກການຮັບເຄື່ອງສຳເລັດ</div>
                  <div className="text-sm text-gray-500">
                    {asset.assetTag} → {claimUser ? `${claimUser.firstName || ''} ${claimUser.lastName || ''}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={closeClaim}
                    className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition"
                  >
                    ເປີດໜ້າລາຍລະອຽດ
                  </button>
                </div>
              ) : !claimUser ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  ບໍ່ສາມາດຢືນຢັນຕົວຕົນໄດ້ — ກະລຸນາ login ໃໝ່ແລ້ວລອງໃໝ່
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    ຈະມອບໝາຍ {asset.assetTag} ໃຫ້ບັນຊີທີ່ກຳລັງ login ເທົ່ານັ້ນ (ບໍ່ສາມາດກຳນົດໃຫ້ບຸກຄົນອື່ນໄດ້):
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ຊື່-ນາມສະກຸນ</span>
                      <span className="font-medium text-gray-800">{claimUser.firstName} {claimUser.lastName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ລະຫັດພະນັກງານ</span>
                      <span className="font-medium text-gray-800">{claimUser.employeeCode || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ສະຖານະ</span>
                      <span className={`font-medium ${claimUser.isActive !== false ? 'text-emerald-600' : 'text-red-600'}`}>
                        {claimUser.isActive !== false ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ສາຂາ</span>
                      <span className="font-medium text-gray-800 text-right">{branchName(claimUser.branchId)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ພະແນກ</span>
                      <span className="font-medium text-gray-800 text-right">{deptName(claimUser.departmentId)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ເບີໂທ</span>
                      <span className="font-medium text-gray-800">{claimUser.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">ອີເມວ</span>
                      <span className="font-medium text-gray-800 text-right break-all">{claimUser.email || '—'}</span>
                    </div>
                  </div>
                  {claimError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{claimError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={closeClaim} className="px-4 py-2 text-sm text-gray-600">
                      ຍົກເລີກ
                    </button>
                    <button
                      type="button"
                      onClick={confirmClaim}
                      disabled={claimSubmitting || asset.status !== 'AVAILABLE'}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {claimSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ຍັນຍົນຮັບເຄື່ອງ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
