import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, X, AlertCircle, Search, UserCheck, Undo2,
  Wrench, History, AlertTriangle, Trash2, Barcode,
} from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import BarcodeComponent from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../config';

export default function AssetRegistry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const isLocalOrigin = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  const canCreate = hasPermission('assets', 'create');
  const canRead = hasPermission('assets', 'read');
  const canUpdate = hasPermission('assets', 'update');
  const canDelete = hasPermission('assets', 'delete');
  const canAssign = hasPermission('assets', 'assign');

  const [activeTab, setActiveTab] = useState('registry'); // 'registry' | 'overdue'

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState('');

  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");

  const [overdue, setOverdue] = useState([]);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [overdueError, setOverdueError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ assetTag: '', type: '', branchId: '', purchaseDate: '', warrantyExpiry: '' });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const [assignModalAsset, setAssignModalAsset] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [barcodeModalAsset, setBarcodeModalAsset] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function unwrap(body) {
    return body?.data !== undefined ? body.data : body;
  }

  function fetchAssets() {
    setLoadingAssets(true);
    setAssetsError('');
    const branchParam = branchFilter ? `?branchId=${encodeURIComponent(branchFilter)}` : '';
    fetch(`${API_BASE_URL}/assets${branchParam}`, { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດທະບຽນຊັບສິນໄດ້');
        setAssets(unwrap(body) || []);
      })
      .catch((err) => setAssetsError(err.message))
      .finally(() => setLoadingAssets(false));
  }

  function fetchBranches() {
    fetch(`${API_BASE_URL}/branches`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setBranches(unwrap(body) || []))
      .catch(() => setBranches([]));
  }

  function fetchUsers() {
    fetch(`${API_BASE_URL}/users`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setUsers(unwrap(body) || []))
      .catch(() => setUsers([]));
  }

  function fetchDepartments() {
    fetch(`${API_BASE_URL}/departments`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setDepartments(unwrap(body) || []))
      .catch(() => setDepartments([]));
  }

  function fetchOverdue() {
    setLoadingOverdue(true);
    setOverdueError('');
    fetch(`${API_BASE_URL}/assets/overdue`, { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດລາຍງານໄດ້');
        setOverdue(unwrap(body) || []);
      })
      .catch((err) => setOverdueError(err.message))
      .finally(() => setLoadingOverdue(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssets();
    fetchBranches();
    fetchUsers();
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCreateModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('create')]);

  useEffect(() => {
    if (activeTab === 'overdue') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOverdue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const branchName = (id) => branches.find((b) => b._id === id)?.name || id;
  const userName = (id) => {
    const u = users.find((u) => u._id === id);
    return u ? `${u.firstName} ${u.lastName} (${u.employeeCode})` : id;
  };
  const userDeptId = (u) => u?.departmentId?._id || u?.departmentId?.id || u?.departmentId || '';

  const statusInfo = (status) => {
    switch (status) {
      case 'ASSIGNED': return { label: 'ຖືກມອບໝາຍແລ້ວ', className: 'bg-blue-100 text-blue-700' };
      case 'UNDER_REPAIR': return { label: 'ກຳລັງສ້ອມແປງ', className: 'bg-amber-100 text-amber-700' };
      case 'RETIRED': return { label: 'ປົດລະວາງແລ້ວ', className: 'bg-gray-200 text-gray-600' };
      default: return { label: 'ວ່າງ', className: 'bg-green-100 text-green-700' };
    }
  };

  // ຂໍ້ມູນຊັບສິນເປັນຂໍ້ຄວາມฝังลง QR — ສະແກນດ້ວຍกลໍ່ມືຖືເຫັນຂໍ້ມູນທັນທີ ໂດຍບໍ່ຕ້ອງເຊື່ອມຕໍ່ເຊີບເວີ
  const assetInfoText = (a) => {
    const lines = [
      `ຊັບສິນ: ${a.assetTag || '—'}`,
      `ປະເພດ: ${a.type || '—'}`,
      `ສະຖານະ: ${statusInfo(a.status).label}`,
      `ສາຂາ: ${branchName(a.branchId)}`,
      `ຜູ້ດູແລ: ${a.currentAssigneeId ? userName(a.currentAssigneeId) : 'ຍັງບໍ່ມີຜູ້ດູແລ'}`,
    ];
    if (a.purchaseDate) lines.push(`ວັນທີຊື້: ${new Date(a.purchaseDate).toLocaleDateString()}`);
    if (a.warrantyExpiry) lines.push(`ໝົດປະກັນ: ${new Date(a.warrantyExpiry).toLocaleDateString()}`);
    return lines.join('\n');
  };

  const filteredAssets = assets.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (branchFilter && a.branchId !== branchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.assetTag.toLowerCase().includes(q) && !a.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const submitCreate = (e) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError('');
    fetch(`${API_BASE_URL}/assets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...createForm,
        purchaseDate: createForm.purchaseDate || undefined,
        warrantyExpiry: createForm.warrantyExpiry || undefined,
      }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດເພີ່ມຊັບສິນໄດ້');
        setShowCreateModal(false);
        setCreateForm({ assetTag: '', type: '', branchId: '', purchaseDate: '', warrantyExpiry: '' });
        fetchAssets();
      })
      .catch((err) => setCreateError(err.message))
      .finally(() => setCreateSubmitting(false));
  };

  const openAssignModal = (asset) => {
    setAssignModalAsset(asset);
    setAssignUserId('');
    setSelectedDeptId('');
    setAssignNote('');
    setAssignError('');
  };

  const submitAssign = (e) => {
    e.preventDefault();
    if (!assignUserId) {
      setAssignError('ກະລຸນາເລືອກພະນັກງານ');
      return;
    }
    setAssignSubmitting(true);
    setAssignError('');
    fetch(`${API_BASE_URL}/assets/${assignModalAsset._id}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ assigneeId: assignUserId, note: assignNote || undefined }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດມອບໝາຍໄດ້');
        setAssignModalAsset(null);
        fetchAssets();
      })
      .catch((err) => setAssignError(err.message))
      .finally(() => setAssignSubmitting(false));
  };

  function callAction(id, path, method, body, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id);
    fetch(`${API_BASE_URL}/assets/${id}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
      .then((res) => res.json().then((responseBody) => ({ ok: res.ok, responseBody })))
      .then(({ ok, responseBody }) => {
        if (!ok) throw new Error(responseBody?.msg || 'ດຳເນີນການບໍ່ສຳເລັດ');
        fetchAssets();
      })
      .catch((err) => alert(err.message))
      .finally(() => setBusyId(null));
  }

  const handleReturn = (a) => callAction(a._id, '/return', 'PATCH', {}, `ຢືນຢັນວ່າ ${a.assetTag} ຖືກສົ່ງຄືນແລ້ວ?`);
  const handleSetStatus = (a, status) => callAction(a._id, '/status', 'PATCH', { status });
  const handleDelete = (a) => callAction(a._id, '', 'DELETE', null, `ລຶບຊັບສິນ ${a.assetTag} ຖາວອນ? ບໍ່ສາມາດກູ້ຄືນໄດ້`);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ທະບຽນຊັບສິນບໍລິສັດ</h1>
            <p className="text-sm text-gray-500 mt-1">Laptop, ຈໍ, ບັດພະນັກງານ, ໂທລະສັບ — ຄົນລະສ່ວນຈາກການຂໍວັດສະດຸສິ້ນເປືອງ</p>
          </div>
          {(canCreate || canRead) && activeTab === 'registry' && (
            <div className="flex items-center gap-2">
              {canCreate && (
                <CsvImportButton
                  endpoint="/assets/bulk-import"
                  refresh={fetchAssets}
                  permitted={canCreate}
                  csvHint="CSV ຊັບສິນ: assetTag, type, branchId — ຈຳເປັນ; purchaseDate (YYYY-MM-DD), warrantyExpiry (YYYY-MM-DD) — ເພີ່ມໄດ້"
                />
              )}
              <CsvExportButton
                data={filteredAssets}
                filename="assets.csv"
                label="Export CSV"
                permitted={canRead}
                columns={[
                  { key: 'assetTag', label: 'assetTag' },
                  { key: 'type', label: 'type' },
                  { label: 'branch', value: (r) => branchName(r.branchId) },
                  { label: 'status', value: (r) => statusInfo(r.status).label },
                  { label: 'assignee', value: (r) => (r.currentAssigneeId ? userName(r.currentAssigneeId) : '') },
                  { key: 'purchaseDate', label: 'purchaseDate' },
                  { key: 'warrantyExpiry', label: 'warrantyExpiry' },
                  { key: '_id', label: 'id' },
                ]}
              />
              {canCreate && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={18} /> <span>ເພີ່ມຊັບສິນ</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'registry' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ທະບຽນຊັບສິນ
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'overdue' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍງານກວດສອບ — ຄ້າງສົ່ງຄືນ
            {overdue.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{overdue.length}</span>
            )}
          </button>
        </div>

        {activeTab === 'registry' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ຄົ້ນຫາ ASSET TAG ຫຼືປະເພດ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">ທຸກສະຖານະ</option>
                <option value="AVAILABLE">ວ່າງ</option>
                <option value="ASSIGNED">ຖືກມອບໝາຍແລ້ວ</option>
                <option value="UNDER_REPAIR">ກຳລັງສ້ອມແປງ</option>
                <option value="RETIRED">ປົດລະວາງແລ້ວ</option>
              </select>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">ທຸກສາຂາ</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>

            {assetsError && <div className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertCircle size={16} />{assetsError}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="p-3 font-medium">Asset Tag</th>
                    <th className="p-3 font-medium">ສາຂາ</th>
                    <th className="p-3 font-medium">ສະຖານະ</th>
                    <th className="p-3 font-medium">ຜູ້ຖືກມອບໝາຍ</th>
                    <th className="p-3 font-medium">ວັນໝົດປະກັນ</th>
                    <th className="p-3 font-medium text-center">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingAssets && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-gray-500">ກຳລັງໂຫຼດ...</td>
                    </tr>
                  )}
                  {!loadingAssets && filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-gray-500">ບໍ່ພົບຊັບສິນທີ່ຄ້າຍຄື</td>
                    </tr>
                  )}
                  {filteredAssets.map((a) => {
                    const info = statusInfo(a.status);
                    return (
                      <tr key={a._id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${a._id}`)}
                            className="font-semibold text-gray-800 hover:text-amber-600 hover:underline"
                            title="ເປີດໜ້າລາຍລະອຽດຊັບສິນ"
                          >
                            {a.assetTag}
                          </button>
                        </td>
                        <td className="p-3 text-gray-500">{branchName(a.branchId)}</td>
                        <td className="p-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${info.className}`}>{info.label}</span></td>
                        <td className="p-3 text-gray-500">{a.currentAssigneeId ? userName(a.currentAssigneeId) : '—'}</td>
                        <td className="p-3 text-gray-500">{a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : '—'}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button onClick={() => navigate(`/assets/${a._id}?tab=maintenance`)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="ປະຫວັດການສ້ອມແປງ">
                              <History size={15} />
                            </button>
                            <button onClick={() => setBarcodeModalAsset(a)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="ສະແດງ Barcode">
                              <Barcode size={15} />
                            </button>
                            {canAssign && a.status !== 'RETIRED' && a.status !== 'ASSIGNED' && (
                              <button onClick={() => openAssignModal(a)} disabled={busyId === a._id} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="ມອບໝາຍໃຫ້ພະນັກງານ">
                                <UserCheck size={15} />
                              </button>
                            )}
                            {canAssign && a.status === 'ASSIGNED' && (
                              <button onClick={() => handleReturn(a)} disabled={busyId === a._id} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="ຮັບຄືນ">
                                <Undo2 size={15} />
                              </button>
                            )}
                            {canUpdate && a.status !== 'RETIRED' && a.status !== 'UNDER_REPAIR' && (
                              <button onClick={() => handleSetStatus(a, 'UNDER_REPAIR')} disabled={busyId === a._id} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title="ສົ່ງສ້ອມແປງ">
                                <Wrench size={15} />
                              </button>
                            )}
                            {canUpdate && a.status === 'UNDER_REPAIR' && (
                              <button onClick={() => handleSetStatus(a, 'AVAILABLE')} disabled={busyId === a._id} className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100" title="ສ້ອມແປງແລ້ວ">
                                ✓ ແລ້ວ
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(a)} disabled={busyId === a._id} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="ລຶບຊັບສິນ">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'overdue' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="font-bold text-gray-800">ຊັບສິນທີ່ຍັງບໍ່ໄດ້ສົ່ງຄືນ</div>
              <p className="text-xs text-gray-500 mt-0.5">ພະນັກງານທີ່ຖືກປິດການໃຊ້ງານ (offboard/ໂອນຍ້າຍ) ແຕ່ຍັງບໍ່ໄດ້ສົ່ງອຸປະກອນຄືນ</p>
            </div>
            {overdueError && <div className="p-4 text-sm text-red-600">{overdueError}</div>}
            {loadingOverdue ? (
              <div className="p-6 text-center text-sm text-gray-500">ກຳລັງໂຫຼດ...</div>
            ) : overdue.length === 0 && !overdueError ? (
              <div className="p-6 text-center text-sm text-gray-500">ບໍ່ມີຊັບສິນຄ້າງສົ່ງຄືນ</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {overdue.map((o) => (
                  <div key={o._id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{o.assetTag} — {o.type}</div>
                        <div className="text-xs text-gray-500">
                          ຄ້າງຢູ່ກັບ {o.assignee?.email} (ພະນັກງານປິດການໃຊ້ງານແລ້ວ) — ສາຂາ {branchName(o.branchId)}
                        </div>
                      </div>
                    </div>
                    {canAssign && (
                      <button
                        onClick={() => handleReturn({ _id: o._id, assetTag: o.assetTag })}
                        disabled={busyId === o._id}
                        className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition disabled:opacity-50"
                      >
                        ໝາຍວ່າຮັບຄືນແລ້ວ
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitCreate} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ເພີ່ມຊັບສິນໃໝ່</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Asset Tag</label>
                <input type="text" required value={createForm.assetTag} onChange={(e) => setCreateForm({ ...createForm, assetTag: e.target.value })} placeholder="A-1042" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ປະເພດ</label>
                <input type="text" required value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} placeholder="Laptop, ຈໍ, ບັດພະນັກງານ..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ</label>
                <select required value={createForm.branchId} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">-- ເລືອກສາຂາ --</option>
                  {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ວັນທີຊື້ (ບໍ່ບັງຄັບ)</label>
                <input type="date" value={createForm.purchaseDate} onChange={(e) => setCreateForm({ ...createForm, purchaseDate: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ໝົດປະກັນ (ບໍ່ບັງຄັບ)</label>
                <input type="date" value={createForm.warrantyExpiry} onChange={(e) => setCreateForm({ ...createForm, warrantyExpiry: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              {createError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
                <button type="submit" disabled={createSubmitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {createSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
                </button>
              </div>
            </form>
          </div>
        )}

        {assignModalAsset && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitAssign} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ມອບໝາຍ {assignModalAsset.assetTag}</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ພະແນກ</label>
                <select value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setAssignUserId(""); }} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">-- ເລືອກພະແນກ --</option>
                  {departments.filter((d) => d.isActive !== false).map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ພະນັກງານ</label>
                <select required value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">-- ເລືອກພະນັກງານ --</option>
                  {users.filter((u) => u.isActive && (!selectedDeptId || userDeptId(u) === selectedDeptId)).map((u) => (
                    <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ໝາຍເຫດ (ບໍ່ບັງຄັບ)</label>
                <input type="text" value={assignNote} onChange={(e) => setAssignNote(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              {assignError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAssignModalAsset(null)} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
                <button type="submit" disabled={assignSubmitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {assignSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ມອບໝາຍ'}
                </button>
              </div>
            </form>
          </div>
        )}

        {barcodeModalAsset && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 text-center">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Barcode & QR</h2>
                <button type="button" onClick={() => setBarcodeModalAsset(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="text-xs font-medium text-gray-600">ຂໍ້ມູນຊັບສິນ (offline)</div>
                <QRCodeSVG
                  value={assetInfoText(barcodeModalAsset)}
                  size={140}
                  level="M"
                  marginSize={2}
                />
                <div className="text-[11px] text-gray-400">ສະແກນດ້ວຍກ້ອງມືຖື — ເຫັນຂໍ້ມູນທັນທີ ໂດຍບໍ່ຕ້ອງເຊື່ອມຕໍ່ server</div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex flex-col items-center justify-center space-y-1">
                <div className="text-xs font-medium text-gray-600">ເປີດໜ້າຢືນຢັນຮັບເຄື່ອງ (online)</div>
                <QRCodeSVG
                  value={`${window.location.origin}/assets/${barcodeModalAsset._id}?claim=1`}
                  size={130}
                  level="M"
                  marginSize={2}
                />
                {isLocalOrigin ? (
                  <div className="text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                    ກຳລັງເປີດຜ່ານ localhost — QR ນີ້ມືຖືຈະເປີດບໍ່ໄດ້.
                    ໃຫ້ເປີດເວັບຜ່ານ http://&lt;IP ຂອງ PC&gt;:5173 ກ່ອນ ແລ້ວສະແກນໃໝ່
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400">ຕ້ອງເຊື່ອມຕໍ່ເຄືອຂ່າຍດຽວກັບເຊີບເວີ — ເປີດໜ້າໃສ່ລະຫັດພະນັກງານທັນທີ</div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-3 flex flex-col items-center justify-center">
                <BarcodeComponent
                  value={barcodeModalAsset.assetTag}
                  format="CODE128"
                  width={2.0}
                  height={50}
                  fontSize={14}
                  displayValue={false}
                  margin={8}
                />
                <div className="mt-1 text-sm font-semibold tracking-widest text-gray-800">
                  {barcodeModalAsset.assetTag}
                </div>
                <div className="text-[11px] text-gray-400">Barcode — ສະແກນເພື່ອກວດສອບເລກທະບຽນ</div>
              </div>
              <div className="pt-2 space-y-2">
                <button 
                  type="button" 
                  onClick={() => { 
                    const id = barcodeModalAsset._id;
                    setBarcodeModalAsset(null); 
                    navigate(`/assets/${id}`); 
                  }} 
                  className="w-full px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition"
                >
                  ເປີດໜ້າລາຍລະອຽດ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = barcodeModalAsset._id;
                    setBarcodeModalAsset(null);
                    navigate(`/assets/${id}?claim=1`);
                  }}
                  className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
                >
                  ຮັບເຄື່ອງ / ຍັນຍົນ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
