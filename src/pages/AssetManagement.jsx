import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Clock, CheckCircle, XCircle, Search, Filter, Pencil, ArrowUpDown, Ban, ShoppingCart, PackagePlus, Package, ChevronDown, ChevronRight, Plus, History, Barcode, UserCheck, Undo2, Wrench, Archive, Trash2, Printer, ChevronsDown, ChevronsUp, ExternalLink } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import { API_ORIGIN } from '../config';
import { ReceiveModal } from './GoodsReceipt';
import AddAssetModal from '../components/AddAssetModal';
import CatalogImageUpload, { CatalogThumb, imageSrc } from '../components/CatalogImage';
import GoodsReceiptPrint from '../components/GoodsReceiptPrint';
import { AssignAssetModal, AssetBarcodeModal, AssignmentHistoryModal } from '../components/AssetRowModals';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import WarehouseLineReview from '../components/WarehouseLineReview';

const ASSET_STATUS = {
  AVAILABLE: { text: 'ວ່າງ', cls: 'bg-green-100 text-green-700' },
  ASSIGNED: { text: 'ມອບໝາຍແລ້ວ', cls: 'bg-blue-100 text-blue-700' },
  UNDER_REPAIR: { text: 'ກຳລັງສ້ອມ', cls: 'bg-amber-100 text-amber-700' },
  RETIRED: { text: 'ປົດແລ້ວ', cls: 'bg-gray-100 text-gray-500' },
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtMoney = (n) => (n != null && n !== '' ? Number(n).toLocaleString() : '—');
const personOf = (u) =>
  u && typeof u === 'object' ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—' : '—';

const requesterNameOf = (req) =>
  [req?.requestedBy?.firstName, req?.requestedBy?.lastName].filter(Boolean).join(' ') ||
  req?.requestedBy?.name || req?.requestedBy?.email ||
  req?.userId?.name || req?.userId?.email ||
  req?.createdBy?.name || 'ບໍ່ລະບຸຜູ້ຂໍ';
const HISTORY_STATUS = {
  REQUESTED: { text: 'ລໍຖ້າອະນຸມັດ', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { text: 'ອະນຸມັດແລ້ວ', cls: 'bg-blue-100 text-blue-700' },
  ORDERED: { text: 'ສັ່ງຊື້ແລ້ວ', cls: 'bg-indigo-100 text-indigo-700' },
  PARTIALLY_RECEIVED: { text: 'ຮັບບາງສ່ວນ', cls: 'bg-violet-100 text-violet-700' },
  CLOSED: { text: 'ຮັບຄົບ · ປິດແລ້ວ', cls: 'bg-emerald-100 text-emerald-700' },
  FULFILLED: { text: 'ຮັບຄົບ · ປິດແລ້ວ', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { text: 'ປະຕິເສດ', cls: 'bg-red-100 text-red-700' },
};
const LINE_STATUS = {
  READY: { text: 'ພ້ອມມາຮັບ', cls: 'bg-teal-100 text-teal-700' },
  ON_ORDER: { text: 'ສັ່ງຊື້ຢູ່ — ຍັງບໍ່ພ້ອມ', cls: 'bg-violet-100 text-violet-700' },
  REJECTED: { text: 'ປະຕິເສດ', cls: 'bg-red-100 text-red-700' },
  COLLECTED: { text: 'ຮັບແລ້ວ', cls: 'bg-emerald-100 text-emerald-700' },
};
const LineBadge = ({ item }) => {
  const b = LINE_STATUS[item?.lineStatus];
  if (!b) return null;
  return <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>;
};
const isDeptSource = (req) => {
  if (req?.source) return req.source === 'DEPARTMENT';
  const d = req?.departmentId;
  return !!(d && (typeof d === 'object' ? d._id : d));
};

function SourceBadge({ req }) {
  if (isDeptSource(req)) {
    return (
      <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
        ຈາກພະແນກ
      </span>
    );
  }
  return (
    <>
      <span className="text-[11px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-medium">
        ຈາກພະນັກງານ
      </span>
      {req?.managerApprovedBy && (
        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
          ຫົວໜ້າອະນຸມັດແລ້ວ
        </span>
      )}
    </>
  );
}

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

const holderOf = (a, lk) => {
  if (!a.currentAssigneeId) return '';
  const u = lk.users[String(a.currentAssigneeId)] || String(a.currentAssigneeId);
  if (a.holderType === 'DEPARTMENT') return `${lk.departments[String(a.departmentId)] || ''} ${u}`;
  return u;
};
const receiptHay = (r, lk) =>
  [
    r.receiptNo, r.vendor, r.invoiceNo, r.purchaseRequestNo, r.note, r.countNote, r.storageRoom,
    r.exceptionReason, personOf(r.createdBy), r.branchId ? lk.branches[String(r.branchId)] || String(r.branchId) : '',
    fmtDate(r.receivedDate), ...(r.serialNumbers || []), ...(r.assetTags || []),
  ].filter(Boolean).join(' ').toLowerCase();
const assetHay = (a, lk, receiptNo) =>
  [
    a.assetTag, a.serialNumber, holderOf(a, lk),
    a.branchId ? lk.branches[String(a.branchId)] || String(a.branchId) : '',
    receiptNo, (ASSET_STATUS[a.status] || {}).text,
  ].filter(Boolean).join(' ').toLowerCase();
const idOf = (v) => String(v && typeof v === 'object' ? v._id : v);

function Info({ label, children, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-800 font-medium">{children}</span>
    </div>
  );
}

export default function AssetManagement() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreateCatalog = hasPermission('supplies', 'manage');
  const canImportCatalog = hasPermission('supplies', 'import');
  const canUpdateCatalog = hasPermission('supplies', 'update');
  const canDeleteCatalog = hasPermission('supplies', 'delete');
  const canApproveRequests = hasPermission('supplies', 'approve');
  const canAssignAsset = hasPermission('assets', 'assign');
  const canUpdateAsset = hasPermission('assets', 'update');
  const canDeleteAsset = hasPermission('assets', 'delete');

  const [activeTab, setActiveTab] = useState('catalog');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [stockFilter, setStockFilter] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const toggleStatusFilter = (key) => {
    setStatusFilter(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key]);
  };
  const toggleStockFilter = (key) => {
    setStockFilter(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key]);
  };
  const toggleCategoryFilter = (cat) => {
    setCategoryFilter(prev => prev.includes(cat) ? prev.filter(v => v !== cat) : [...prev, cat]);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    trackMode: '',
    lowStockThreshold: 5,
    imageUrl: '',
  });
  const [editingId, setEditingId] = useState(null);

  const [receiptSummary, setReceiptSummary] = useState({});
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [detailTab, setDetailTab] = useState('receipts');
  const [assetRows, setAssetRows] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [expandedReceipts, setExpandedReceipts] = useState(() => new Set());
  const [expandedAssets, setExpandedAssets] = useState(() => new Set());
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptModes, setReceiptModes] = useState([]);
  const [receiptFrom, setReceiptFrom] = useState('');
  const [receiptTo, setReceiptTo] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetStatuses, setAssetStatuses] = useState([]);
  const [subIndex, setSubIndex] = useState({});
  const [assignAsset, setAssignAsset] = useState(null);
  const [barcodeAsset, setBarcodeAsset] = useState(null);
  const [historyAsset, setHistoryAsset] = useState(null);
  const [printReceiptId, setPrintReceiptId] = useState('');
  const [busyAssetId, setBusyAssetId] = useState('');
  const [lookups, setLookups] = useState({ branches: {}, users: {}, departments: {} });
  const lookupsLoaded = useRef(false);

  const canAddAsset = hasPermission('assets', 'create');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createModal, setCreateModal] = useState(null);
  const [modalCatalog, setModalCatalog] = useState([]);
  const createMenuRef = useRef(null);

  useEffect(() => {
    if (!createMenuOpen) return undefined;
    const onDown = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) setCreateMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setCreateMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [createMenuOpen]);

  const openCreateModal = async (type, itemId) => {
    setCreateMenuOpen(false);
    if (type === 'ASSET') {
      setCreateModal({ type });
      return;
    }
    let list = assets;
    try {
      const res = await api.get('/supply-catalog');
      const body = res.data?.data ?? res.data;
      if (Array.isArray(body)) list = body;
    } catch {
    }
    setModalCatalog(list);
    setCreateModal({ type, itemId });
  };
  const openedItemId = useRef('');

  useEffect(() => {
    if (!historyItem) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setHistoryItem(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyItem]);

  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const trackModeOf = (item) => {
    if (item?.itemType === 'CONSUMABLE') return 'COUNT';
    if (item?.itemType === 'ASSET') return item.trackSerial === false ? 'TAG' : 'SERIAL';
    return '';
  };
  const TRACK_LABEL = {
    SERIAL: 'ມີ Serial Number',
    TAG: 'ຕິດ Asset Tag (ບໍ່ມີ S/N)',
    COUNT: 'ນັບຈຳນວນ (ສິ້ນເປືອງ)',
  };
  const TRACK_TO_BODY = {
    SERIAL: { itemType: 'ASSET', trackSerial: true },
    TAG: { itemType: 'ASSET', trackSerial: false },
    COUNT: { itemType: 'CONSUMABLE' },
  };
  const MODE_BADGE = {
    NEW_ITEM: { text: 'ຊື້ໃໝ່', cls: 'bg-emerald-100 text-emerald-700' },
    RESTOCK: { text: 'ເພີ່ມ', cls: 'bg-amber-100 text-amber-700' },
  };
  const apiMsg = (error, fallback) => {
    const m = error.response?.data?.msg || error.response?.data?.message;
    return Array.isArray(m) ? m.join(', ') : m || fallback;
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setErrorMsg('');
    setFormData({
      name: item.name || '',
      category: item.category || '',
      unit: item.unit || '',
      trackMode: trackModeOf(item),
      lowStockThreshold: item.lowStockThreshold ?? 5,
      imageUrl: item.imageUrl || '',
    });
    setIsModalOpen(true);
  };

  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustForm({ delta: '', reason: '' });
    setAdjustError('');
  };

  const loadLookups = async () => {
    if (lookupsLoaded.current) return;
    lookupsLoaded.current = true;
    const get = (url) =>
      api.get(url)
        .then((r) => { const b = r.data?.data ?? r.data; return Array.isArray(b) ? b : []; })
        .catch(() => []);
    const [branches, users, departments] = await Promise.all([get('/branches'), get('/users'), get('/departments')]);
    const toMap = (list, fn) => Object.fromEntries(list.map((x) => [String(x._id), fn(x)]));
    setLookups({
      branches: toMap(branches, (x) => x.name || x._id),
      departments: toMap(departments, (x) => x.name || x._id),
      users: toMap(users, (x) => [x.firstName, x.lastName].filter(Boolean).join(' ') || x.employeeCode || x.email || x._id),
    });
  };

  const openHistory = async (item, preset) => {
    openedItemId.current = item._id;
    const isCurrent = () => openedItemId.current === item._id;
    const isConsumable = item.itemType === 'CONSUMABLE';
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryError('');
    setAssetRows([]);
    setAssetsError('');
    setDetailTab(preset?.tab || 'receipts');
    setExpandedReceipts(new Set());
    setExpandedAssets(new Set());
    setAssignAsset(null);
    setBarcodeAsset(null);
    setHistoryAsset(null);
    setPrintReceiptId('');
    setReceiptSearch('');
    setReceiptModes([]);
    setReceiptFrom('');
    setReceiptTo('');
    setAssetSearch('');
    setAssetStatuses([]);
    if (preset) {
      setReceiptSearch(preset.search);
      setAssetSearch(preset.search);
    }
    setHistoryLoading(true);
    setAssetsLoading(!isConsumable && hasPermission('assets', 'read'));
    loadLookups();

    const loadReceipts = async () => {
      try {
        const res = await api.get('/goods-receipt', { params: { catalogItemId: item._id } });
        const body = res.data?.data ?? res.data;
        if (isCurrent()) setHistoryRows(Array.isArray(body) ? body : []);
      } catch (error) {
        if (isCurrent()) setHistoryError(apiMsg(error, 'ບໍ່ສາມາດໂຫຼດປະຫວັດການຮັບເຂົ້າໄດ້'));
      } finally {
        if (isCurrent()) setHistoryLoading(false);
      }
    };

    const loadAssetRows = async () => {
      if (isConsumable) return;
      if (!hasPermission('assets', 'read')) {
        setAssetsError('ບັນຊີນີ້ບໍ່ມີສິດເບິ່ງທະບຽນຊັບສິນ (assets:read)');
        return;
      }
      try {
        const res = await api.get('/assets', { params: { catalogItemId: item._id } });
        const body = res.data?.data ?? res.data;
        const list = Array.isArray(body) ? body : [];
        list.sort((x, y) => String(x.assetTag).localeCompare(String(y.assetTag)));
        if (isCurrent()) setAssetRows(list);
      } catch (error) {
        if (isCurrent()) setAssetsError(apiMsg(error, 'ບໍ່ສາມາດໂຫຼດທະບຽນຊັບສິນໄດ້'));
      } finally {
        if (isCurrent()) setAssetsLoading(false);
      }
    };

    await Promise.all([loadReceipts(), loadAssetRows()]);
  };

  const reloadAssetRows = async (itemId) => {
    try {
      const res = await api.get('/assets', { params: { catalogItemId: itemId } });
      const body = res.data?.data ?? res.data;
      const list = Array.isArray(body) ? body : [];
      list.sort((x, y) => String(x.assetTag).localeCompare(String(y.assetTag)));
      if (openedItemId.current === itemId) setAssetRows(list);
    } catch (error) {
      if (openedItemId.current === itemId) setAssetsError(apiMsg(error, 'ບໍ່ສາມາດໂຫຼດທະບຽນຊັບສິນໄດ້'));
    }
    fetchCatalog();
  };

  const runAssetAction = async (asset, request, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyAssetId(String(asset._id));
    try {
      await request();
      await reloadAssetRows(historyItem._id);
    } catch (error) {
      alert(apiMsg(error, 'ດຳເນີນການບໍ່ສຳເລັດ'));
    } finally {
      setBusyAssetId('');
    }
  };

  const handleAssetReturn = (a) =>
    runAssetAction(a, () => api.patch(`/assets/${a._id}/return`, {}), `ຢືນຢັນວ່າ ${a.assetTag} ຖືກສົ່ງຄືນແລ້ວ?`);
  const handleAssetStatus = (a, status) =>
    runAssetAction(a, () => api.patch(`/assets/${a._id}/status`, { status }));
  const handleAssetDelete = (a) =>
    runAssetAction(a, () => api.delete(`/assets/${a._id}`), `ລຶບຊັບສິນ ${a.assetTag} ຖາວອນ? ບໍ່ສາມາດກູ້ຄືນໄດ້`);

  const loadSubIndex = async () => {
    const get = (url) =>
      api.get(url)
        .then((r) => { const b = r.data?.data ?? r.data; return Array.isArray(b) ? b : []; })
        .catch(() => []);
    const [receipts, assetList] = await Promise.all([
      get('/goods-receipt'),
      hasPermission('assets', 'read') ? get('/assets') : Promise.resolve([]),
    ]);
    const idx = {};
    const slot = (id) => {
      if (!idx[id]) idx[id] = { receipts: [], assets: [] };
      return idx[id];
    };
    receipts.forEach((r) => { if (r.catalogItemId) slot(idOf(r.catalogItemId)).receipts.push(r); });
    assetList.forEach((a) => { if (a.catalogItemId) slot(idOf(a.catalogItemId)).assets.push(a); });
    setSubIndex(idx);
    loadLookups();
  };

  const subMatchOf = (item, q) => {
    const sub = subIndex[item._id];
    if (!q || !sub) return { receipts: 0, assets: 0 };
    const receiptNoByAsset = new Map();
    sub.receipts.forEach((r) => (r.assetIds || []).forEach((id) => receiptNoByAsset.set(String(id), r.receiptNo)));
    return {
      receipts: sub.receipts.filter((r) => receiptHay(r, lookups).includes(q)).length,
      assets: sub.assets.filter((a) => assetHay(a, lookups, receiptNoByAsset.get(String(a._id))).includes(q)).length,
    };
  };

  const fetchReceiptSummary = async () => {
    try {
      const res = await api.get('/goods-receipt/summary');
      const body = res.data?.data ?? res.data;
      const map = {};
      (Array.isArray(body) ? body : []).forEach((r) => { map[r.catalogItemId] = r; });
      setReceiptSummary(map);
    } catch {
      setReceiptSummary({});
    }
  };

  const handleRecalculateStock = async () => {
    if (!window.confirm('ຄຳນວນສະຕ໊ອກໃໝ່ຈາກຈຳນວນຊັບສິນທີ່ "ວ່າງ" ຂອງທຸກລາຍການທີ່ມີຊັບສິນ? (ຂອງສິ້ນເປືອງບໍ່ຖືກແຕະ)')) return;
    try {
      const res = await api.post('/supply-catalog/recalculate-stock');
      const body = res.data?.data ?? res.data;
      const list = (body.changes || []).map((c) => `${c._id} ${c.name}: ${c.before} → ${c.after}`).join('\n');
      alert(body.changed > 0 ? `ແກ້ສະຕ໊ອກ ${body.changed} ລາຍການ:\n${list}` : 'ສະຕ໊ອກຖືກຕ້ອງຢູ່ແລ້ວ ບໍ່ມີຫຍັງປ່ຽນ');
      fetchCatalog();
    } catch (error) {
      alert(apiMsg(error, 'ຄຳນວນສະຕ໊ອກໃໝ່ບໍ່ສຳເລັດ'));
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const delta = Number(adjustForm.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      setAdjustError('ຈຳນວນປັບຕ້ອງເປັນຈຳນວນເຕັມ ແລະບໍ່ແມ່ນ 0 (ບວກ = ເພີ່ມ, ລົບ = ຫຼຸດ)');
      return;
    }
    if (adjustForm.reason.trim().length < 3) {
      setAdjustError('ກະລຸນາລະບຸເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)');
      return;
    }
    try {
      setAdjusting(true);
      setAdjustError('');
      await api.patch(`/supply-catalog/${adjustItem._id}/adjust-stock`, { delta, reason: adjustForm.reason.trim() });
      setAdjustItem(null);
      fetchCatalog();
    } catch (error) {
      setAdjustError(apiMsg(error, 'ປັບສະຕ໊ອກບໍ່ສຳເລັດ'));
    } finally {
      setAdjusting(false);
    }
  };

  const handleDisable = async (item) => {
    if (!window.confirm(`ປິດໃຊ້ງານລາຍການ "${item.name}"? (ບໍ່ລຶບຖາວອນ; ຖ້າຍັງມີຊັບສິນອ້າງອີງຈະຖືກປະຕິເສດ)`)) return;
    try {
      await api.delete(`/supply-catalog/${item._id}`);
      fetchCatalog();
    } catch (error) {
      alert(apiMsg(error, 'ປິດໃຊ້ງານບໍ່ສຳເລັດ'));
    }
  };
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [detailReqId, setDetailReqId] = useState(null);
  const [confirmType, setConfirmType] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState('');

  const [managerRequests, setManagerRequests] = useState([]);
  const [loadingManager, setLoadingManager] = useState(true);
  const [managerError, setManagerError] = useState('');
  const [managerAvailable, setManagerAvailable] = useState(false);

  const [managerHistory, setManagerHistory] = useState([]);
  const [warehouseHistory, setWarehouseHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyShown, setHistoryShown] = useState({ manager: 10, pending: 10 });
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const fetchCatalog = async (opts) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      const url = lowStockOnly ? '/supply-catalog?lowStockOnly=true' : '/supply-catalog';
      const response = await api.get(url);
      
      const responseData = response.data;
      let items = [];
      if (Array.isArray(responseData)) {
        items = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        items = responseData.data;
      } else if (responseData && typeof responseData === 'object') {
        const foundArrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
        if (foundArrayKey) {
          items = responseData[foundArrayKey];
        }
      }

      setAssets(items);
      fetchReceiptSummary();
      loadSubIndex();
    } catch (error) {
      console.error('Failed to fetch supply catalog:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPendingRequests = async (opts) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) {
        setLoadingPending(true);
        setPendingError('');
      }
      const response = await api.get('/supply-requests?status=REQUESTED');

      const responseData = response.data;
      let allRequests = [];
      if (Array.isArray(responseData)) {
        allRequests = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        allRequests = responseData.data;
      } else if (responseData && typeof responseData === 'object') {
        const foundArrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
        if (foundArrayKey) {
          allRequests = responseData[foundArrayKey];
        }
      }

      setPendingRequests(allRequests);
      setPendingError('');
    } catch (error) {
      console.error('Failed to fetch supply requests:', error);
      if (silent) return;
      const status = error.response?.status;
      if (status === 403) {
        setPendingError('ບັນຊີນີ້ບໍ່ມີສິດອະນຸມັດຄຳຂໍອຸປະກອນ (supplies:approve)');
      } else if (status === 401) {
        setPendingError('Session ໝົດອາຍຸ — ກະລຸນາ login ໃໝ່');
      } else {
        setPendingError(error.response?.data?.msg || error.response?.data?.message || 'ບໍ່ສາມາດດຶງຄຳຂໍລໍຖ້າອະນຸມັດໄດ້');
      }
      setPendingRequests([]);
    } finally {
      if (!silent) setLoadingPending(false);
    }
  };

  const fetchManagerRequests = async (opts) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) {
        setLoadingManager(true);
        setManagerError('');
      }
      const response = await api.get('/supply-requests/manager-queue');
      const body = response.data;
      const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      setManagerRequests(list);
      setManagerAvailable(true);
      setManagerError('');
    } catch (error) {
      const status = error.response?.status;
      if (status === 403 || status === 404) {
        setManagerAvailable(false);
        setManagerRequests([]);
        return;
      }
      if (silent) return;
      setManagerError(error.response?.data?.msg || error.response?.data?.message || 'ບໍ່ສາມາດດຶງຄຳຂໍທີ່ລໍຖ້າຫົວໜ້າພະແນກໄດ້');
    } finally {
      if (!silent) setLoadingManager(false);
    }
  };

  const fetchHistories = async () => {
    const toList = (res) => {
      const body = res.data;
      return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    };
    const [m, w] = await Promise.allSettled([
      api.get('/supply-requests/manager-history', { params: { limit: 50 } }),
      api.get('/supply-requests/history', { params: { limit: 50 } }),
    ]);
    setManagerHistory(m.status === 'fulfilled' ? toList(m.value) : []);
    setWarehouseHistory(w.status === 'fulfilled' ? toList(w.value) : []);
    setLoadingHistory(false);
  };

  const reloadOpenItemSilently = async (item) => {
    const itemId = item._id;
    const canReadAssets = item.itemType !== 'CONSUMABLE' && hasPermission('assets', 'read');
    try {
      const [receiptsRes, assetsRes] = await Promise.all([
        api.get('/goods-receipt', { params: { catalogItemId: itemId } }),
        canReadAssets ? api.get('/assets', { params: { catalogItemId: itemId } }) : Promise.resolve(null),
      ]);
      if (openedItemId.current !== itemId) return;
      const receiptBody = receiptsRes.data?.data ?? receiptsRes.data;
      setHistoryRows(Array.isArray(receiptBody) ? receiptBody : []);
      if (assetsRes) {
        const assetBody = assetsRes.data?.data ?? assetsRes.data;
        const list = Array.isArray(assetBody) ? assetBody : [];
        list.sort((x, y) => String(x.assetTag).localeCompare(String(y.assetTag)));
        setAssetRows(list);
      }
    } catch {
    }
  };

  useRealtimeRefresh(() =>
    Promise.all([
      fetchCatalog({ silent: true }),
      fetchPendingRequests({ silent: true }),
      fetchManagerRequests({ silent: true }),
      fetchHistories(),
      historyItem ? reloadOpenItemSilently(historyItem) : null,
    ]),
  );

  useEffect(() => {
    fetchCatalog();
  }, [lowStockOnly]);

  useEffect(() => {
    fetchPendingRequests();
    fetchManagerRequests();
    fetchHistories();
  }, []);

  const detailReq = detailReqId
    ? pendingRequests.find((r) => r._id === detailReqId) || managerRequests.find((r) => r._id === detailReqId) || null
    : null;
  const isManagerStage = detailReq?.status === 'PENDING_MANAGER';

  const closeConfirm = () => {
    if (reviewingId) return;
    setConfirmType(null);
    setRejectReason('');
    setReviewError('');
  };
  const closeDetail = () => {
    if (reviewingId) return;
    setDetailReqId(null);
    setConfirmType(null);
    setRejectReason('');
    setReviewError('');
  };
  const openConfirm = (type) => {
    setReviewError('');
    setRejectReason('');
    setConfirmType(type);
  };

  useEffect(() => {
    if (!detailReqId) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || reviewingId) return;
      if (confirmType) closeConfirm();
      else closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailReqId, confirmType, reviewingId]);

  const submitReview = async () => {
    if (!detailReq || !confirmType) return;
    const id = detailReq._id;
    if ((confirmType === 'reject' || confirmType === 'changes') && !rejectReason.trim()) {
      setReviewError(confirmType === 'changes' ? 'ຕ້ອງລະບຸຂໍ້ຄວາມເພື່ອໃຫ້ຜູ້ຂໍແກ້ໄຂ' : 'ຕ້ອງລະບຸເຫດຜົນຈຶ່ງຈະປະຕິເສດໄດ້');
      return;
    }
    try {
      setReviewingId(id);
      setReviewError('');
      const stage = isManagerStage ? 'manager-' : '';
      if (confirmType === 'approve') {
        await api.patch(`/supply-requests/${id}/${stage}approve`);
      } else if (confirmType === 'changes') {
        await api.patch(`/supply-requests/${id}/manager-request-changes`, { note: rejectReason.trim() });
      } else {
        await api.patch(`/supply-requests/${id}/${stage}reject`, { reason: rejectReason.trim() });
      }
      const wasApprove = confirmType === 'approve';
      setConfirmType(null);
      setDetailReqId(null);
      setRejectReason('');
      await Promise.all([fetchPendingRequests(), fetchManagerRequests(), fetchHistories()]);
      if (wasApprove && !isManagerStage) fetchCatalog();
    } catch (error) {
      setReviewError(
        error.response?.data?.msg || error.response?.data?.message ||
          (confirmType === 'approve' ? 'ອະນຸມັດບໍ່ສຳເລັດ' : confirmType === 'changes' ? 'ສົ່ງຄືນໃຫ້ແກ້ໄຂບໍ່ສຳເລັດ' : 'ປະຕິເສດບໍ່ສຳເລັດ'),
      );
    } finally {
      setReviewingId(null);
    }
  };

  const renderPendingModals = () => {
    if (!detailReq) return null;
    const req = detailReq;
    const items = Array.isArray(req.items) ? req.items : [];
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const busy = reviewingId === req._id;
    const stockOf = (it) => assets.find((a) => a._id === it.catalogItemId);
    const overStock = items.filter((it) => {
      const cat = stockOf(it);
      return cat && !it.purchaseRequestId && (it.quantity || 0) > (cat.stockQty ?? 0);
    }).length;
    const linkedItems = items.filter((it) => it.purchaseRequestId);
    const linkedPending = linkedItems.filter((it) => !it.purchaseStatus || it.purchaseStatus === 'PENDING');
    const PR_STATUS = {
      PENDING: { text: 'ລໍອະນຸມັດ', cls: 'bg-amber-100 text-amber-700' },
      APPROVED: { text: 'ອະນຸມັດແລ້ວ (ລໍຮັບເຄື່ອງ)', cls: 'bg-blue-100 text-blue-700' },
      PARTIALLY_RECEIVED: { text: 'ຮັບບາງສ່ວນ', cls: 'bg-violet-100 text-violet-700' },
      RECEIVED: { text: 'ຮັບຄົບແລ້ວ', cls: 'bg-emerald-100 text-emerald-700' },
      REJECTED: { text: 'ປະຕິເສດ', cls: 'bg-red-100 text-red-700' },
      CANCELLED: { text: 'ຍົກເລີກ', cls: 'bg-gray-100 text-gray-500' },
    };
    const openPR = (id) => navigate(`/purchase-requests?open=${encodeURIComponent(id)}`);
    const deptName = req.departmentId && typeof req.departmentId === 'object' ? req.departmentId.name : req.departmentId;
    const info = (label, value) => (
      <div>
        <div className="text-[11px] text-gray-400">{label}</div>
        <div className="text-sm text-gray-800 break-words">{value || '—'}</div>
      </div>
    );

    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="text-lg font-bold text-gray-800">{req._id}</h3>
                {isManagerStage ? (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">ລໍຖ້າຫົວໜ້າພະແນກ</span>
                ) : (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">ລໍຖ້າອະນຸມັດ</span>
                )}
                <SourceBadge req={req} />
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{totalQty} ຊິ້ນ</span>
              </div>
              <button type="button" onClick={closeDetail} className="text-gray-400 hover:text-gray-600 transition" aria-label="ປິດ">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {info('ຜູ້ຂໍ', `${requesterNameOf(req)}${req.requestedBy?.employeeCode ? ` (${req.requestedBy.employeeCode})` : ''}`)}
                {info('ວັນທີ-ເວລາຍື່ນ', fmtDateTime(req.createdAt))}
                {info('ຂໍໃນນາມ', deptName ? `ແຜນກ ${deptName}` : `ສ່ວນຕົວ${req.managerDepartmentId?.name ? ` (ພະແນກ ${req.managerDepartmentId.name})` : ''}`)}
                {req.managerApprovedBy && info('ຫົວໜ້າພະແນກອະນຸມັດ', `${personOf(req.managerApprovedBy)} · ${fmtDateTime(req.managerApprovedAt)}`)}
                {req.custodianId && info('ຜູ້ຮັບຜິດຊອບ', `${personOf(req.custodianId)}${req.custodianId.employeeCode ? ` (${req.custodianId.employeeCode})` : ''}`)}
                {req.delegateId && info('ຜູ້ຮັບແທນ', `${personOf(req.delegateId)}${req.delegateId.employeeCode ? ` (${req.delegateId.employeeCode})` : ''}`)}
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">ລາຍການທີ່ຂໍ ({items.length})</div>
                <div className="border border-gray-100 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs">
                      <tr>
                        <th className="p-3">ລາຍການ</th>
                        <th className="p-3 text-right whitespace-nowrap">ຈຳນວນຂໍ</th>
                        <th className="p-3 text-right whitespace-nowrap">ສະຕັອກ</th>
                        <th className="p-3">ເຫດຜົນ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((it, idx) => {
                        const cat = stockOf(it);
                        const short = cat && !it.purchaseRequestId && (it.quantity || 0) > (cat.stockQty ?? 0);
                        return (
                          <tr key={idx} className="align-top">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <CatalogThumb url={cat?.imageUrl} name={it.name} size={36} />
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800">{it.name}</div>
                                  {it.catalogItemId && <div className="text-[11px] text-gray-400">{it.catalogItemId}</div>}
                                  {it.purchaseRequestNo && (
                                    <button
                                      type="button"
                                      onClick={() => openPR(it.purchaseRequestId)}
                                      className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1"
                                    >
                                      ຜູກໃບສະເໜີຊື້ {it.purchaseRequestNo}{it.purchaseQty ? ` (ຊື້ ${it.purchaseQty})` : ''}
                                      <ExternalLink size={10} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-800">{it.quantity}</td>
                            <td className={`p-3 text-right whitespace-nowrap ${short ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              {cat ? `${cat.stockQty ?? 0} ${cat.unit || ''}` : '—'}
                            </td>
                            <td className="p-3 text-gray-600">{it.reason || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {!isManagerStage && canApproveRequests && req.status === 'REQUESTED' && (
                <WarehouseLineReview
                  key={req._id}
                  req={req}
                  catalog={assets}
                  onDone={async () => {
                    setDetailReqId(null);
                    await Promise.all([fetchPendingRequests(), fetchManagerRequests(), fetchHistories(), fetchCatalog()]);
                  }}
                />
              )}

              {overStock > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ມີ {overStock} ລາຍການທີ່ຂໍເກີນສະຕັອກປັດຈຸບັນ ແລະ ບໍ່ໄດ້ຜູກກັບໃບສະເໜີຊື້
                </div>
              )}

              {linkedItems.length > 0 && (
                <div className="border border-violet-100 bg-violet-50/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                    <ShoppingCart size={15} />
                    ໃບສະເໜີຊື້ທີ່ຜູກກັບຄຳຂໍນີ້ (ສະຕັອກບໍ່ພໍ)
                  </div>
                  {linkedItems.map((it, k) => {
                    const st = PR_STATUS[it.purchaseStatus] || PR_STATUS.PENDING;
                    const fromStock = Math.max((it.quantity || 0) - (it.purchaseQty || 0), 0);
                    return (
                      <div key={`${it.purchaseRequestId}-${k}`} className="bg-white border border-violet-100 rounded-lg p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-gray-500">{it.purchaseRequestNo || it.purchaseRequestId}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>
                          </div>
                          <div className="text-sm font-medium text-gray-800">{it.name}</div>
                          <div className="text-xs text-gray-600">
                            ຂໍ {it.quantity} = ໃຊ້ສະຕັອກ {fromStock} + ຊື້ເພີ່ມ {it.purchaseQty ?? '—'}
                            {it.arrivedQty != null && it.purchaseQty ? ` · ຂອງມາແລ້ວ ${it.arrivedQty}/${it.purchaseQty}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPR(it.purchaseRequestId)}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition"
                        >
                          ເປີດໃບສະເໜີຊື້ <ExternalLink size={12} />
                        </button>
                      </div>
                    );
                  })}
                  {linkedPending.length > 0 && (
                    <div className="text-xs text-gray-500">
                      ຄຳຂໍນີ້ຈະຖືກອະນຸມັດພ້ອມກັນເມື່ອອະນຸມັດໃບສະເໜີຊື້ — ກົດ "ເປີດໃບສະເໜີຊື້" ເພື່ອໄປອະນຸມັດ
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              {isManagerStage || canApproveRequests ? (
                <>
                  <button
                    type="button"
                    onClick={() => openConfirm('reject')}
                    disabled={busy}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <XCircle size={16} />
                    <span>ປະຕິເສດ</span>
                  </button>
                  {isManagerStage && (
                    <button
                      type="button"
                      onClick={() => openConfirm('changes')}
                      disabled={busy}
                      className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>↩ ຂໍໃຫ້ແກ້ໄຂ</span>
                    </button>
                  )}
                  {(isManagerStage || req.status !== 'REQUESTED') && (
                    <button
                      type="button"
                      onClick={() => openConfirm('approve')}
                      disabled={busy}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle size={16} />
                      <span>{isManagerStage ? 'ອະນຸມັດ (ຫົວໜ້າພະແນກ)' : 'ອະນຸມັດ'}</span>
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-400">ບໍ່ມີສິດອະນຸມັດ</span>
              )}
            </div>
          </div>
        </div>

        {confirmType && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={closeConfirm}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      confirmType === 'approve' ? 'bg-green-100 text-green-600' : confirmType === 'changes' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {confirmType === 'approve' ? <CheckCircle size={22} /> : confirmType === 'changes' ? <span className="text-lg">↩</span> : <XCircle size={22} />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-800">
                      {confirmType === 'approve' ? 'ຢືນຢັນການອະນຸມັດ' : confirmType === 'changes' ? 'ຂໍໃຫ້ຜູ້ຂໍແກ້ໄຂລາຍການ' : 'ຢືນຢັນການປະຕິເສດ'}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {confirmType === 'approve'
                        ? isManagerStage
                          ? `ອະນຸມັດຄຳຂໍ ${req._id} (${totalQty} ຊິ້ນ) ຂອງ ${requesterNameOf(req)} — ຫຼັງອະນຸມັດ ຄຳຂໍຈະຖືກສົ່ງຕໍ່ໃຫ້ຝ່າຍສາງ/ຜູ້ອະນຸມັດແມ່ນບໍ?`
                          : `ອະນຸມັດຄຳຂໍ ${req._id} (${totalQty} ຊິ້ນ) ຂອງ ${requesterNameOf(req)} ແມ່ນບໍ?`
                        : confirmType === 'changes'
                          ? `ສົ່ງຄຳຂໍ ${req._id} ຄືນໃຫ້ ${requesterNameOf(req)} ແກ້ໄຂ — ເມື່ອແກ້ແລ້ວ ຈະສົ່ງກັບມາໃຫ້ທ່ານອະນຸມັດອີກຄັ້ງ`
                          : `ປະຕິເສດຄຳຂໍ ${req._id} ຂອງ ${requesterNameOf(req)} — ກະລຸນາບອກເຫດຜົນ`}
                    </p>
                  </div>
                </div>

                {(confirmType === 'reject' || confirmType === 'changes') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{confirmType === 'changes' ? 'ຕ້ອງການໃຫ້ແກ້ໄຂຫຍັງ *' : 'ເຫດຜົນທີ່ປະຕິເສດ *'}</label>
                    <textarea
                      autoFocus
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value);
                        if (reviewError) setReviewError('');
                      }}
                      disabled={busy}
                      placeholder={confirmType === 'changes' ? 'ເຊັ່ນ: ກະລຸນາລະບຸສະເປັກຄອມພິວເຕີໃຫ້ຊັດເຈນ...' : 'ເຊັ່ນ: ເກີນງົບປະມານ, ຂໍຊ້ຳ, ຍັງມີສະຕັອກພໍ...'}
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 disabled:bg-gray-50"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">{confirmType === 'changes' ? 'ຜູ້ຂໍຈະເຫັນຂໍ້ຄວາມນີ້' : 'ຜູ້ຂໍຈະເຫັນເຫດຜົນນີ້'}</p>
                  </div>
                )}

                {reviewError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reviewError}</div>
                )}

                {confirmType === 'approve' && linkedPending.length > 0 && (
                  <div className="space-y-2">
                    {linkedPending.map((it, k) => (
                      <button
                        key={`${it.purchaseRequestId}-${k}`}
                        type="button"
                        onClick={() => openPR(it.purchaseRequestId)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-lg text-sm font-medium transition"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <ShoppingCart size={14} />
                          <span className="truncate">
                            ໄປອະນຸມັດໃບສະເໜີຊື້ {it.purchaseRequestNo || ''} — {it.name}
                          </span>
                        </span>
                        <ExternalLink size={14} className="shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeConfirm}
                  disabled={busy}
                  className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={busy || ((confirmType === 'reject' || confirmType === 'changes') && !rejectReason.trim())}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                    confirmType === 'approve' ? 'bg-green-600 hover:bg-green-700' : confirmType === 'changes' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {busy ? 'ກຳລັງດຳເນີນການ...' : confirmType === 'approve' ? 'ຢືນຢັນອະນຸມັດ' : confirmType === 'changes' ? 'ສົ່ງຄືນໃຫ້ແກ້ໄຂ' : 'ຢືນຢັນປະຕິເສດ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderRequestRows = (list) => (
      <div className="divide-y divide-gray-100">
        {list.map((req) => {
          const requesterName = requesterNameOf(req);
          const totalQty = Array.isArray(req.items) ? req.items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0;

          return (
            <div
              key={req._id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailReqId(req._id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailReqId(req._id);
                }
              }}
              title="ກົດເພື່ອເບິ່ງລາຍລະອຽດ"
              className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-amber-50/40 focus:outline-none focus-visible:bg-amber-50/60 transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800">{req._id}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{totalQty} ຊິ້ນ</span>
                  <SourceBadge req={req} />
                </div>
                <div className="text-xs text-gray-600">
                  {Array.isArray(req.items) && req.items.map((i, idx) => (
                    <div key={idx}>• {i.name} (x{i.quantity}){i.reason ? ` — ${i.reason}` : ''}</div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  ຜູ້ຂໍ: {requesterName}{req.managerDepartmentId?.name ? ` (ພະແນກ ${req.managerDepartmentId.name})` : ''} · ວັນທີຍື່ນ: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </div>
          );
        })}
      </div>
  );

  const renderHistoryBox = (kind, list) => {
    const shown = historyShown[kind] ?? 10;
    const rows = list.slice(0, shown);

    const decisionLines = (req) => {
      const lines = [];
      if (req.managerRejectedAt || req.managerRejectedBy) {
        lines.push({
          stage: 'manager',
          ok: false,
          text: `ຫົວໜ້າພະແນກ ${personOf(req.managerRejectedBy)} ປະຕິເສດ · ${fmtDateTime(req.managerRejectedAt)}`,
          reason: req.rejectionReason,
        });
      } else if (req.managerApprovedAt) {
        lines.push({
          stage: 'manager',
          ok: true,
          text: `ຫົວໜ້າພະແນກ ${personOf(req.managerApprovedBy)} ອະນຸມັດ${req.managerApprovedAsSubstitute ? ' (ແທນ)' : ''} · ${fmtDateTime(req.managerApprovedAt)}`,
        });
      }
      if (req.approvedAt) {
        const rejected = req.status === 'REJECTED';
        lines.push({
          stage: 'warehouse',
          ok: !rejected,
          text: `ຝ່າຍສາງ ${personOf(req.approvedBy)} ${rejected ? 'ປະຕິເສດ' : 'ອະນຸມັດ'} · ${fmtDateTime(req.approvedAt)}`,
          reason: rejected ? req.rejectionReason : undefined,
        });
      }
      return lines;
    };

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-bold text-gray-800">ປະຫວັດຄຳຂໍ</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {kind === 'manager'
                ? 'ຄຳຂໍທີ່ທ່ານ (ຫຼືຜູ້ແທນ) ອະນຸມັດ/ປະຕິເສດໄປແລ້ວ — ໃໝ່ສຸດຢູ່ເທິງ'
                : 'ຄຳຂໍທີ່ຝ່າຍສາງດຳເນີນການແລ້ວ (ອະນຸມັດ, ປະຕິເສດ, ສັ່ງຊື້, ຮັບຂອງ, ປິດ) — ໃໝ່ສຸດຢູ່ເທິງ'}
            </p>
          </div>
          {list.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium shrink-0">
              {list.length} ລາຍການ
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div className="py-8 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">ຍັງບໍ່ມີປະຫວັດຄຳຂໍ</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((req) => {
              const items = Array.isArray(req.items) ? req.items : [];
              const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
              const readyLines = items.filter((i) => i.lineStatus === 'READY').length;
              const badge = readyLines > 0 && ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(req.status)
                ? { text: `ພ້ອມມາຮັບ ${readyLines} ລາຍການ`, cls: 'bg-teal-100 text-teal-700' }
                : HISTORY_STATUS[req.status] || { text: req.status, cls: 'bg-gray-100 text-gray-600' };
              const lines = decisionLines(req);
              const expanded = expandedHistoryId === req._id;
              const lastLine = lines[lines.length - 1];
              const deptName = req.departmentId && typeof req.departmentId === 'object' ? req.departmentId.name : null;
              return (
                <div key={req._id} className="p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedHistoryId(expanded ? null : req._id)}
                    className="w-full flex items-start justify-between gap-4 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{req._id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.text}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{totalQty} ຊິ້ນ</span>
                        <SourceBadge req={req} />
                      </div>
                      <div className="text-xs text-gray-600">
                        {items.slice(0, 2).map((i, idx) => (
                          <div key={idx}>• {i.name} (x{i.quantity})<LineBadge item={i} /></div>
                        ))}
                        {items.length > 2 && <div className="text-gray-400">+ ອີກ {items.length - 2} ລາຍການ</div>}
                      </div>
                      <p className="text-xs text-gray-500">
                        ຜູ້ຂໍ: {requesterNameOf(req)}{deptName ? ` (ແຜນກ ${deptName})` : req.managerDepartmentId?.name ? ` (ພະແນກ ${req.managerDepartmentId.name})` : ''} · ຍື່ນ: {fmtDate(req.createdAt)}
                      </p>
                      {lastLine && (
                        <p className={`text-xs ${lastLine.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                          {lastLine.text}
                          {lastLine.reason ? ` — ${lastLine.reason}` : ''}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-300 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expanded && (
                    <div className="mt-3 ml-1 pl-4 border-l-2 border-gray-100 space-y-3 text-xs text-gray-600">
                      <div>
                        <div className="text-[11px] text-gray-400 mb-1">ລາຍການທີ່ຂໍ</div>
                        {items.map((i, idx) => (
                          <div key={idx}>
                            • {i.name} (x{i.quantity}){i.reason ? ` — ${i.reason}` : ''}<LineBadge item={i} />
                            {i.lineNote ? <span className="text-gray-400"> · {i.lineNote}</span> : null}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        <div>ວັນທີ-ເວລາຍື່ນ: {fmtDateTime(req.createdAt)}</div>
                        <div>ອັບເດດຫຼ້າສຸດ: {fmtDateTime(req.updatedAt)}</div>
                        {req.custodianId && <div>ຜູ້ຮັບຜິດຊອບ: {personOf(req.custodianId)}</div>}
                        {req.delegateId && <div>ຜູ້ຮັບແທນ: {personOf(req.delegateId)}</div>}
                      </div>
                      {lines.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-gray-400">ຂັ້ນຕອນການອະນຸມັດ</div>
                          {lines.map((l, idx) => (
                            <div key={idx} className={l.ok ? 'text-emerald-700' : 'text-red-600'}>
                              {l.ok ? '✓' : '✗'} {l.text}
                              {l.reason ? ` — ເຫດຜົນ: ${l.reason}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {list.length > shown && (
          <button
            type="button"
            onClick={() => setHistoryShown((prev) => ({ ...prev, [kind]: shown + 10 }))}
            className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition"
          >
            ສະແດງເພີ່ມ ({list.length - shown} ລາຍການ)
          </button>
        )}
      </div>
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'lowStockThreshold' ? Number(value) : value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      const { trackMode, ...rest } = formData;
      const body = { ...rest, ...(TRACK_TO_BODY[trackMode] || {}) };
      await api.patch(`/supply-catalog/${editingId}`, body);
      setIsModalOpen(false);
      setEditingId(null);
      fetchCatalog();
    } catch (error) {
      setErrorMsg(apiMsg(error, 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderDetailModal = () => {
    const isConsumable = historyItem.itemType === 'CONSUMABLE';
    const nameOfUser = (id) => (id ? lookups.users[String(id)] || String(id) : '—');
    const nameOfBranch = (id) => (id ? lookups.branches[String(id)] || String(id) : '—');
    const nameOfDept = (id) => (id ? lookups.departments[String(id)] || String(id) : '—');
    const assetById = new Map(assetRows.map((a) => [String(a._id), a]));
    const receiptByAssetId = new Map();
    historyRows.forEach((r) => (r.assetIds || []).forEach((id) => receiptByAssetId.set(String(id), r)));
    const liveItem = assets.find((x) => x._id === historyItem._id) || historyItem;
    const addTo = (setter, id) => setter((prev) => new Set(prev).add(String(id)));
    const toggleIn = (setter, id) => setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    const jumpToAsset = (id) => { setDetailTab('assets'); setAssetSearch(''); setAssetStatuses([]); addTo(setExpandedAssets, id); };
    const jumpToReceipt = (id) => { setDetailTab('receipts'); setReceiptSearch(''); setReceiptModes([]); setReceiptFrom(''); setReceiptTo(''); addTo(setExpandedReceipts, id); };


    const actionBtn = (onClick, Icon, label, tone, disabled = false) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap bg-white disabled:opacity-40 ${tone}`}
      >
        <Icon size={14} />
        {label}
      </button>
    );
    const TONE = {
      gray: 'border-gray-200 text-gray-700 hover:bg-gray-50',
      blue: 'border-blue-200 text-blue-600 hover:bg-blue-50',
      green: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
      amber: 'border-amber-200 text-amber-700 hover:bg-amber-50',
      red: 'border-red-200 text-red-600 hover:bg-red-50',
    };
    const receiptActions = (r) => actionBtn(() => setPrintReceiptId(String(r._id)), Printer, 'ພິມໃບຮັບເຄື່ອງ', TONE.gray);
    const assetActions = (a) => {
      const busy = busyAssetId === String(a._id);
      return (
        <>
          {actionBtn(() => setHistoryAsset(a), History, 'ປະຫວັດການມອບໝາຍ', TONE.gray)}
          {actionBtn(() => setBarcodeAsset(a), Barcode, 'Barcode / QR', TONE.gray)}
          {canAssignAsset && a.status !== 'RETIRED' && a.status !== 'ASSIGNED' && actionBtn(() => setAssignAsset(a), UserCheck, 'ມອບໝາຍ', TONE.blue, busy)}
          {canAssignAsset && a.status === 'ASSIGNED' && actionBtn(() => handleAssetReturn(a), Undo2, 'ຮັບຄືນ', TONE.green, busy)}
          {canUpdateAsset && a.status !== 'RETIRED' && a.status !== 'UNDER_REPAIR' && actionBtn(() => handleAssetStatus(a, 'UNDER_REPAIR'), Wrench, 'ສົ່ງສ້ອມແປງ', TONE.amber, busy)}
          {canUpdateAsset && a.status === 'UNDER_REPAIR' && actionBtn(() => handleAssetStatus(a, 'AVAILABLE'), CheckCircle, 'ສ້ອມແລ້ວ', TONE.green, busy)}
          {canUpdateAsset && a.status !== 'RETIRED' && actionBtn(() => handleAssetStatus(a, 'RETIRED'), Archive, 'ປົດລະວາງ / ເລີກໃຊ້', TONE.gray, busy)}
          {canDeleteAsset && actionBtn(() => handleAssetDelete(a), Trash2, 'ລຶບ', TONE.red, busy)}
        </>
      );
    };
    const isLowStock = liveItem.stockQty <= liveItem.lowStockThreshold;
    const summary = receiptSummary[liveItem._id];
    const summaryBadge = summary ? (MODE_BADGE[summary.mode] || MODE_BADGE.RESTOCK) : null;
    const catalogActions = (
      <>
        {canCreateCatalog && liveItem.isActive !== false && actionBtn(() => openCreateModal('RESTOCK', liveItem._id), PackagePlus, 'ຮັບເຂົ້າ', TONE.green)}
        {canUpdateCatalog && actionBtn(() => openEdit(liveItem), Pencil, 'ແກ້ໄຂ', TONE.amber)}
        {canUpdateCatalog && liveItem.itemType !== 'ASSET' && actionBtn(() => openAdjust(liveItem), ArrowUpDown, 'ປັບສະຕ໊ອກ', TONE.blue)}
        {canDeleteCatalog && liveItem.isActive !== false && actionBtn(() => handleDisable(liveItem), Ban, 'ປິດໃຊ້ງານ', TONE.red)}
      </>
    );
    const tabCls = (key) =>
      `pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
        detailTab === key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`;

    const holderText = (a) => {
      if (!a.currentAssigneeId) return '—';
      if (a.holderType === 'DEPARTMENT') return `${nameOfDept(a.departmentId)} (${nameOfUser(a.currentAssigneeId)})`;
      return nameOfUser(a.currentAssigneeId);
    };

    const shownReceipts = historyRows.filter((r) => {
      const q = receiptSearch.trim().toLowerCase();
      if (q && !receiptHay(r, lookups).includes(q)) return false;
      if (receiptModes.length > 0 && !receiptModes.includes(r.mode)) return false;
      const d = r.receivedDate ? new Date(r.receivedDate) : null;
      if (receiptFrom && (!d || d < new Date(`${receiptFrom}T00:00:00`))) return false;
      if (receiptTo && (!d || d > new Date(`${receiptTo}T23:59:59`))) return false;
      return true;
    });
    const shownAssets = assetRows.filter((a) => {
      const q = assetSearch.trim().toLowerCase();
      if (q && !assetHay(a, lookups, receiptByAssetId.get(String(a._id))?.receiptNo).includes(q)) return false;
      if (assetStatuses.length > 0 && !assetStatuses.includes(a.status)) return false;
      return true;
    });
    const toggleChip = (setter, key) => setter((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
    const receiptFiltered = !!(receiptSearch.trim() || receiptModes.length || receiptFrom || receiptTo);
    const assetFiltered = !!(assetSearch.trim() || assetStatuses.length);
    const clearReceiptFilters = () => { setReceiptSearch(''); setReceiptModes([]); setReceiptFrom(''); setReceiptTo(''); };
    const clearAssetFilters = () => { setAssetSearch(''); setAssetStatuses([]); };
    const chipCls = (on) =>
      `px-2.5 py-1 rounded-full text-xs font-medium border transition ${on ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`;
    const isReceiptTab = detailTab === 'receipts';
    const tabIds = isReceiptTab
      ? shownReceipts.map((r) => String(r._id))
      : (isConsumable ? [] : shownAssets.map((a) => String(a._id)));
    const tabExpanded = isReceiptTab ? expandedReceipts : expandedAssets;
    const allOpen = tabIds.length > 0 && tabIds.every((id) => tabExpanded.has(id));
    const toggleAll = () => (isReceiptTab ? setExpandedReceipts : setExpandedAssets)(allOpen ? new Set() : new Set(tabIds));

    return (
      <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryItem(null)}>
        <div
          className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] shadow-xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between px-6 pt-5 pb-3">
            <div className="flex items-start gap-4 min-w-0">
              {liveItem.imageUrl ? (
                <a href={imageSrc(liveItem.imageUrl)} target="_blank" rel="noreferrer" title="ເປີດຮູບເຕັມ">
                  <CatalogThumb url={liveItem.imageUrl} name={liveItem.name} size={88} />
                </a>
              ) : (
                <CatalogThumb url="" size={88} />
              )}
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-800">{historyItem.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {historyItem._id}
                {trackModeOf(historyItem) ? ` · ${TRACK_LABEL[trackModeOf(historyItem)]}` : ''}
                {` · ສະຕັອກ ${liveItem.stockQty} ${liveItem.unit || ''}`}
              </p>
            </div>
            </div>
            <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ"><X size={20} /></button>
          </div>

          <div className="mx-6 mb-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <Info label="ລະຫັດ">{liveItem._id}</Info>
              <Info label="ຊື່">{liveItem.name}</Info>
              <Info label="ໝວດໝູ່">{liveItem.category || '—'}</Info>
              <Info label="ໜ່ວຍ">{liveItem.unit || '—'}</Info>
              <Info label="ວິທີຕິດຕາມ">{trackModeOf(liveItem) ? TRACK_LABEL[trackModeOf(liveItem)] : 'ຍັງບໍ່ກຳນົດ'}</Info>
              <Info label="ສະຕັອກ">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{liveItem.stockQty}</span>
                {isLowStock && <span className="ml-1 text-xs text-red-600">(ໃກ້ໝົດ)</span>}
              </Info>
              <Info label="ສະຕັອກຕ່ຳສຸດ">{liveItem.lowStockThreshold}</Info>
              <Info label="ສະຖານະ">
                <span className={`px-2 py-0.5 rounded-full text-xs ${liveItem.isActive !== false ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  {liveItem.isActive !== false ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                </span>
              </Info>
              <Info label="ຮັບເຂົ້າຄັ້ງຫຼ້າສຸດ" wide>
                {summary ? (
                  <>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${summaryBadge.cls}`}>{summaryBadge.text}</span>
                    {' '}{summary.receivedDate ? fmtDate(summary.receivedDate) : ''} +{summary.quantity}
                  </>
                ) : '—'}
              </Info>
              <Info label="ຮັບເຂົ້າທັງໝົດ">{historyRows.length} ຄັ້ງ</Info>
              <Info label="ຊັບສິນໃນທະບຽນ">{isConsumable ? '—' : `${assetRows.length} ລາຍການ`}</Info>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400 mr-1">ຈັດການລາຍການນີ້:</span>
              {catalogActions}
            </div>
          </div>

          <div className="flex gap-6 px-6 border-b border-gray-100">
            <button onClick={() => setDetailTab('receipts')} className={tabCls('receipts')}>
              <PackagePlus size={15} /> ຮັບເຄື່ອງເຂົ້າຄັງ
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{historyRows.length}</span>
            </button>
            <button onClick={() => setDetailTab('assets')} className={tabCls('assets')}>
              <Package size={15} /> ທະບຽນຊັບສິນບໍລິສັດ
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{isConsumable ? '—' : assetRows.length}</span>
            </button>
            <div className="ml-auto self-center mb-2 flex items-center gap-2">
              {isReceiptTab ? (
                <button
                  type="button"
                  onClick={() => navigate(`/goods-receipt?q=${encodeURIComponent(liveItem._id)}`)}
                  title="ເປີດໃນໜ້າຮັບເຄື່ອງເຂົ້າຄັງ"
                  className="px-2.5 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <ExternalLink size={14} />
                  <span className="text-xs font-medium">ເປີດໃນໜ້າຮັບເຄື່ອງເຂົ້າຄັງ</span>
                </button>
              ) : (
                hasPermission('assets', 'read') && !isConsumable && (
                  <button
                    type="button"
                    onClick={() => navigate(`/asset-registry?search=${encodeURIComponent(`${liveItem._id}-`)}`)}
                    title="ເປີດໃນໜ້າທະບຽນຊັບສິນບໍລິສັດ"
                    className="px-2.5 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    <ExternalLink size={14} />
                    <span className="text-xs font-medium">ເປີດໃນໜ້າທະບຽນຊັບສິນບໍລິສັດ</span>
                  </button>
                )
              )}
            <button
              type="button"
              onClick={toggleAll}
              disabled={tabIds.length === 0}
              title={allOpen ? 'ຫຍໍ້ທັງໝົດ' : 'ຂະຫຍາຍທັງໝົດ'}
              aria-label={allOpen ? 'ຫຍໍ້ທັງໝົດ' : 'ຂະຫຍາຍທັງໝົດ'}
              className="px-2.5 py-1.5 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              {allOpen ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
              <span className="text-xs font-medium">{allOpen ? 'ຫຍໍ້ທັງໝົດ' : 'ຂະຫຍາຍທັງໝົດ'}</span>
            </button>
            </div>
          </div>

          {detailTab === 'receipts' && historyRows.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ: ເລກໃບຮັບ, ຜູ້ຂາຍ, ໃບບິນ, S/N, Asset Tag, ໝາຍເຫດ..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {Object.entries(MODE_BADGE).map(([key, m]) => (
                <button key={key} type="button" onClick={() => toggleChip(setReceiptModes, key)} className={chipCls(receiptModes.includes(key))}>{m.text}</button>
              ))}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>ວັນທີ</span>
                <input type="date" value={receiptFrom} onChange={(e) => setReceiptFrom(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                <span>–</span>
                <input type="date" value={receiptTo} onChange={(e) => setReceiptTo(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
              </div>
              <span className="text-xs text-gray-400">ສະແດງ {shownReceipts.length} / {historyRows.length}</span>
              {receiptFiltered && <button type="button" onClick={clearReceiptFilters} className="text-xs text-red-500 hover:underline">ລ້າງຕົວກອງ</button>}
            </div>
          )}
          {detailTab === 'assets' && !isConsumable && assetRows.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ: Asset Tag, S/N, ຜູ້ຖື, ສາຂາ, ເລກໃບຮັບ..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {Object.entries(ASSET_STATUS).map(([key, st]) => (
                <button key={key} type="button" onClick={() => toggleChip(setAssetStatuses, key)} className={chipCls(assetStatuses.includes(key))}>{st.text}</button>
              ))}
              <span className="text-xs text-gray-400">ສະແດງ {shownAssets.length} / {assetRows.length}</span>
              {assetFiltered && <button type="button" onClick={clearAssetFilters} className="text-xs text-red-500 hover:underline">ລ້າງຕົວກອງ</button>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/40">
            {detailTab === 'receipts' && (
              historyLoading ? (
                <p className="text-center text-sm text-gray-400 py-10">ກຳລັງໂຫຼດ...</p>
              ) : historyError ? (
                <p className="text-center text-sm text-red-500 py-10">⚠️ {historyError}</p>
              ) : historyRows.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">ຍັງບໍ່ເຄີຍຮັບເຂົ້າ</p>
              ) : (
                shownReceipts.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-10">ບໍ່ພົບໃບຮັບທີ່ກົງກັບການຄົ້ນຫາ / ຕົວກອງ</p>
                ) : shownReceipts.map((r) => {
                  const m = MODE_BADGE[r.mode] || MODE_BADGE.RESTOCK;
                  const open = expandedReceipts.has(String(r._id));
                  const ids = (r.assetIds || []).map(String);
                  return (
                    <div key={r._id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                      <div className="hover:bg-gray-50">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleIn(setExpandedReceipts, String(r._id))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                        <span className="font-mono text-xs text-gray-500 w-16 shrink-0">{r.receiptNo || '—'}</span>
                        <span className="text-xs text-gray-500 w-24 shrink-0">{fmtDate(r.receivedDate)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${m.cls}`}>{m.text}</span>
                        <span className="font-semibold text-gray-800 text-sm">+{r.quantity} {r.unit || ''}</span>
                        <span className="ml-auto text-xs text-gray-500 text-right">
                          {r.totalPrice != null ? fmtMoney(r.totalPrice) : ''}
                        </span>
                      </button>
                      {!open && <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-11">{receiptActions(r)}</div>}
                      </div>
                      {open && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          <Info label="ສະຕັອກ">{r.stockBefore ?? '—'} → {r.stockAfter ?? '—'}</Info>
                          <Info label="ສາຂາ">{nameOfBranch(r.branchId)}</Info>
                          <Info label="ຄາດວ່າ / ນັບໄດ້">{r.expectedQuantity != null ? `${r.expectedQuantity} / ${r.quantity}` : '—'}</Info>
                          <Info label="ຜູ້ຂາຍ">{r.vendor || '—'}</Info>
                          <Info label="ຫ້ອງເກັບ">{r.storageRoom || '—'}</Info>
                          <Info label="ໃບສະເໜີຊື້">{r.purchaseRequestNo || '—'}</Info>
                          <Info label="ລາຄາ/ໜ່ວຍ">{fmtMoney(r.unitPrice)}</Info>
                          <Info label="ໃບບິນ">
                            {r.invoiceNo || '—'}
                            {r.invoiceFileUrl && (
                              <a href={`${API_ORIGIN}${r.invoiceFileUrl}`} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline font-normal">
                                ເປີດໄຟລ໌
                              </a>
                            )}
                          </Info>
                          {r.exceptionReason && (
                            <div className="sm:col-span-2 text-amber-700">
                              <span className="font-medium">ຂໍ້ຍົກເວັ້ນ (ບໍ່ມີໃບສະເໜີ): </span>{r.exceptionReason}
                            </div>
                          )}
                          {r.countNote && <Info label="ໝາຍເຫດການນັບ" wide>{r.countNote}</Info>}
                          {r.note && <Info label="ໝາຍເຫດ" wide>{r.note}</Info>}
                          {r.serialNumbers?.length > 0 && <Info label="S/N" wide>{r.serialNumbers.join(', ')}</Info>}
                          {ids.length > 0 && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-400">Asset Tag: </span>
                              {assetRows.length > 0 ? (
                                <span className="inline-flex flex-wrap gap-1 align-middle">
                                  {ids.map((id) => {
                                    const a = assetById.get(id);
                                    return a ? (
                                      <button
                                        key={id}
                                        type="button"
                                        onClick={() => jumpToAsset(id)}
                                        title="ເບິ່ງລາຍລະອຽດຊັບສິນ"
                                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 font-mono text-gray-700 hover:border-amber-400 hover:text-amber-700"
                                      >
                                        {a.assetTag}
                                      </button>
                                    ) : null;
                                  })}
                                </span>
                              ) : (
                                <span className="text-gray-800 font-medium">{(r.assetTags || []).join(', ') || '—'}</span>
                              )}
                            </div>
                          )}
                          <div className="sm:col-span-2 text-gray-400">ບັນທຶກໂດຍ {personOf(r.createdBy)}</div>
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">{receiptActions(r)}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}

            {detailTab === 'assets' && (
              isConsumable ? (
                <p className="text-center text-sm text-gray-400 py-10">ລາຍການນີ້ເປັນວັດສະດຸສິ້ນເປືອງ — ນັບຈຳນວນ ບໍ່ມີທະບຽນຊັບສິນລາຍຊິ້ນ</p>
              ) : assetsLoading ? (
                <p className="text-center text-sm text-gray-400 py-10">ກຳລັງໂຫຼດ...</p>
              ) : assetsError ? (
                <p className="text-center text-sm text-red-500 py-10">⚠️ {assetsError}</p>
              ) : assetRows.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">ຍັງບໍ່ມີຊັບສິນໃນທະບຽນສຳລັບລາຍການນີ້</p>
              ) : (
                shownAssets.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-10">ບໍ່ພົບຊັບສິນທີ່ກົງກັບການຄົ້ນຫາ / ຕົວກອງ</p>
                ) : shownAssets.map((a) => {
                  const st = ASSET_STATUS[a.status] || { text: a.status, cls: 'bg-gray-100 text-gray-600' };
                  const open = expandedAssets.has(String(a._id));
                  const receipt = receiptByAssetId.get(String(a._id));
                  const warrantyExpired = a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date();
                  const history = [...(a.assignmentHistory || [])].reverse().slice(0, 5);
                  return (
                    <div key={a._id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                      <div className="hover:bg-gray-50">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleIn(setExpandedAssets, String(a._id))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                        <span className="font-mono text-sm font-semibold text-gray-800 shrink-0">{a.assetTag}</span>
                        <span className="text-xs text-gray-500 truncate">{a.serialNumber ? `S/N ${a.serialNumber}` : 'ບໍ່ມີ S/N'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.text}</span>
                        <span className="ml-auto text-xs text-gray-500 text-right truncate">{holderText(a)}</span>
                      </button>
                      {!open && <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-11">{assetActions(a)}</div>}
                      </div>
                      {open && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          <Info label="ສາຂາ">{nameOfBranch(a.branchId)}</Info>
                          <Info label="ຜູ້ຖື">{holderText(a)}</Info>
                          <Info label="ວັນທີຊື້">{fmtDate(a.purchaseDate)}</Info>
                          <Info label="ລາຄາຊື້">{fmtMoney(a.purchasePrice)}</Info>
                          <Info label="ຮັບປະກັນຮອດ">
                            {fmtDate(a.warrantyExpiry)}
                            {warrantyExpired && <span className="ml-1 text-red-600">(ໝົດແລ້ວ)</span>}
                          </Info>
                          <Info label="ໃບຮັບເຄື່ອງ">
                            {receipt ? (
                              <button type="button" onClick={() => jumpToReceipt(receipt._id)} className="text-blue-600 hover:underline">
                                {receipt.receiptNo || 'ເບິ່ງໃບຮັບ'}
                              </button>
                            ) : '—'}
                          </Info>
                          <div className="sm:col-span-2 mt-1">
                            <div className="text-gray-400 mb-1">ປະຫວັດການມອບ (ຫຼ້າສຸດ {history.length || 0})</div>
                            {history.length === 0 ? (
                              <div className="text-gray-500">ຍັງບໍ່ເຄີຍມອບ</div>
                            ) : (
                              <ul className="space-y-1">
                                {history.map((h, i) => (
                                  <li key={i} className="text-gray-700">
                                    • {nameOfUser(h.assigneeId)}
                                    {h.departmentId ? ` (ພະແນກ ${nameOfDept(h.departmentId)})` : ''}
                                    {' — '}{fmtDate(h.assignedAt)} → {h.returnedAt ? fmtDate(h.returnedAt) : 'ຍັງຖືຢູ່'}
                                    {h.note ? <span className="text-gray-400"> · {h.note}</span> : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="sm:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/assets/${a._id}`)}
                              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-white"
                            >
                              ເປີດໜ້າລາຍລະອຽດຊັບສິນ
                            </button>
                            <div className="flex flex-wrap items-center gap-1.5">{assetActions(a)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>
      {assignAsset && (
        <AssignAssetModal
          asset={assignAsset}
          onClose={() => setAssignAsset(null)}
          onDone={() => { setAssignAsset(null); reloadAssetRows(historyItem._id); }}
        />
      )}
      {barcodeAsset && (
        <AssetBarcodeModal
          asset={barcodeAsset}
          holderLabel={barcodeAsset.currentAssigneeId ? holderText(barcodeAsset) : ''}
          onClose={() => setBarcodeAsset(null)}
        />
      )}
      {historyAsset && (
        <AssignmentHistoryModal asset={historyAsset} nameOfUser={nameOfUser} onClose={() => setHistoryAsset(null)} />
      )}
      {printReceiptId && <GoodsReceiptPrint receiptId={printReceiptId} onClose={() => setPrintReceiptId('')} />}
      </>
    );
  };

  const mainQuery = searchQuery.trim().toLowerCase();
  const filteredAssets = assets.filter(item => {
    const q = mainQuery;
    const sm = subMatchOf(item, q);
    const matchesSearch = !q || [item.name, item._id, item.category, item.unit]
      .filter(Boolean).some(f => f.toLowerCase().includes(q)) || sm.receipts + sm.assets > 0;
    const status = item.isActive !== false ? 'active' : 'inactive';
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(status);
    const isLowStock = item.stockQty <= item.lowStockThreshold;
    const matchesStock = stockFilter.length === 0 ||
      (stockFilter.includes('low') && isLowStock) ||
      (stockFilter.includes('ok') && !isLowStock);
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(item.category);
    return matchesSearch && matchesStatus && matchesStock && matchesCategory;
  });

  const knownCategories = [...new Set(assets.map(a => a.category).filter(Boolean))].sort();

  const activeFilterCount = statusFilter.length + stockFilter.length + categoryFilter.length;

  useEffect(() => {
    if (searchParams.get('create') === '1') navigate('/goods-receipt?new=1', { replace: true });
  }, [searchParams, navigate]);

  const deepRequestId = searchParams.get('request');
  useEffect(() => {
    if (!deepRequestId || loadingPending) return;
    if (pendingRequests.some((r) => r._id === deepRequestId)) {
      setActiveTab('pending');
      setDetailReqId(deepRequestId);
      navigate('/assets', { replace: true });
    } else {
      navigate(`/supplies?open=${encodeURIComponent(deepRequestId)}`, { replace: true });
    }
  }, [deepRequestId, loadingPending, pendingRequests]);

  const managerReviewId = searchParams.get('managerReview');
  useEffect(() => {
    if (!managerReviewId || loadingManager) return;
    if (managerRequests.some((r) => r._id === managerReviewId)) {
      setActiveTab('manager');
      setDetailReqId(managerReviewId);
    } else if (managerAvailable) {
      setActiveTab('manager');
    }
    navigate('/assets', { replace: true });
  }, [managerReviewId, loadingManager, managerRequests]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການລາຍການອຸປະກອນ (Supply Catalog)</h1>
            <p className="text-sm text-gray-500 mt-1">ທະບຽນ ແລະ ຕິດຕາມສະຕັອກອຸປະກອນສຳນັກງານ</p>
          </div>
          {activeTab === 'catalog' && (
            <div className="flex items-center gap-3">
              {canImportCatalog && (
                <CsvImportButton
                  endpoint="/supply-catalog/bulk-import"
                  refresh={fetchCatalog}
                  permitted={canImportCatalog}
                  csvHint="CSV ຖັນ: name, category, unit — ຈຳເປັນ; itemType (ASSET/CONSUMABLE), trackSerial (true/false), stockQty, lowStockThreshold, isActive — ເພີ່ມໄດ້"
                />
              )}
              <CsvExportButton
                data={filteredAssets}
                filename="supply-catalog.csv"
                label="Export CSV"
                permitted={hasPermission('supplies', 'read')}
                columns={[
                  { key: '_id', label: 'id' },
                  { key: 'name', label: 'name' },
                  { key: 'category', label: 'category' },
                  { key: 'unit', label: 'unit' },
                  { key: 'itemType', label: 'itemType' },
                  { key: 'trackSerial', label: 'trackSerial' },
                  { key: 'stockQty', label: 'stockQty' },
                  { key: 'lowStockThreshold', label: 'lowStockThreshold' },
                  { key: 'isActive', label: 'isActive' },
                ]}
              />
              {canCreateCatalog && (
                <button
                  onClick={handleRecalculateStock}
                  title="ແກ້ສະຕ໊ອກທີ່ບໍ່ກົງກັບຈຳນວນຊັບສິນວ່າງ"
                  className="border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  ຄຳນວນສະຕ໊ອກໃໝ່
                </button>
              )}
              {(canCreateCatalog || canAddAsset) && (
                <div className="relative" ref={createMenuRef}>
                  <button
                    type="button"
                    onClick={() => setCreateMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={createMenuOpen}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Plus size={18} />
                    <span>ສ້າງ Catalog</span>
                    <ChevronDown size={16} />
                  </button>
                  {createMenuOpen && (
                    <div role="menu" className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-1.5">
                      {canCreateCatalog && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openCreateModal('RESTOCK')}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-start gap-3"
                          >
                            <PackagePlus size={18} className="text-amber-600 mt-0.5 shrink-0" />
                            <span>
                              <span className="block text-sm font-medium text-gray-800">ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກ</span>
                              <span className="block text-xs text-gray-500">ຮັບເຄື່ອງເຂົ້າຄັງ · ລາຍການທີ່ມີໃນ Catalog</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openCreateModal('NEW_ITEM')}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-start gap-3"
                          >
                            <ShoppingCart size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                            <span>
                              <span className="block text-sm font-medium text-gray-800">ຊື້ເຄື່ອງເຂົ້າສະຕັອກ</span>
                              <span className="block text-xs text-gray-500">ຮັບເຄື່ອງເຂົ້າຄັງ · ລາຍການໃໝ່</span>
                            </span>
                          </button>
                        </>
                      )}
                      {canAddAsset && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openCreateModal('ASSET')}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-start gap-3"
                        >
                          <Package size={18} className="text-blue-600 mt-0.5 shrink-0" />
                          <span>
                            <span className="block text-sm font-medium text-gray-800">ເພີ່ມຊັບສິນ</span>
                            <span className="block text-xs text-gray-500">ທະບຽນຊັບສິນບໍລິສັດ</span>
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'catalog' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍການອຸປະກອນ (Catalog)
          </button>
          {(managerAvailable || managerRequests.length > 0) && (
            <button
              onClick={() => setActiveTab('manager')}
              className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${activeTab === 'manager' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <span>ຄຳຂໍລໍຖ້າຫົວໜ້າພະແນກ</span>
              {managerRequests.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {managerRequests.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span>ຄຳຂໍອຸປະກອນຈາກພະແນກ</span>
            {pendingRequests.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'manager' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" />
                <h2 className="font-bold text-gray-800">ຄຳຂໍຈາກພະນັກງານໃນພະແນກຂອງທ່ານ</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">ອະນຸມັດແລ້ວ ຄຳຂໍຈະຖືກສົ່ງຕໍ່ໄປແຖບ "ຄຳຂໍອຸປະກອນຈາກພະແນກ" ເພື່ອໃຫ້ຝ່າຍສາງດຳເນີນການຕໍ່</p>
            </div>
            {managerRequests.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                {managerRequests.length} ລາຍການ
              </span>
            )}
          </div>
          {loadingManager ? (
            <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
          ) : managerError ? (
            <div className="py-10 text-center text-sm text-red-500 px-4">⚠️ {managerError}</div>
          ) : managerRequests.length > 0 ? (
            renderRequestRows(managerRequests)
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຄຳຂໍທີ່ລໍຖ້າທ່ານອະນຸມັດ</div>
          )}
        </div>
        )}

        {activeTab === 'manager' && <div className="mt-6">{renderHistoryBox('manager', managerHistory)}</div>}

        {activeTab === 'pending' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              <h2 className="font-bold text-gray-800">ຄຳຂໍອຸປະກອນທີ່ລໍຖ້າອະນຸມັດ</h2>
            </div>
            {pendingRequests.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                {pendingRequests.length} ລາຍການ
              </span>
            )}
          </div>

          {loadingPending ? (
            <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
          ) : pendingError ? (
            <div className="py-10 text-center text-sm text-red-500 px-4">⚠️ {pendingError}</div>
          ) : pendingRequests.length > 0 ? (
            renderRequestRows(pendingRequests)
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຄຳຂໍລໍຖ້າອະນຸມັດ</div>
          )}
        </div>
        )}

        {activeTab === 'pending' && <div className="mt-6">{renderHistoryBox('pending', warehouseHistory)}</div>}

        {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ຄົ້ນຫາຊື່, ລະຫັດ, ໝວດໝູ່, ຫົວໜ່ວຍ, S/N, Asset Tag, ເລກໃບຮັບ, ຜູ້ຂາຍ..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border shrink-0 ${
                  lowStockOnly
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle size={16} />
                <span>{lowStockOnly ? 'ສະແດງທັງໝົດ' : 'ສະຕັອກໃກ້ໝົດ'}</span>
              </button>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
                >
                  <Filter size={16} />
                  <span>FILTER</span>
                  {activeFilterCount > 0 && (
                    <span key={activeFilterCount}>({activeFilterCount})</span>
                  )}
                </button>

                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-[30rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ສະຖານະ</p>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={statusFilter.includes('active')} onChange={() => toggleStatusFilter('active')} className="rounded" />
                          ເປີດໃຊ້ງານ
                        </label>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={statusFilter.includes('inactive')} onChange={() => toggleStatusFilter('inactive')} className="rounded" />
                          ປິດໃຊ້ງານ
                        </label>
                      </div>
                      <div className="border-l border-gray-100 pl-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ສະຕັອກ</p>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={stockFilter.includes('low')} onChange={() => toggleStockFilter('low')} className="rounded" />
                          ໃກ້ໝົດ / ໝົດ
                        </label>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={stockFilter.includes('ok')} onChange={() => toggleStockFilter('ok')} className="rounded" />
                          ພຽງພໍ
                        </label>
                      </div>
                      <div className="border-l border-gray-100 pl-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ໝວດໝູ່</p>
                        <div className="max-h-40 overflow-y-auto">
                          {knownCategories.map(cat => (
                            <label key={cat} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                              <input type="checkbox" checked={categoryFilter.includes(cat)} onChange={() => toggleCategoryFilter(cat)} className="rounded" />
                              {cat}
                            </label>
                          ))}
                          {knownCategories.length === 0 && <span className="px-2 text-sm text-gray-400">ຍັງບໍ່ມີໝວດໝູ່</span>}
                        </div>
                      </div>
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setStatusFilter([]); setStockFilter([]); setCategoryFilter([]); }}
                        className="w-full text-center text-xs text-amber-600 hover:text-amber-700 mt-3 pt-2 border-t border-gray-100"
                      >
                        ລ້າງການກອງ
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ (_id)</th>
                <th className="p-4 font-medium">ຊື່ລາຍການ</th>
                <th className="p-4 font-medium">ໝວດໝູ່</th>
                <th className="p-4 font-medium">ປະເພດ</th>
                <th className="p-4 font-medium">ຫົວໜ່ວຍ</th>
                <th className="p-4 font-medium">ຈຳນວນຄົງເຫຼືອ (Stock)</th>
                <th className="p-4 font-medium">ຈຳນວນຂັ້ນຕ່ຳ</th>
                <th className="p-4 font-medium">ຮັບເຂົ້າຄັ້ງຫຼ້າສຸດ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
                {(canUpdateCatalog || canDeleteCatalog || canCreateCatalog) && <th className="p-4 font-medium text-center">ຈັດການ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-sm text-gray-400">
                    ກຳລັງໂຫຼດຂໍ້ມູນ...
                  </td>
                </tr>
) : filteredAssets.length > 0 ? (
                filteredAssets.map((item) => {
const isLowStock = item.stockQty <= item.lowStockThreshold;
                  const sm = subMatchOf(item, mainQuery);
                  const subTotal = sm.receipts + sm.assets;

  return (
                    <tr key={item._id} onClick={() => openHistory(item, subTotal > 0 ? { search: searchQuery.trim(), tab: sm.assets > 0 && sm.receipts === 0 ? 'assets' : 'receipts' } : undefined)} title="ກົດເພື່ອເບິ່ງການຮັບເຂົ້າ ແລະ ທະບຽນຊັບສິນ" className="hover:bg-gray-50 cursor-pointer">
                      <td className="p-4 font-semibold text-gray-900">{item._id}</td>
                      <td className="p-4 font-medium text-gray-800">
                        <div className="flex items-start gap-3">
                          <CatalogThumb url={item.imageUrl} name={item.name} size={40} />
                          <div className="min-w-0">
                        {item.name}
                        {subTotal > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {sm.receipts > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">ພົບໃນໃບຮັບ {sm.receipts}</span>}
                            {sm.assets > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">ພົບໃນຊັບສິນ {sm.assets}</span>}
                          </div>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{item.category}</td>
                      <td className="p-4 text-xs">
                        {trackModeOf(item) ? TRACK_LABEL[trackModeOf(item)] : <span className="text-amber-600 font-medium">ຍັງບໍ່ກຳນົດ</span>}
                      </td>
                      <td className="p-4">{item.unit}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {item.stockQty}
                        </span>
                      </td>
                      <td className="p-4">{item.lowStockThreshold}</td>
                      <td className="p-4 text-xs">
                        {receiptSummary[item._id] ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${(MODE_BADGE[receiptSummary[item._id].mode] || MODE_BADGE.RESTOCK).cls}`}>
                              {(MODE_BADGE[receiptSummary[item._id].mode] || MODE_BADGE.RESTOCK).text}
                            </span>
                            <span className="text-gray-500">
                              {receiptSummary[item._id].receivedDate ? new Date(receiptSummary[item._id].receivedDate).toLocaleDateString() : ''}
                              {' '}+{receiptSummary[item._id].quantity}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.isActive !== false ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.isActive !== false ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}
                        </span>
                      </td>
                      {(canUpdateCatalog || canDeleteCatalog || canCreateCatalog) && (
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {canCreateCatalog && item.isActive !== false && (
                              <button onClick={() => openCreateModal('RESTOCK', item._id)} title="ຮັບເຂົ້າ" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                                <PackagePlus size={15} />
                              </button>
                            )}
                            {canUpdateCatalog && (
                              <button onClick={() => openEdit(item)} title="ແກ້ໄຂ" className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50">
                                <Pencil size={15} />
                              </button>
                            )}
                            {canUpdateCatalog && item.itemType !== 'ASSET' && (
                              <button onClick={() => openAdjust(item)} title="ປັບສະຕ໊ອກ" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                                <ArrowUpDown size={15} />
                              </button>
                            )}
                            {canDeleteCatalog && item.isActive !== false && (
                              <button onClick={() => handleDisable(item)} title="ປິດໃຊ້ງານ" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                                <Ban size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-sm text-gray-400">
                    {assets.length === 0 ? 'ບໍ່ມີຂໍ້ມູນລາຍການອຸປະກອນ' : 'ບໍ່ພົບລາຍການທີ່ກົງກັບການຄົ້ນຫາ'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        </div>
        )}

      </div>

      {historyItem && renderDetailModal()}

      {renderPendingModals()}

      {isModalOpen && editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">ແກ້ໄຂລາຍການ {editingId}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ລາຍການ (Name)</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ບີກສີຟ້າ (ສີຟ້າ)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ໝວດໝູ່ (Category)</label>
                <input
                  type="text"
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ເຄື່ອງຂຽນ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວໜ່ວຍ (Unit)</label>
                <input
                  type="text"
                  name="unit"
                  required
                  value={formData.unit}
                  onChange={handleInputChange}
                  placeholder="ເຊັ່ນ: ດ້າມ, ກອ່ງ, ເເພັກ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <CatalogImageUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
              />

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ວິທີຕິດຕາມ</label>
                <select
                  name="trackMode"
                  value={formData.trackMode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white"
                >
                  {!formData.trackMode && <option value="">— ຍັງບໍ່ກຳນົດ —</option>}
                  <option value="SERIAL">{TRACK_LABEL.SERIAL}</option>
                  <option value="TAG">{TRACK_LABEL.TAG}</option>
                  <option value="COUNT">{TRACK_LABEL.COUNT}</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">ປ່ຽນໄດ້ສະເພາະລາຍການທີ່ຍັງບໍ່ມີສະຕັອກ ແລະ ຊັບສິນ</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຈຳນວນເຕືອນຂັ້ນຕຳ່ (Threshold)</label>
                  <input
                    type="number"
                    name="lowStockThreshold"
                    min="0"
                    required
                    value={formData.lowStockThreshold}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຂໍ້ມູນ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createModal && createModal.type !== 'ASSET' && (
        <ReceiveModal
          mode={createModal.type}
          catalog={modalCatalog}
          rooms={[]}
          initialCatalogItemId={createModal.itemId}
          onClose={() => setCreateModal(null)}
          onSaved={() => fetchCatalog()}
        />
      )}
      {createModal && createModal.type === 'ASSET' && (
        <AddAssetModal onClose={() => setCreateModal(null)} onDone={() => fetchCatalog()} />
      )}


      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">ປັບສະຕ໊ອກ — {adjustItem.name}</h3>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{adjustError}</div>
              )}
              <p className="text-xs text-gray-500">ສະຕ໊ອກປັດຈຸບັນ: <b>{adjustItem.stockQty}</b> {adjustItem.unit}</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຈຳນວນທີ່ປັບ (ບວກ = ເພີ່ມ, ລົບ = ຫຼຸດ)</label>
                <input
                  type="number"
                  value={adjustForm.delta}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, delta: e.target.value }))}
                  placeholder="ເຊັ່ນ -5 ຫຼື 20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ເຫດຜົນ <span className="text-red-500">*</span></label>
                <textarea
                  rows={2}
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="ເຊັ່ນ ນັບສະຕ໊ອກຈິງຕ່ຳກວ່າລະບົບ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setAdjustItem(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">ຍົກເລີກ</button>
                <button type="submit" disabled={adjusting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {adjusting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
