import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, X, AlertCircle, Search, UserCheck, Undo2,
  Wrench, History, AlertTriangle, Trash2, Barcode, Archive, Camera,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { hasPermission, getCurrentUser } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import CameraScanner from '../components/CameraScanner';
import AssetTagVisual from '../components/AssetTagVisual';
import { API_BASE_URL } from '../config';

export default function AssetRegistry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const publicBaseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const claimBaseUrl = publicBaseUrl || window.location.origin;
  const isLocalOrigin = !publicBaseUrl && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  // ຖ້າເປີດຜ່ານ IP ກົງ (ບໍ່ມີ domain) ແລະບໍ່ໄດ້ຕັ້ງ VITE_PUBLIC_BASE_URL — QR ພິມໄວ້ຈະຝັງ IP ນັ້ນໄວ້
  const isIpOrigin = !publicBaseUrl && /^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname);

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
  const [catalog, setCatalog] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");

  const [overdue, setOverdue] = useState([]);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [overdueError, setOverdueError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  // ເພີ່ມຊັບສິນ (ຫຼາຍລາຍການພ້ອມກັນ) — ໃຊ້ໜ້າຕ່າງດຽວກັນທັງ "ເພີ່ມປົກກະຕິ" ແລະ "ເພີ່ມຕາມໃບຂໍ" (/asset-registry?fromRequest=SR028)
  const MAX_BATCH = 50;
  const rowSeq = useRef(0);
  const newRow = (over = {}) => ({
    id: ++rowSeq.current, catalogSearch: '', catalogItemId: '', name: '', qty: 1,
    assetTag: '', purchaseDate: '', warrantyExpiry: '', showDates: false, ...over,
  });
  const fromRequestId = searchParams.get('fromRequest') || '';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchRows, setBatchRows] = useState([]);
  const [batchBranch, setBatchBranch] = useState('');
  const [batchPurchase, setBatchPurchase] = useState('');
  const [batchWarranty, setBatchWarranty] = useState('');
  const [batchDone, setBatchDone] = useState({});       // rowId → ຈຳນວນທີ່ສ້າງແລ້ວ (ກົດບັນທຶກຊ້ຳ = ຂ້າມສ່ວນທີ່ສ້າງແລ້ວ)
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchFinished, setBatchFinished] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState(() => new Set());
  const [reqData, setReqData] = useState(null);
  const [reqError, setReqError] = useState('');
  const prefilledFor = useRef('');

  const [assignModalAsset, setAssignModalAsset] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  const [barcodeModalAsset, setBarcodeModalAsset] = useState(null);
  const [historyModalAsset, setHistoryModalAsset] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  // id ຂອງຊັບສິນຈາກ QR ທີ່ສະແກນໄດ້ — ຖາມຜູ້ໃຊ້ວ່າຈະຮັບເຄື່ອງ ຫຼື ເບິ່ງລາຍລະອຽດ
  const [scanTargetId, setScanTargetId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // ເລືອກຫຼາຍລາຍການ → ຢືນຢັນຮັບເຄື່ອງທັງໝົດໃນຄັ້ງດຽວ (bulk claim)
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkClaimOpen, setBulkClaimOpen] = useState(false);
  const [bulkClaimSubmitting, setBulkClaimSubmitting] = useState(false);
  const [bulkClaimError, setBulkClaimError] = useState('');
  const [bulkClaimResults, setBulkClaimResults] = useState(null);
  // ຊ່ອງລະຫັດພະນັກງານຂອງຜູ້ມາຮັບ (ສຳລະບັນ assets:assign) — ກວດກັບ /users/lookup/ກ່ອນສົ່ງ claim
  const [bulkClaimCode, setBulkClaimCode] = useState('');
  const [bulkLookup, setBulkLookup] = useState({ state: 'idle', user: null });

  // ຜູ້ຮັບ = ບັນຊີທີ່ກຳລັງ login (claim ຜູກກັບ token ເທົ່ານັ້ນ)
  const currentUser = getCurrentUser();
  const claimUser = users.find(
    (u) => (currentUser?._id && u._id === currentUser._id) || (currentUser?.email && u.email === currentUser.email),
  ) || currentUser;

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

  function fetchCatalog() {
    fetch(`${API_BASE_URL}/supply-catalog`, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setCatalog(unwrap(body) || []))
      .catch(() => setCatalog([]));
  }

  const resetBatch = () => {
    setBatchRows([newRow()]);
    setBatchBranch('');
    setBatchPurchase('');
    setBatchWarranty('');
    setBatchDone({});
    setBatchResult(null);
    setBatchError('');
    setBatchFinished(false);
    setPickerOpen(false);
    setPickerSearch('');
    setPickerSelected(new Set());
  };

  const openCreate = () => {
    resetBatch();
    setShowCreateModal(true);
  };

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
    if (canCreate) fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('create')]);

  // ເປີດຈາກໃບຂໍ: ໂຫຼດໃບຂໍ ແລ້ວເຕີມແຖວທີ່ຂາດໃຫ້ອັດຕະໂນມັດ (ເມື່ອທະບຽນ + Catalog ໂຫຼດແລ້ວ)
  useEffect(() => {
    if (!fromRequestId || !canCreate) return;
    prefilledFor.current = '';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReqData(null);
    setReqError('');
    openCreate();
    fetch(`${API_BASE_URL}/supply-requests/${encodeURIComponent(fromRequestId)}`, { headers })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || 'ບໍ່ສາມາດໂຫຼດໃບຂໍໄດ້');
        setReqData(unwrap(body));
      })
      .catch((err) => setReqError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRequestId]);

  useEffect(() => {
    if (!fromRequestId || !reqData || loadingAssets || catalog.length === 0 || prefilledFor.current === fromRequestId) return;
    prefilledFor.current = fromRequestId;
    const rows = [];
    (reqData.items || []).forEach((it) => {
      const nm = (it.name || '').toLowerCase();
      const cat = catalog.find((c) => (it.catalogItemId && c._id === it.catalogItemId) || (nm && (c.name || '').toLowerCase() === nm));
      const available = assets.filter((a) => {
        if (a.status !== 'AVAILABLE') return false;
        const t = (a.type || '').toLowerCase();
        return (cat && a.catalogItemId === cat._id) || (nm && t && (nm.includes(t) || t.includes(nm)));
      }).length;
      const missing = Math.max(0, (Number(it.quantity) || 0) - available);
      if (missing > 0) rows.push(newRow({ catalogSearch: cat?.name || it.name || '', catalogItemId: cat?._id || '', name: cat?.name || it.name || '', qty: missing }));
    });
    setBatchRows(rows.length > 0 ? rows : [newRow()]);
  }, [fromRequestId, reqData, loadingAssets, catalog, assets]);

  useEffect(() => {
    if (activeTab === 'overdue') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOverdue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ref ອາດກັບມາເປັນ object (populate) ຫຼື string — ຮັບທັງສອງແບບເພື່ອບໍ່ໃຫ້ React ລົ້ມ
  const refId = (v) => (v && typeof v === 'object' ? v._id : v);
  const branchName = (id) => {
    if (id && typeof id === 'object') return id.name || id._id || '—';
    return branches.find((b) => b._id === id)?.name || id;
  };
  const userName = (id) => {
    if (id && typeof id === 'object') {
      const name = `${id.firstName || ''} ${id.lastName || ''}`.trim();
      return name ? `${name}${id.employeeCode ? ` (${id.employeeCode})` : ''}` : id._id || '—';
    }
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

  // QR ພິມເປັນສະຕິກເກີ — ຝັງລິ້ງ /assets/<id>?claim=1 ເທົ່ານັ້ນ (ຕ້ອງ login ກ່ອນເປີດ)
  // ບໍ່ຝັງຂໍ້ມູນຊັບສິນເພື່ອປ້ອງກັນການຮົ່ວໄຫຼຂໍ້ມູນຈາກ QR ທີ່ຖືກພິມໄວ້


  const filteredAssets = assets.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (branchFilter && refId(a.branchId) !== branchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.assetTag.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ກຳຈັດລາຍການທີ່ເລືອກໄວ້ເມື່ປ່ຽນຕົວກອງ/ຄົ້ນຫາ — ບໍ່ໃຫ້ຢືນຢັນຊັບສິນທີ່ເບິ່ງບໍ່ເຫັນອີກ
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [search, statusFilter, branchFilter]);

  const closeCreate = () => {
    setShowCreateModal(false);
    if (fromRequestId) navigate('/asset-registry', { replace: true });
  };

  const updateRow = (id, patch) => setBatchRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setBatchRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  const isBlankRow = (r) => !r.catalogItemId && !(r.name || '').trim() && !(r.assetTag || '').trim();

  // ພິມຊື່/ລະຫັດ Catalog ກົງ → ເຊື່ອມ catalogItemId (ເພື່ອ Backend ສ້າງ Asset Tag ໃຫ້: SC002-001)
  const handleRowCatalog = (id, value) => {
    const clean = value.trim().toLowerCase();
    const matched = catalog.find((c) => (c.name || '').toLowerCase() === clean || (c._id || '').toLowerCase() === clean);
    updateRow(id, { catalogSearch: value, catalogItemId: matched ? matched._id : '', ...(matched ? { name: matched.name } : {}) });
  };

  const assetCountsFor = (catalogItemId) => {
    const list = assets.filter((a) => a.catalogItemId === catalogItemId && a.status !== 'RETIRED');
    return { total: list.length, available: list.filter((a) => a.status === 'AVAILABLE').length };
  };

  const togglePicked = (cid) => setPickerSelected((prev) => {
    const next = new Set(prev);
    if (next.has(cid)) next.delete(cid); else next.add(cid);
    return next;
  });

  const addPicked = () => {
    setBatchRows((prev) => {
      const have = new Set(prev.map((r) => r.catalogItemId).filter(Boolean));
      const keep = prev.filter((r) => !isBlankRow(r));
      const added = catalog
        .filter((c) => pickerSelected.has(c._id) && !have.has(c._id))
        .map((c) => newRow({ catalogSearch: c.name, catalogItemId: c._id, name: c.name }));
      const merged = [...keep, ...added];
      return merged.length > 0 ? merged : [newRow()];
    });
    setPickerSelected(new Set());
    setPickerOpen(false);
  };

  const postAsset = async (payload) => {
    const res = await fetch(`${API_BASE_URL}/assets`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.msg || 'ບໍ່ສາມາດເພີ່ມຊັບສິນໄດ້');
    return unwrap(body);
  };

  const activeRows = batchRows.filter((r) => !isBlankRow(r));
  const batchTotal = activeRows.reduce((sum, r) => sum + Math.max(0, Math.floor(Number(r.qty) || 0)), 0);

  const submitBatch = async (e) => {
    e.preventDefault();
    if (!batchBranch) { setBatchError('ກະລຸນາເລືອກສາຂາ'); return; }
    if (activeRows.length === 0) { setBatchError('ກະລຸນາເພີ່ມຢ່າງໜ້ອຍ 1 ລາຍການ'); return; }
    for (let i = 0; i < activeRows.length; i += 1) {
      const r = activeRows[i];
      const qty = Math.floor(Number(r.qty) || 0);
      const label = `ແຖວທີ່ ${i + 1}`;
      if (!(r.name || '').trim()) { setBatchError(`${label}: ກະລຸນາໃສ່ຊື່/ປະເພດ`); return; }
      if (!r.catalogItemId && !(r.assetTag || '').trim()) { setBatchError(`${label}: ເລືອກລາຍການ Catalog (ສ້າງ Tag ອັດຕະໂນມັດ) ຫຼືໃສ່ Asset Tag`); return; }
      if (qty < 1) { setBatchError(`${label}: ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1`); return; }
      if ((r.assetTag || '').trim() && qty > 1) { setBatchError(`${label}: ໃສ່ Asset Tag ເອງໄດ້ສະເພາະ 1 ຊິ້ນ — ຖ້າຫຼາຍຊິ້ນໃຫ້ປ່ອຍວ່າງ ແລ້ວເລືອກ Catalog`); return; }
    }
    if (batchTotal > MAX_BATCH) { setBatchError(`ສ້າງໄດ້ສູງສຸດ ${MAX_BATCH} ຊິ້ນຕໍ່ຄັ້ງ (ຕອນນີ້ ${batchTotal})`); return; }

    setBatchSubmitting(true);
    setBatchError('');
    const done = { ...batchDone };
    const results = [];
    let failed = false;
    for (const r of activeRows) {
      const want = Math.floor(Number(r.qty) || 1);
      const startOk = done[r.id] || 0;
      let ok = startOk;
      let errMsg = '';
      while (ok < want) {
        try {
          await postAsset({
            assetTag: (r.assetTag || '').trim() || undefined,
            catalogItemId: r.catalogItemId || undefined,
            type: r.name.trim(),
            branchId: batchBranch,
            purchaseDate: r.purchaseDate || batchPurchase || undefined,
            warrantyExpiry: r.warrantyExpiry || batchWarranty || undefined,
          });
          ok += 1;
          done[r.id] = ok;
        } catch (err) {
          errMsg = err.message;
          failed = true;
          break;
        }
      }
      // ບໍ່ເອີ້ນ adjust-stock ດ້ວຍຕົນເອງ — backend POST /assets ບັນທຶກ catalog stock +1 ອັດຕະໂນມັດຢູ່ແລ້ວ
      // (PATCH adjust-stock ປະຕິເສດລາຍການ itemType=ASSET ແລະຈະນັບຊ້ຳຖ້າເອີ້ນເພີ່ມອີກ)
      results.push({ name: r.name || r.assetTag, ok, want, errMsg });
      if (failed) break;
    }
    setBatchDone(done);
    setBatchResult(results);
    if (failed) setBatchError('ມີບາງລາຍການສ້າງບໍ່ສຳເລັດ — ເບິ່ງສະຫຼຸບດ້ານລຸ່ມ, ແກ້ແລ້ວກົດບັນທຶກອີກຄັ້ງ (ສ່ວນທີ່ສ້າງແລ້ວຈະບໍ່ຖືກສ້າງຊ້ຳ)');
    else setBatchFinished(true);
    fetchAssets();
    fetchCatalog();
    setBatchSubmitting(false);
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

  // ເລືອກໄດ້ສະເພາະ asset ທີ່ວ່າງ (AVAILABLE) — ຕົວທີ່ຢູ່ໃນລາຍການທີ່ເຫັນຕາມ filter
  // ເລືອກຮັບຫຼາຍລາຍການໄດ້ສະເພາະຜູ້ມີສິດ assets:assign (ພະນັກງານທົ່ວໄປຮັບຜ່ານໃບຮັບເຄື່ອງ/QR ຂອງໃບຂໍ)
  const selectableAssets = canAssign ? filteredAssets.filter((a) => a.status === 'AVAILABLE') : [];
  const allVisibleSelected =
    selectableAssets.length > 0 && selectableAssets.every((a) => selectedIds.has(a._id));
  const someVisibleSelected = selectableAssets.some((a) => selectedIds.has(a._id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectableAssets.forEach((a) => next.delete(a._id));
      else selectableAssets.forEach((a) => next.add(a._id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBulkClaim = () => {
    setBulkClaimError('');
    setBulkClaimResults(null);
    setBulkClaimCode('');
    setBulkLookup({ state: 'idle', user: null });
    setBulkClaimOpen(true);
  };

  const closeBulkClaim = () => {
    setBulkClaimOpen(false);
    setBulkClaimError('');
    setBulkClaimResults(null);
    setBulkClaimCode('');
    setBulkLookup({ state: 'idle', user: null });
  };

  // ກວດລະຫັດພະນັກງານຜູ້ມາຮັບ (debounce 400ms) — ໃຊ້ /users/lookup ທີ່ບໍ່ຕ້ອງມີສິດ users:read
  const bulkCodeTrim = bulkClaimCode.trim();
  useEffect(() => {
    if (!bulkClaimOpen || !canAssign || !bulkCodeTrim) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBulkLookup({ state: 'idle', user: null });
      return undefined;
    }
    setBulkLookup({ state: 'loading', user: null });
    const t = setTimeout(() => {
      fetch(`${API_BASE_URL}/users/lookup/${encodeURIComponent(bulkCodeTrim)}`, { headers })
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => setBulkLookup(ok ? { state: 'found', user: unwrap(body) } : { state: 'notfound', user: null }))
        .catch(() => setBulkLookup({ state: 'error', user: null }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCodeTrim, bulkClaimOpen, canAssign]);

  // ຢືນຢັນຮັບເຄື່ອງທີ່ເລືອກທັງໝົດ — ເອີ້ນ PATCH /assets/:id/claim ເປັນລຳດັບ ແລ້ວສະຫຼຸບຜົນລາຍຊິ້ນ
  // ຜູ້ມີ assets:assign (ເຊັ່ນ ເຫນືນ) ຕ້ອງໃສ່ລະຫັດພະນັກງານຂອງຜູ້ມາຮັບ — ສົ່ງ assigneeCode ໄປກັບ claim
  const confirmBulkClaim = () => {
    const targetAssets = filteredAssets.filter((a) => selectedIds.has(a._id));
    if (targetAssets.length === 0) {
      setBulkClaimError('ກະລຸນາເລືອກຊັບສິນຢ່າງໜ້ອຍ 1 ລາຍການ');
      return;
    }
    const code = bulkClaimCode.trim();
    if (canAssign && !code) {
      setBulkClaimError('ກະລຸນາໃສ່ລະຫັດພະນັກງານຂອງຜູ້ມາຮັບ');
      return;
    }
    if (canAssign && bulkLookup.state !== 'found') {
      setBulkClaimError('ກະລຸນາກວດລະຫັດພະນັກງານໃຫ້ພົບກ່ອນກົດຢືນຢັນ');
      return;
    }
    setBulkClaimSubmitting(true);
    setBulkClaimError('');
    setBulkClaimResults(null);

    (async () => {
      const results = [];
      for (const a of targetAssets) {
        try {
          const res = await fetch(`${API_BASE_URL}/assets/${a._id}/claim`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              note: canAssign
                ? 'ມອບເຄື່ອງຫຼາຍລາຍການຢູ່ຄັງ — ຢືນຢັນຕົວຕົນດ້ວຍລະຫັດພະນັກງານ'
                : 'ຮັບເຄື່ອງຫຼາຍລາຍການດ້ວຍຕົນເອງ — ຢືນຢັນຕົວຕົນຂອງຜູ້ໃຊ້ທີ່ກຳລັງ login',
              ...(canAssign && code ? { assigneeCode: code } : {}),
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.msg || 'ບໍ່ສຳເລັດ');
          results.push({ assetTag: a.assetTag, ok: true });
        } catch (err) {
          results.push({ assetTag: a.assetTag, ok: false, message: err.message });
        }
      }
      setBulkClaimResults(results);
      setBulkClaimSubmitting(false);
      clearSelection();
      fetchAssets();
    })();
  };

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
                  onClick={openCreate}
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
                  placeholder="ຄົ້ນຫາ ASSET TAG..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  title="ສະແກນ QR / ບາໂຄ໊ດ ເພື່ອຄົ້ນຫາ"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <Camera size={16} />
                </button>
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

            {selectedIds.size > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/60 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-blue-800">
                  ເລືອກແລ້ວ <span className="font-semibold">{selectedIds.size}</span> ລາຍການ
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-white rounded-lg transition"
                  >
                    ລ້າງການເລືອກ
                  </button>
                  <button
                    type="button"
                    onClick={openBulkClaim}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                  >
                    <UserCheck size={14} /> ຢືນຢັນຮັບເຄື່ອງທັງໝົດ
                  </button>
                </div>
              </div>
            )}

            {assetsError && <div className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertCircle size={16} />{assetsError}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="p-3 w-10">
                      {canAssign && <input
                        type="checkbox"
                        aria-label="ເລືອກທັງໝົດ"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                        onChange={toggleSelectAllVisible}
                        disabled={selectableAssets.length === 0}
                        className="rounded"
                      />}
                    </th>
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
                      <td colSpan={7} className="p-6 text-center text-sm text-gray-500">ກຳລັງໂຫຼດ...</td>
                    </tr>
                  )}
                  {!loadingAssets && filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-sm text-gray-500">ບໍ່ພົບຊັບສິນທີ່ຄ້າຍຄື</td>
                    </tr>
                  )}
                  {filteredAssets.map((a) => {
                    const info = statusInfo(a.status);
                    return (
                      <tr key={a._id} className="hover:bg-gray-50">
                        <td className="p-3">
                          {canAssign && a.status === 'AVAILABLE' && (
                            <input
                              type="checkbox"
                              aria-label={`ເລືອກ ${a.assetTag}`}
                              checked={selectedIds.has(a._id)}
                              onChange={() => toggleSelect(a._id)}
                              className="rounded"
                            />
                          )}
                        </td>
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
                            <button onClick={() => setHistoryModalAsset(a)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="ປະຫວັດການມອບໝາຍ">
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
                            {canUpdate && a.status !== 'RETIRED' && (
                              <button onClick={() => handleSetStatus(a, 'RETIRED')} disabled={busyId === a._id} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="ປົດລະວາງ / ເລີກໃຊ້ (ຖອນການຕິດຕັ້ງ)">
                                <Archive size={15} />
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
            <form onSubmit={submitBatch} className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  {fromRequestId ? `ເພີ່ມຊັບສິນຕາມໃບຂໍ ${fromRequestId}` : 'ເພີ່ມຊັບສິນໃໝ່'}
                </h2>
                <button type="button" onClick={closeCreate} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              {fromRequestId && (
                <p className="text-xs text-gray-500">
                  {reqError ? <span className="text-red-600">{reqError}</span> : reqData ? 'ເຕີມສະເພາະລາຍການທີ່ຂາດໃນທະບຽນໃຫ້ແລ້ວ (ຂໍ − ວ່າງ) — ແກ້ຈຳນວນໄດ້.' : 'ກຳລັງໂຫຼດໃບຂໍ...'}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ * (ໃຊ້ກັບທຸກແຖວ)</label>
                  <select value={batchBranch} onChange={(e) => setBatchBranch(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                    <option value="">-- ເລືອກສາຂາ --</option>
                    {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ວັນທີຊື້ (ທາງເລືອກ)</label>
                  <input type="date" value={batchPurchase} onChange={(e) => setBatchPurchase(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ໝົດປະກັນ (ທາງເລືອກ)</label>
                  <input type="date" value={batchWarranty} onChange={(e) => setBatchWarranty(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">ລາຍການຊັບສິນ</div>
                <div className="flex items-center gap-3 text-xs">
                  <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-blue-600 hover:underline">
                    {pickerOpen ? 'ປິດການເລືອກຈາກ Catalog' : '☑ ເລືອກຫຼາຍລາຍການຈາກ Catalog'}
                  </button>
                  <button type="button" onClick={() => setBatchRows((rows) => [...rows, newRow()])} className="text-amber-600 hover:underline">+ ເພີ່ມລາຍການອື່ນ</button>
                </div>
              </div>

              {pickerOpen && (
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາຊື່ ຫຼື ລະຫັດ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <div className="max-h-48 overflow-y-auto bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
                    {catalog
                      .filter((c) => {
                        const q = pickerSearch.trim().toLowerCase();
                        return !q || (c.name || '').toLowerCase().includes(q) || (c._id || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
                      })
                      .map((c) => {
                        const cnt = assetCountsFor(c._id);
                        return (
                          <label key={c._id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <input type="checkbox" checked={pickerSelected.has(c._id)} onChange={() => togglePicked(c._id)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-800">{c.name} <span className="text-xs text-gray-400">({c._id})</span></div>
                              <div className="text-xs text-gray-500">ໃນທະບຽນ {cnt.total} (ວ່າງ {cnt.available}) · ສະຕ໊ອກ Catalog {c.stockQty}</div>
                            </div>
                          </label>
                        );
                      })}
                    {catalog.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">ບໍ່ມີລາຍການໃນ Catalog</div>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">ເລືອກແລ້ວ {pickerSelected.size} ລາຍການ</span>
                    <button type="button" disabled={pickerSelected.size === 0} onClick={addPicked} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-40">ເພີ່ມເຂົ້າລາຍການ</button>
                  </div>
                </div>
              )}

              <datalist id="asset-catalog-options">
                {catalog.map((c) => (
                  <option key={c._id} value={c.name}>{c._id} — {c.category}</option>
                ))}
              </datalist>

              <div className="space-y-3">
                {batchRows.map((r, idx) => {
                  const cat = r.catalogItemId ? catalog.find((c) => c._id === r.catalogItemId) : null;
                  const qty = Math.max(0, Math.floor(Number(r.qty) || 0));
                  const cnt = cat ? assetCountsFor(cat._id) : null;
                  const availAfter = cnt ? cnt.available + qty : 0;
                  const doneN = batchDone[r.id] || 0;
                  return (
                    <div key={r.id} className="border border-gray-200 bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600">ແຖວທີ່ {idx + 1}{doneN > 0 && <span className="ml-2 text-emerald-600">✓ ສ້າງແລ້ວ {doneN}</span>}</span>
                        {batchRows.length > 1 && (
                          <button type="button" onClick={() => removeRow(r.id)} className="text-xs text-red-500 hover:underline">ລຶບ</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-3">
                          <label className="block text-xs text-gray-500 mb-1">ຄົ້ນຫາ/ເລືອກຈາກ Supply Catalog</label>
                          <input
                            type="text"
                            list="asset-catalog-options"
                            value={r.catalogSearch}
                            onChange={(e) => handleRowCatalog(r.id, e.target.value)}
                            placeholder="ພິມຊື່ອຸປະກອນ ຫຼື SC001, SC002..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">ຈຳນວນ *</label>
                          <input type="number" min={1} max={MAX_BATCH} value={r.qty} onChange={(e) => updateRow(r.id, { qty: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
                        </div>
                      </div>
                      {cat ? (
                        <div className="text-xs text-gray-500">
                          ✓ {cat.name} ({cat._id}) — Asset Tag ສ້າງໃຫ້ອັດຕະໂນມັດ · ໃນທະບຽນ {cnt.total} (ວ່າງ {cnt.available}) · ສະຕ໊ອກ Catalog {cat.stockQty}
                          {availAfter > cat.stockQty && (
                            <span className="block text-gray-400">ຫຼັງສ້າງ ສະຕ໊ອກ Catalog ຈະບວກ +{qty} ອັດຕະໂນມັດ (backend ນັບຈາກຊັບສິນວ່າງ)</span>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">ຊື່/ປະເພດ *</label>
                            <input type="text" value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} placeholder="Laptop, ຈໍ, ບັດພະນັກງານ..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Asset Tag (ບໍ່ມີ Catalog = ຕ້ອງໃສ່, ຊິ້ນດຽວ)</label>
                            <input type="text" value={r.assetTag} onChange={(e) => updateRow(r.id, { assetTag: e.target.value })} placeholder="A-1042" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
                          </div>
                        </div>
                      )}
                      <div>
                        <button type="button" onClick={() => updateRow(r.id, { showDates: !r.showDates })} className="text-xs text-blue-600 hover:underline">
                          {r.showDates ? 'ໃຊ້ວັນທີຮ່ວມ' : 'ປັບວັນທີຊື້/ປະກັນຂອງແຖວນີ້'}
                        </button>
                        {r.showDates && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <input type="date" value={r.purchaseDate} onChange={(e) => updateRow(r.id, { purchaseDate: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
                            <input type="date" value={r.warrantyExpiry} onChange={(e) => updateRow(r.id, { warrantyExpiry: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-gray-500">ລວມ {batchTotal} ຊິ້ນ (ສູງສຸດ {MAX_BATCH} ຕໍ່ຄັ້ງ)</div>

              {batchResult && (
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 space-y-1">
                  {batchResult.map((r, i) => (
                    <div key={i}>
                      <div className={r.errMsg ? 'text-red-600' : 'text-emerald-700'}>
                        {r.errMsg ? '✕' : '✓'} {r.name}: ສ້າງແລ້ວ {r.ok}/{r.want}{r.errMsg ? ` — ${r.errMsg}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {batchError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{batchError}</div>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeCreate} className="px-4 py-2 text-sm text-gray-600">{batchFinished ? 'ປິດ' : 'ຍົກເລີກ'}</button>
                {!batchFinished && (
                  <button type="submit" disabled={batchSubmitting || batchTotal < 1} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {batchSubmitting ? 'ກຳລັງບັນທຶກ...' : `ບັນທຶກທັງໝົດ (${batchTotal} ຊິ້ນ)`}
                  </button>
                )}
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

              <AssetTagVisual
                asset={barcodeModalAsset}
                claimBaseUrl={claimBaseUrl}
                showOriginWarning
                isLocalOrigin={isLocalOrigin}
                isIpOrigin={isIpOrigin}
              />

              {(() => {
                const a = barcodeModalAsset;
                const holder = a.currentAssigneeId ? users.find((u) => u._id === a.currentAssigneeId || u.employeeCode === a.currentAssigneeId) : null;
                if (!holder) return null;
                const b = branches.find((br) => br._id === holder.branchId);
                const loc = b?.location;
                const locText = loc ? `${loc.address || ''}${loc.city ? `, ${loc.city}` : ''}${loc.country ? `, ${loc.country}` : ''}`.replace(/^, /, '') : '';
                return (
                  <div className="border-t border-gray-100 pt-3 text-left space-y-1">
                    <div className="text-xs font-semibold text-gray-600">ຜູ້ຖືຢູ່ປັດຈຸບັນ</div>
                    <div className="text-sm font-medium text-gray-800">
                      {`${holder.firstName || ''} ${holder.lastName || ''}`.trim() || holder.employeeCode}
                    </div>
                    <div className="text-xs text-gray-500">
                      {b ? (locText ? `${b.name} — ${locText}` : b.name) : holder.branchId || '—'}
                    </div>
                  </div>
                );
              })()}
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
                  ຮັບເຄື່ອງ / ຢືນຢັນ
                </button>
              </div>
            </div>
          </div>
        )}

        {historyModalAsset && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ປະຫວັດການມອບໝາຍ — {historyModalAsset.assetTag}</h2>
                <button type="button" onClick={() => setHistoryModalAsset(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              {(historyModalAsset.assignmentHistory || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">ຍັງບໍ່ເຄີຍຖືກມອບໝາຍ</p>
              ) : (
                <div className="space-y-2">
                  {[...historyModalAsset.assignmentHistory].reverse().map((h, i) => (
                    <div key={h._id || i} className="border border-gray-100 rounded-xl p-3 text-sm">
                      <div className="font-medium text-gray-800">{userName(h.assigneeId)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {h.assignedAt ? new Date(h.assignedAt).toLocaleString() : '—'} —{' '}
                        {h.returnedAt ? new Date(h.returnedAt).toLocaleString() : <span className="text-blue-600 font-medium">ຍັງຖືຢູ່</span>}
                      </div>
                      {h.note && <div className="text-xs text-gray-500 mt-1 italic">"{h.note}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {bulkClaimOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">ຢືນຢັນການຮັບເຄື່ອງຫຼາຍລາຍການ</h2>
                <button type="button" onClick={closeBulkClaim} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {bulkClaimResults ? (
                <div className="space-y-3">
                  <div className="text-center space-y-2 py-1">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                    <div className="font-semibold text-gray-800">
                      ສຳເລັດ {bulkClaimResults.filter((r) => r.ok).length}/{bulkClaimResults.length} ລາຍການ
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {bulkClaimResults.map((r, i) => (
                      <div
                        key={i}
                        className={`text-xs border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${
                          r.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
                        }`}
                      >
                        <span className="font-mono truncate">{r.assetTag}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {r.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {r.ok ? 'ສຳເລັດ' : (r.message || 'ບໍ່ສຳເລັດ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={closeBulkClaim}
                    className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition"
                  >
                    ປິດ
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    {canAssign
                      ? `ຈະມອບໝາຍຊັບສິນ ${selectedIds.size} ລາຍການ ໃຫ້ຜູ້ທີ່ກຳລັງຈະມາຮັບ — ພິມລະຫັດພະນັກງານເພື່ອກວດຊື່ກ່ອນຢືນຢັນ:`
                      : `ຈະມອບໝາຍຊັບສິນ ${selectedIds.size} ລາຍການ ໃຫ້ບັນຊີທີ່ກຳລັງ login ເທົ່ານັ້ນ:`}
                  </p>
                  {canAssign && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ລະຫັດພະນັກງານຜູ້ຮັບ *</label>
                      <input
                        type="text"
                        value={bulkClaimCode}
                        onChange={(e) => { setBulkClaimCode(e.target.value); setBulkClaimError(''); }}
                        placeholder="ເຊັ່ນ USR200"
                        autoFocus
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                  {canAssign && bulkCodeTrim && bulkLookup.state === 'found' && bulkLookup.user && (
                    <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-500">ຊື່-ນາມສະກຸນ</span><span className="font-medium text-gray-800">{`${bulkLookup.user.firstName || ''} ${bulkLookup.user.lastName || ''}`.trim() || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">ສາຂາ</span><span className="font-medium text-gray-800 text-right">{branchName(bulkLookup.user.branchId)}</span></div>
                      {bulkLookup.user.isActive === false && <div className="text-xs text-red-600">ບັນຊີນີ້ຖືກປິດໃຊ້ງານ</div>}
                    </div>
                  )}
                  {canAssign && bulkCodeTrim && bulkLookup.state === 'loading' && (
                    <div className="text-xs text-gray-500">ກຳລັງກວດລະຫັດ...</div>
                  )}
                  {canAssign && bulkCodeTrim && bulkLookup.state === 'notfound' && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      ບໍ່ພົບລະຫັດພະນັກງານນີ້ — ກວດກັບບັດພະນັກງານຂອງຜູ້ມາຮັບອີກຄັ້ງ
                    </div>
                  )}
                  {canAssign && bulkCodeTrim && bulkLookup.state === 'error' && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ກວດລະຫັດບໍ່ໄດ້ຕອນນີ້ — Backend ຈະກວດຢືນຢັນອີກຄັ້ງຕອນບັນທຶກ
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ຜູ້ຮັບ</span>
                      <span className="font-medium text-gray-800">
                        {canAssign
                          ? (bulkLookup.state === 'found' && bulkLookup.user
                            ? (`${bulkLookup.user.firstName || ''} ${bulkLookup.user.lastName || ''}`.trim() || bulkLookup.user.employeeCode || '—')
                            : '—')
                          : (claimUser ? (`${claimUser.firstName || ''} ${claimUser.lastName || ''}`.trim() || claimUser.email || '—') : '—')}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ລະຫັດພະນັກງານ</span>
                      <span className="font-medium text-gray-800">{canAssign ? (bulkLookup.user?.employeeCode || bulkCodeTrim || '—') : (claimUser?.employeeCode || '—')}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">ຈຳນວນຊັບສິນ</span>
                      <span className="font-medium text-gray-800">{selectedIds.size} ລາຍການ</span>
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                    {filteredAssets.filter((a) => selectedIds.has(a._id)).map((a) => (
                      <div key={a._id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                        <span className="font-mono text-gray-800 truncate">{a.assetTag}</span>
                        <span className="text-gray-400 shrink-0">{a.type || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {!claimUser && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      ບໍ່ສາມາດຢືນຢັນຕົວຕົນໄດ້ — ກະລຸນາ login ໃໝ່ແລ້ວລອງໃໝ່
                    </div>
                  )}
                  {bulkClaimError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bulkClaimError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={closeBulkClaim} className="px-4 py-2 text-sm text-gray-600">ຍົກເລີກ</button>
                    <button
                      type="button"
                      onClick={confirmBulkClaim}
                      disabled={
                        bulkClaimSubmitting
                        || (canAssign
                          ? !bulkCodeTrim || bulkLookup.state !== 'found' || bulkLookup.user?.isActive === false
                          : !claimUser)
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {bulkClaimSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນຮັບເຄື່ອງ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {scannerOpen && (
          <CameraScanner
            title="ສະແກນ Asset Tag"
            hint="ຈ່ອງກ້ອງໃສ່ QR/ບາໂຄ໊ດ ເພື່ອຄົ້ນຫາຊັບສິນ"
            onScan={(text) => {
              const raw = String(text || '').trim();
              const urlMatch = raw.match(/\/assets\/([A-Za-z0-9_-]+)/);
              if (urlMatch) {
                // QR ຝັງ /assets/<id> — ບອກຜູ້ໃຊ້ກ່ອນວ່າຈະ "ຮັບເຄື່ອງ" ຫຼື "ເບິ່ງລາຍລະອຽດ"
                setScannerOpen(false);
                setScanTargetId(urlMatch[1]);
                return;
              }
              setSearch(raw);
            }}
            onClose={() => setScannerOpen(false)}
          />
        )}

        {scanTargetId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs space-y-4 text-center">
              <div>
                <div className="text-sm font-semibold text-gray-800">ພົບ QR ຂອງຊັບສິນ</div>
                <div className="text-[11px] text-gray-500 mt-1">ເລືອກການກະທຳທີ່ຕ້ອງການ</div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { navigate(`/assets/${scanTargetId}?claim=1`); setScanTargetId(null); }}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition"
                >
                  ຮັບເຄື່ອງ
                </button>
                <button
                  type="button"
                  onClick={() => { navigate(`/assets/${scanTargetId}`); setScanTargetId(null); }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition"
                >
                  ເບິ່ງລາຍລະອຽດ
                </button>
                <button
                  type="button"
                  onClick={() => setScanTargetId(null)}
                  className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  ຍົກເລີກ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}