import React, { useEffect, useState } from 'react';
import {
  Laptop, Plus, X, Loader2, AlertCircle, Search, UserCheck, Undo2,
  Wrench, History, AlertTriangle, Trash2,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { hasPermission } from '../utils/permissions';

const API_BASE_URL = 'http://localhost:3000/api';

// ທະບຽນຊັບສິນບໍລິສັດ (laptop, ຈໍ, ບັດພະນັກງານ, ໂທລະສັບ) — ຄົນລະສ່ວນຈາກ Supply Requests (ວັດສະດຸສິ້ນເປືອງ)
// ອີງໃສ່ backend module 'assets' (assign/return/status/delete ຄົບແລ້ວ), ຄົນລະ module key ຈາກ 'supplies' ທີ່ໜ້າ AssetManagement.jsx ໃຊ້ຢູ່
export default function AssetRegistry() {
  const token = localStorage.getItem('token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const canCreate = hasPermission('assets', 'create');
  const canUpdate = hasPermission('assets', 'update');
  const canDelete = hasPermission('assets', 'delete');
  const canAssign = hasPermission('assets', 'assign');

  const [activeTab, setActiveTab] = useState('registry'); // 'registry' | 'overdue'

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState('');

  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);

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

  const [historyModalAsset, setHistoryModalAsset] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function unwrap(body) {
    return body?.data !== undefined ? body.data : body;
  }

  useEffect(() => {
    fetchAssets();
    fetchBranches();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'overdue') fetchOverdue();
  }, [activeTab]);

  function fetchAssets() {
    setLoadingAssets(true);
    setAssetsError('');
    fetch(`${API_BASE_URL}/assets`, { headers })
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
      .catch(() => setUsers([])); // ອາດບໍ່ມີສິດ users:read — ບໍ່ໃຫ້ຄ້າງທັງໜ້າ
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

  const branchName = (id) => branches.find((b) => b._id === id)?.name || id;
  const userName = (id) => {
    const u = users.find((u) => u._id === id);
    return u ? `${u.firstName} ${u.lastName} (${u.employeeCode})` : id;
  };

  const statusInfo = (status) => {
    switch (status) {
      case 'ASSIGNED': return { label: 'ຖືກມອບໝາຍແລ້ວ', className: 'bg-blue-100 text-blue-700' };
      case 'UNDER_REPAIR': return { label: 'ກຳລັງສ້ອມແປງ', className: 'bg-amber-100 text-amber-700' };
      case 'RETIRED': return { label: 'ປົດລະວາງແລ້ວ', className: 'bg-gray-200 text-gray-600' };
      default: return { label: 'ວ່າງ', className: 'bg-green-100 text-green-700' };
    }
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

  // ---- Create ----
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

  // ---- Assign ----
  const openAssignModal = (asset) => {
    setAssignModalAsset(asset);
    setAssignUserId('');
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

  // ---- Return / Status / Delete ----
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
          {canCreate && activeTab === 'registry' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} /> <span>ເພີ່ມຊັບສິນ</span>
            </button>
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

        {/* ແຖບ 1: ທະບຽນຊັບສິນ */}
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
            {loadingAssets ? (
              <div className="p-10 text-center text-gray-400"><Loader2 className="animate-spin inline" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="p-3 font-medium">Asset Tag</th>
                      <th className="p-3 font-medium">ປະເພດ</th>
                      <th className="p-3 font-medium">ສາຂາ</th>
                      <th className="p-3 font-medium">ສະຖານະ</th>
                      <th className="p-3 font-medium">ຜູ້ຖືກມອບໝາຍ</th>
                      <th className="p-3 font-medium">ໝົດປະກັນ</th>
                      <th className="p-3 font-medium text-center">ຈັດການ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAssets.map((a) => {
                      const info = statusInfo(a.status);
                      return (
                        <tr key={a._id} className="hover:bg-gray-50">
                          <td className="p-3 font-semibold text-gray-800">{a.assetTag}</td>
                          <td className="p-3 flex items-center gap-1.5"><Laptop size={14} className="text-gray-400" />{a.type}</td>
                          <td className="p-3 text-gray-500">{branchName(a.branchId)}</td>
                          <td className="p-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${info.className}`}>{info.label}</span></td>
                          <td className="p-3 text-gray-500">{a.currentAssigneeId ? userName(a.currentAssigneeId) : '—'}</td>
                          <td className="p-3 text-gray-500">{a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : '—'}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button onClick={() => setHistoryModalAsset(a)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="ປະຫວັດການມອບໝາຍ">
                                <History size={15} />
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
                              {canUpdate && a.status !== 'RETIRED' && (
                                <button onClick={() => handleSetStatus(a, 'RETIRED')} disabled={busyId === a._id} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="ປົດລະວາງ">
                                  <AlertTriangle size={15} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDelete(a)} disabled={busyId === a._id} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="ລຶບຖາວອນ">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAssets.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-400">ບໍ່ພົບຊັບສິນ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ແຖບ 2: ລາຍງານຄ້າງສົ່ງຄືນ — ຊັບສິນທີ່ຍັງ "ASSIGNED" ຢູ່ ແຕ່ພະນັກງານຄົນນັ້ນອອກ/ຖືກປິດການໃຊ້ງານແລ້ວ (isActive: false) */}
        {activeTab === 'overdue' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="font-bold text-gray-800">ຊັບສິນທີ່ຍັງບໍ່ໄດ້ສົ່ງຄືນ</div>
              <p className="text-xs text-gray-500 mt-0.5">ພະນັກງານທີ່ຖືກປິດການໃຊ້ງານ (offboard/ໂອນຍ້າຍ) ແຕ່ຍັງບໍ່ໄດ້ສົ່ງອຸປະກອນຄືນ</p>
            </div>
            {overdueError && <div className="p-4 text-sm text-red-600">{overdueError}</div>}
            {loadingOverdue ? (
              <div className="p-10 text-center text-gray-400"><Loader2 className="animate-spin inline" /></div>
            ) : overdue.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">✓ ບໍ່ມີຊັບສິນຄ້າງສົ່ງຄືນ</div>
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

        {/* Modal: ເພີ່ມຊັບສິນໃໝ່ */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitCreate} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ເພີ່ມຊັບສິນໃໝ່</h2>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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

        {/* Modal: ມອບໝາຍ */}
        {assignModalAsset && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitAssign} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ມອບໝາຍ {assignModalAsset.assetTag}</h2>
                <button type="button" onClick={() => setAssignModalAsset(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ພະນັກງານ</label>
                <select required value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">-- ເລືອກພະນັກງານ --</option>
                  {users.filter((u) => u.isActive).map((u) => (
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

        {/* Modal: ປະຫວັດການມອບໝາຍ */}
        {historyModalAsset && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ປະຫວັດ — {historyModalAsset.assetTag}</h2>
                <button onClick={() => setHistoryModalAsset(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              {(historyModalAsset.assignmentHistory || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">ຍັງບໍ່ເຄີຍຖືກມອບໝາຍ</p>
              ) : (
                <div className="space-y-2">
                  {[...historyModalAsset.assignmentHistory].reverse().map((h, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 text-sm">
                      <div className="font-medium text-gray-800">{userName(h.assigneeId)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(h.assignedAt).toLocaleString()} — {h.returnedAt ? new Date(h.returnedAt).toLocaleString() : <span className="text-blue-600 font-medium">ຍັງຖືຢູ່</span>}
                      </div>
                      {h.note && <div className="text-xs text-gray-500 mt-1 italic">"{h.note}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
