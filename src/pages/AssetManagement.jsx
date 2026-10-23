import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Clock, CheckCircle, XCircle, Search, Filter, Pencil, ArrowUpDown, Ban, ShoppingCart, History, PackagePlus } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';

export default function AssetManagement() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreateCatalog = hasPermission('supplies', 'manage');
  const canImportCatalog = hasPermission('supplies', 'import');
  const canUpdateCatalog = hasPermission('supplies', 'update');
  const canDeleteCatalog = hasPermission('supplies', 'delete');
  const canApproveRequests = hasPermission('supplies', 'approve');

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'pending'
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Search & Filter (ຄືກັບໜ້າ Users / Tickets)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]); // ['active' | 'inactive']
  const [stockFilter, setStockFilter] = useState([]); // ['low' | 'ok']
  const [categoryFilter, setCategoryFilter] = useState([]); // ໝວດໝູ່
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    trackMode: '',
    lowStockThreshold: 5,
  });
  const [editingId, setEditingId] = useState(null); // ແກ້ໄຂລາຍການ (ການສ້າງລາຍການໃໝ່ເຮັດຜ່ານໜ້າ "ຮັບເຄື່ອງເຂົ້າຄັງ")

  // ຮັບເຂົ້າຄັ້ງຫຼ້າສຸດຕໍ່ລາຍການ + ປະຫວັດການຮັບເຂົ້າ (drawer)
  const [receiptSummary, setReceiptSummary] = useState({});
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Modal ປັບສະຕ໊ອກ (ບັງຄັບໃສ່ເຫດຜົນ → ບັນທຶກໃນ audit log)
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // ວິທີຕິດຕາມ (tracking) ຄຳນວນຈາກ itemType + trackSerial
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
    });
    setIsModalOpen(true);
  };

  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustForm({ delta: '', reason: '' });
    setAdjustError('');
  };

  const openHistory = async (item) => {
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await api.get('/goods-receipt', { params: { catalogItemId: item._id } });
      const body = res.data?.data ?? res.data;
      setHistoryRows(Array.isArray(body) ? body : []);
    } catch (error) {
      setHistoryError(apiMsg(error, 'ບໍ່ສາມາດໂຫຼດປະຫວັດການຮັບເຂົ້າໄດ້'));
    } finally {
      setHistoryLoading(false);
    }
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

  // States ສຳລັບ Pending Supply Requests (ຄຳຂໍລໍຖ້າອະນຸມັດ)
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const url = lowStockOnly ? '/supply-catalog?lowStockOnly=true' : '/supply-catalog';
      const response = await api.get(url);
      
      // ຈັດການແຍກໂຄງສ້າງ Response ທີ່ຖືກຫໍ່ດ້ວຍ Interceptor (ຮອງຮັບທັງ Array ໂດຍກົງ ແລະ nested data)
      const responseData = response.data;
      let items = [];
      if (Array.isArray(responseData)) {
        items = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        items = responseData.data;
      } else if (responseData && typeof responseData === 'object') {
        // ຖ້າມີ property ອື່ນທີ່ເກັບ Array ໄວ້
        const foundArrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
        if (foundArrayKey) {
          items = responseData[foundArrayKey];
        }
      }

      setAssets(items);
      fetchReceiptSummary();
    } catch (error) {
      console.error('Failed to fetch supply catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  // ຄຳຂໍເບີກອຸປະກອນທັງໝົດທີ່ຍັງ "REQUESTED" (ລໍຖ້າອະນຸມັດ) — ໃຫ້ຄົນຮັບຜິດຊອບອະນຸມັດ/ປະຕິເສດ
  const fetchPendingRequests = async () => {
    try {
      setLoadingPending(true);
      setPendingError('');
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
    } catch (error) {
      console.error('Failed to fetch supply requests:', error);
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
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStockOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      setReviewingId(id);
      await api.patch(`/supply-requests/${id}/approve`);
      await fetchPendingRequests();
      // ຖ້າ workflow ຂອງອ້າຍຫັກສະຕັອກທັນທີຕອນອະນຸມັດ, refresh catalog ນຳ
      fetchCatalog();
    } catch (error) {
      alert(error.response?.data?.msg || error.response?.data?.message || 'ອະນຸມັດບໍ່ສຳເລັດ');
    } finally {
      setReviewingId(null);
    }
  };

  // Backend ບັງຄັບໃຫ້ມີ "reason" ຕອນປະຕິເສດ (RejectSupplyRequestDto.reason ເປັນ required)
  // ຈຶ່ງຕ້ອງຖາມເຫດຜົນກ່ອນສົ່ງ request, ບໍ່ດັ່ງນັ້ນຈະໄດ້ 400 Bad Request ທຸກຄັ້ງ
  const handleReject = async (id) => {
    const reason = window.prompt('ກະລຸນາລະບຸເຫດຜົນທີ່ປະຕິເສດຄຳຂໍນີ້:');
    if (reason === null) return; // ຜູ້ໃຊ້ກົດ Cancel
    if (!reason.trim()) {
      alert('ຕ້ອງລະບຸເຫດຜົນຈຶ່ງຈະປະຕິເສດໄດ້');
      return;
    }
    try {
      setReviewingId(id);
      await api.patch(`/supply-requests/${id}/reject`, { reason: reason.trim() });
      await fetchPendingRequests();
    } catch (error) {
      alert(error.response?.data?.msg || error.response?.data?.message || 'ປະຕິເສດບໍ່ສຳເລັດ');
    } finally {
      setReviewingId(null);
    }
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
      // ສະຕ໊ອກບໍ່ແກ້ຜ່ານນີ້ — ໃຊ້ "ປັບສະຕ໊ອກ" (ມີ audit + ເຫດຜົນ)
      await api.patch(`/supply-catalog/${editingId}`, body);
      setIsModalOpen(false);
      setEditingId(null);
      fetchCatalog(); // Refresh list
    } catch (error) {
      setErrorMsg(apiMsg(error, 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssets = assets.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || [item.name, item._id, item.category, item.unit]
      .filter(Boolean).some(f => f.toLowerCase().includes(q));
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

  // ລິ້ງເກົ່າ /assets?create=1 → ໄປໜ້າ "ຮັບເຄື່ອງເຂົ້າຄັງ" (ຊື້ເຄື່ອງໃໝ່)
  useEffect(() => {
    if (searchParams.get('create') === '1') navigate('/goods-receipt?new=1', { replace: true });
  }, [searchParams, navigate]);

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
              {canCreateCatalog && (
                <button
                  onClick={() => navigate('/goods-receipt?new=1')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingCart size={18} />
                  <span>ຊື້ເຄື່ອງເຂົ້າສະຕັອກ</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB BAR */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'catalog' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍການອຸປະກອນ (Catalog)
          </button>
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

        {/* TAB: PENDING SUPPLY REQUESTS — ຄຳຂໍທີ່ລໍຖ້າອະນຸມັດ */}
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
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((req) => {
                const requesterName =
                  [req.requestedBy?.firstName, req.requestedBy?.lastName].filter(Boolean).join(' ') ||
                  req.requestedBy?.name || req.requestedBy?.email ||
                  req.userId?.name || req.userId?.email ||
                  req.createdBy?.name || 'ບໍ່ລະບຸຜູ້ຂໍ';
                const totalQty = Array.isArray(req.items) ? req.items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0;

                return (
                  <div key={req._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{req._id}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{totalQty} ຊິ້ນ</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {Array.isArray(req.items) && req.items.map((i, idx) => (
                          <div key={idx}>• {i.name} (x{i.quantity}){i.reason ? ` — ${i.reason}` : ''}</div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        ຜູ້ຂໍ: {requesterName} · ວັນທີຍື່ນ: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canApproveRequests ? (
                        <>
                          <button
                            onClick={() => handleApprove(req._id)}
                            disabled={reviewingId === req._id}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle size={14} />
                            <span>{reviewingId === req._id ? 'ກຳລັງດຳເນີນການ...' : 'ອະນຸມັດ'}</span>
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={reviewingId === req._id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle size={14} />
                            <span>ປະຕິເສດ</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">ບໍ່ມີສິດອະນຸມັດ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">ບໍ່ມີຄຳຂໍລໍຖ້າອະນຸມັດ</div>
          )}
        </div>
        )}

        {/* TAB: CATALOG */}
        {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ຄົ້ນຫາຊື່, ລະຫັດ, ໝວດໝູ່, ຫົວໜ່ວຍ..."
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

  return (
                    <tr key={item._id} onClick={() => openHistory(item)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="p-4 font-semibold text-gray-900">{item._id}</td>
                      <td className="p-4 font-medium text-gray-800">{item.name}</td>
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
                              <button onClick={() => navigate(`/goods-receipt?restock=${encodeURIComponent(item._id)}`)} title="ຮັບເຂົ້າ" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
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

      {/* Edit Item Modal */}
      {isModalOpen && editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in duration-200">
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

      {/* Receipt History Drawer */}
      {historyItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setHistoryItem(null)}>
          <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><History size={18} /> ປະຫວັດການຮັບເຂົ້າ</h3>
                <p className="text-xs text-gray-500">{historyItem._id} — {historyItem.name} (ສະຕັອກ {historyItem.stockQty})</p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyLoading ? (
                <p className="text-center text-sm text-gray-400 py-10">ກຳລັງໂຫຼດ...</p>
              ) : historyError ? (
                <p className="text-center text-sm text-red-500 py-10">⚠️ {historyError}</p>
              ) : historyRows.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">ຍັງບໍ່ເຄີຍຮັບເຂົ້າ</p>
              ) : (
                historyRows.map((r) => {
                  const m = MODE_BADGE[r.mode] || MODE_BADGE.RESTOCK;
                  const by = r.createdBy && typeof r.createdBy === 'object'
                    ? [r.createdBy.firstName, r.createdBy.lastName].filter(Boolean).join(' ') || r.createdBy.employeeCode
                    : '—';
                  return (
                    <div key={r._id} className="border border-gray-100 rounded-xl p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.text}</span>
                        <span className="text-xs text-gray-500">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="font-semibold text-gray-800">+{r.quantity} {r.unit || ''}
                        <span className="ml-2 text-xs font-normal text-gray-500">ສະຕັອກ {r.stockBefore ?? '—'} → {r.stockAfter ?? '—'}</span>
                      </div>
                      {r.vendor && <div className="text-xs text-gray-600">ຜູ້ຂາຍ: {r.vendor}</div>}
                      {r.note && <div className="text-xs text-gray-600">ໝາຍເຫດ: {r.note}</div>}
                      {r.assetTags?.length > 0 && (
                        <div className="text-xs text-gray-600">Asset Tag: {r.assetTags.slice(0, 6).join(', ')}{r.assetTags.length > 6 ? ` … (+${r.assetTags.length - 6})` : ''}</div>
                      )}
                      <div className="text-xs text-gray-400">ບັນທຶກໂດຍ {by}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
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