import { Fragment, useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, Plus, CheckCircle, Clock, XCircle, PackageCheck, ScanLine, Camera, QrCode, Search, X, UserCheck } from 'lucide-react';
import { hasPermission, getCurrentUser } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import RequestProgress, { shouldHideProgress } from '../components/RequestProgress';
import PurchaseRequestModal from '../components/PurchaseRequestModal';
import axios from '../services/api';
import { CatalogThumb, imageSrc } from '../components/CatalogImage';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';

const refId = (value) => (value && typeof value === 'object' ? value._id : value);
const refName = (value) => {
  if (!value) return '';
  if (typeof value !== 'object') return value;
  return `${value.firstName || ''} ${value.lastName || ''}`.trim() || value.name || value.email || value._id || '';
};
const isDeptRequest = (req) => !!(req && refId(req.departmentId));
const OPEN_STATUSES = ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'];
const STATUS_FILTERS = [
  { value: 'ALL', label: 'ທຸກສະຖານະ' },
  { value: 'OPEN', label: 'ລໍຖ້າຮັບເຄື່ອງ' },
  { value: 'PENDING_MANAGER', label: 'ລໍຖ້າຫົວໜ້າພະແນກ' },
  { value: 'REQUESTED', label: 'ລໍຖ້າອະນຸມັດ (ຝ່າຍສາງ)' },
  { value: 'CLOSED', label: 'ຮັບເຄື່ອງແລ້ວ' },
  { value: 'REJECTED', label: 'ຖືກປະຕິເສດ' },
];
const matchesStatusFilter = (status, filter) => {
  if (filter === 'ALL') return true;
  if (filter === 'OPEN') return OPEN_STATUSES.includes(status);
  if (filter === 'CLOSED') return status === 'CLOSED' || status === 'FULFILLED';
  return status === filter;
};
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');

function QtyStepper({ value, onMinus, onPlus, onType }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button type="button" onClick={onMinus} className="w-8 h-8 text-gray-600 hover:bg-gray-100 text-base leading-none" aria-label="ຫຼຸດ">−</button>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onType(parseInt(e.target.value, 10) || 1)}
        className="w-12 h-8 text-center text-sm border-x border-gray-200 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={onPlus} className="w-8 h-8 text-gray-600 hover:bg-gray-100 text-base leading-none" aria-label="ເພີ່ມ">+</button>
    </div>
  );
}

export default function InventorySupplies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canRequest = hasPermission('supplies', 'create');

  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [restockPrefill, setRestockPrefill] = useState(null);
  const [restockNotice, setRestockNotice] = useState('');
  
  const [items, setItems] = useState([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
  const [submitError, setSubmitError] = useState('');
  const [requestFor, setRequestFor] = useState('PERSON');
  const [custodian, setCustodian] = useState(null);
  const custodianCode = custodian?.employeeCode || '';
  const [custPickerOpen, setCustPickerOpen] = useState(false);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custLoading, setCustLoading] = useState(false);
  const [custError, setCustError] = useState('');
  const [requestableDepartments, setRequestableDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  const selectedDepartment = requestableDepartments.find(
    (department) => department._id === selectedDepartmentId,
  );
  const myDepartmentId = selectedDepartmentId;
  const myDepartmentName = selectedDepartment?.name || myDepartmentId;

  const [reqStep, setReqStep] = useState(1);
  const [shopSearch, setShopSearch] = useState('');
  const [shopCategory, setShopCategory] = useState('');
  const [customName, setCustomName] = useState('');

  const [receiveRequest, setReceiveRequest] = useState(null);
  const [scanTags, setScanTags] = useState('');
  const [receiveStage, setReceiveStage] = useState(1);
  const [allAssets, setAllAssets] = useState(null);
  const [assigneeCode, setAssigneeCode] = useState('');
  const [defaultAssigneeCode, setDefaultAssigneeCode] = useState('');
  const [changeReceiver, setChangeReceiver] = useState(false);
  const [confirmedItems, setConfirmedItems] = useState({});
  const [receiving, setReceiving] = useState(false);
  const [assigneeInfo, setAssigneeInfo] = useState({ state: 'idle', user: null });
  const [receiveError, setReceiveError] = useState('');
  const [receiveResult, setReceiveResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [listTab, setListTab] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailId, setDetailId] = useState(null);
  const detailRequest = detailId ? requests.find((r) => r._id === detailId) || null : null;

  // ເປີດລາຍລະອຽດຄຳຂໍໂດຍກົງຈາກລິ້ງ (?open=SR059)
  const openParam = searchParams.get('open');
  useEffect(() => {
    if (!openParam || requests.length === 0) return;
    if (requests.some((r) => r._id === openParam)) setDetailId(openParam);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, requests]);

  const [delegatePickerOpen, setDelegatePickerOpen] = useState(false);
  const [candQuery, setCandQuery] = useState('');
  const [candDept, setCandDept] = useState('');
  const [candidates, setCandidates] = useState({ users: [], departments: [] });
  const [candLoading, setCandLoading] = useState(false);
  const [candError, setCandError] = useState('');
  const [delegateSaving, setDelegateSaving] = useState(false);

  const isMe = (ref) => {
    if (!ref || !me) return false;
    const id = refId(ref);
    if (id && (id === me._id || id === me.id || id === me.userId)) return true;
    return typeof ref === 'object' && !!ref.employeeCode && ref.employeeCode === me.employeeCode;
  };
  const isPickupForOther = (req) => isMe(req.delegateId) && !isMe(req.requestedBy);

  const fetchData = async (opts) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      const [reqRes, catRes, meRes, departmentsRes] = await Promise.all([
        axios.get('/supply-requests/my'),
        axios.get('/supply-catalog'),
        axios.get('/auth/me'),
        canRequest
          ? axios.get('/supply-requests/requestable-departments').catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);
      const profile = meRes.data?.data !== undefined ? meRes.data.data : meRes.data;
      setMe(profile);

      const reqData = reqRes.data;
      setRequests(Array.isArray(reqData) ? reqData : (reqData.data || reqData.requests || reqData.items || []));

      const catData = catRes.data;
      setCatalog(Array.isArray(catData) ? catData : (catData.data || catData.items || []));

      const departmentBody = departmentsRes.data;
      const departmentListValue = Array.isArray(departmentBody)
        ? departmentBody
        : (departmentBody?.data || departmentBody?.departments || departmentBody?.items || []);
      const departmentList = Array.isArray(departmentListValue) ? departmentListValue : [];
      setRequestableDepartments(departmentList);
      if (departmentList.length === 0) {
        setRequestFor('PERSON');
        setCustodian(null);
        setCustPickerOpen(false);
      }
      const profileDepartmentId = refId(profile?.departmentId);
      setSelectedDepartmentId((current) => {
        if (current && departmentList.some((department) => department._id === current)) return current;
        if (departmentList.some((department) => department._id === profileDepartmentId)) return profileDepartmentId;
        return departmentList.length === 1 ? departmentList[0]._id : '';
      });
    } catch (err) {
      console.error('Failed to fetch supply data', err);
      if (!silent) {
        setRequests([]);
        setCatalog([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useRealtimeRefresh(() => fetchData({ silent: true }));

useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsModalOpen(true);
    }
  }, [searchParams.get('create')]);

  const clearPurchaseLink = (row) => {
    delete row.purchaseRequestId;
    delete row.purchaseRequestNo;
    delete row.purchaseQty;
  };

  const purchaseLinkIssue = (row) => {
    if (!row.purchaseRequestId) return '';
    const qty = parseInt(row.quantity, 10) || 0;
    const stock = catalogById(row.catalogItemId)?.stockQty ?? 0;
    if (row.purchaseQty > qty) return `ໃບສະເໜີ ${row.purchaseRequestNo} ຊື້ ${row.purchaseQty} ເກີນຈຳນວນທີ່ຂໍເບີກ`;
    if (row.purchaseQty < qty - stock) return `ໃບສະເໜີ ${row.purchaseRequestNo} ຊື້ ${row.purchaseQty} ບໍ່ພໍກັບສ່ວນທີ່ສະຕັອກບໍ່ພໍ (ຂາດ ${qty - stock})`;
    return '';
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'catalogItemId' && newItems[index].purchaseRequestId) clearPurchaseLink(newItems[index]);
    
    if (field === 'catalogItemId' && value) {
      const selectedCat = catalog.find(c => c._id === value);
      if (selectedCat) {
        newItems[index].name = selectedCat.name;
      }
    }
    
    setItems(newItems);
  };

  const catalogById = (id) => (Array.isArray(catalog) ? catalog.find((c) => c._id === id) : undefined);

  const isBlankRow = (it) => !it.catalogItemId && !String(it.name || '').trim() && !String(it.reason || '').trim();

  const resetRequestForm = () => {
    setItems([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
    setSubmitError('');
    setReqStep(1);
    setShopSearch('');
    setShopCategory('');
    setCustomName('');
    setRequestFor('PERSON');
    setCustodian(null);
    setCustPickerOpen(false);
    setCustQuery('');
    setCustResults([]);
    setCustError('');
  };

  const meAsCustodian = () =>
    me?.employeeCode ? { employeeCode: me.employeeCode, name: refName(me) } : null;

  const chooseDepartmentRequest = () => {
    setRequestFor('DEPARTMENT');
    if (!custodian) setCustodian(meAsCustodian());
  };

  const changeRequestDepartment = (departmentId) => {
    setSelectedDepartmentId(departmentId);
    setCustodian(meAsCustodian());
    setCustPickerOpen(false);
    setCustQuery('');
    setCustResults([]);
  };

  const pickCustodian = (u) => {
    setCustodian({ employeeCode: u.employeeCode, name: refName(u) });
    setCustPickerOpen(false);
    setCustQuery('');
  };

  useEffect(() => {
    if (!isModalOpen || requestFor !== 'DEPARTMENT' || !custPickerOpen || !selectedDepartmentId) {
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setCustLoading(true);
        setCustError('');
        const res = await axios.get('/supply-requests/custodian-candidates', {
          params: { departmentId: selectedDepartmentId, q: custQuery.trim() || undefined },
        });
        if (cancelled) return;
        const body = res.data?.data !== undefined ? res.data.data : res.data;
        setCustResults(body?.users || []);
      } catch (err) {
        if (!cancelled) {
          setCustResults([]);
          setCustError(err.response?.data?.msg || err.response?.data?.message || 'ໂຫຼດລາຍຊື່ບໍ່ສຳເລັດ');
        }
      } finally {
        if (!cancelled) setCustLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isModalOpen, requestFor, custPickerOpen, selectedDepartmentId, custQuery]);

  const shopAdd = (c) =>
    setItems((prev) => {
      const base = prev.filter((it) => !isBlankRow(it));
      const i = base.findIndex((it) => it.catalogItemId === c._id);
      if (i >= 0) {
        base[i] = { ...base[i], quantity: (parseInt(base[i].quantity, 10) || 0) + 1 };
        return base;
      }
      return [...base, { catalogItemId: c._id, catalogSearch: c.name, name: c.name, quantity: 1, reason: '' }];
    });

  const shopSetQty = (catalogItemId, qty) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((it) => it.catalogItemId !== catalogItemId)
        : prev.map((it) => (it.catalogItemId === catalogItemId ? { ...it, quantity: qty } : it)),
    );

  const addCustomItem = () => {
    const name = customName.trim();
    if (!name) return;
    setItems((prev) => [
      ...prev.filter((it) => !isBlankRow(it)),
      { catalogItemId: '', catalogSearch: '', name, quantity: 1, reason: '' },
    ]);
    setCustomName('');
  };

  const removeRow = (index) => setItems((prev) => prev.filter((_, i) => i !== index));
  const setRowQty = (index, qty) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, qty) } : row)));

  const overStockCount = items.filter((it) => {
    const cat = it.catalogItemId ? catalogById(it.catalogItemId) : null;
    return cat && !it.purchaseRequestId && (parseInt(it.quantity, 10) || 0) > (cat.stockQty ?? 0);
  }).length;
  const linkedCount = items.filter((it) => it.purchaseRequestId).length;

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      const merged = [];
      for (const it of items.filter((x) => !isBlankRow(x))) {
        const issue = purchaseLinkIssue(it);
        if (issue) {
          setSubmitError(`${issue} — ປັບຈຳນວນ ຫຼືກົດ \"ຍົກເລີກການຜູກ\"`);
          return;
        }
        const qty = parseInt(it.quantity, 10) || 1;
        const name = String(it.name || '').trim();
        const prev =
          it.catalogItemId && !it.purchaseRequestId
            ? merged.find((m) => m.catalogItemId === it.catalogItemId && !m.purchaseRequestId)
            : null;
        if (prev) {
          prev.quantity += qty;
          if (it.reason && !String(prev.reason || '').includes(it.reason)) {
            prev.reason = prev.reason ? `${prev.reason}; ${it.reason}` : it.reason;
          }
        } else {
          merged.push({
            catalogItemId: it.catalogItemId || '',
            name,
            quantity: qty,
            reason: it.reason || '',
            purchaseRequestId: it.purchaseRequestId || '',
          });
        }
      }
      if (merged.length === 0 || merged.some((m) => !m.name)) {
        setSubmitError('ກະລຸນາໃສ່ຊື່ອຸປະກອນຢ່າງໜ້ອຍ 1 ລາຍການ');
        return;
      }
      const payloadItems = merged.map(({ catalogItemId, name, quantity, reason, purchaseRequestId }) => ({
        ...(catalogItemId ? { catalogItemId } : {}),
        name,
        quantity,
        ...(reason ? { reason } : {}),
        ...(purchaseRequestId ? { purchaseRequestId } : {}),
      }));
      if (requestFor === 'DEPARTMENT') {
        if (!myDepartmentId || !requestableDepartments.some((department) => department._id === myDepartmentId)) {
          setSubmitError('ກະລຸນາເລືອກພະແນກທີ່ທ່ານມີສິດຂໍເຄື່ອງ');
          return;
        }
        if (!custodianCode.trim()) {
          setSubmitError('ກະລຸນາເລືອກຜູ້ຮັບຜິດຊອບຂອງແຜນກ');
          return;
        }
      }
      await axios.post('/supply-requests', {
        items: payloadItems,
        ...(requestFor === 'DEPARTMENT'
          ? { departmentId: myDepartmentId, custodianCode: custodianCode.trim() }
          : {}),
      });
      setIsModalOpen(false);
      resetRequestForm();
      fetchData();
    } catch (err) {
      setSubmitError(err.response?.data?.msg || err.response?.data?.message || 'ສົ່ງຄຳຂໍບໍ່ສຳເລັດ');
    }
  };

  const openReceive = async (req) => {
    let detail;
    try {
      const response = await axios.get(`/supply-requests/${req._id}/receipt`);
      const body = response.data;
      detail = body?.data !== undefined ? body.data : body;
      if (!detail || !Array.isArray(detail.items)) {
        throw new Error('ຂໍ້ມູນໃບຮັບເຄື່ອງບໍ່ຄົບ');
      }
    } catch (error) {
      window.alert(
        error.response?.data?.msg || error.response?.data?.message ||
        error.message || 'ບໍ່ສາມາດໂຫຼດປະເພດລາຍການຈາກ Backend ໄດ້',
      );
      return;
    }

    setReceiveRequest(detail);
    setScanTags('');
    setReceiveStage(1);
    setAllAssets(null);
    const initialAssignee = (isDeptRequest(detail) ? detail.custodianId?.employeeCode : detail.requestedBy?.employeeCode)
      || detail.userId?.employeeCode
      || detail.createdBy?.employeeCode
      || getCurrentUser()?.employeeCode
      || '';
    setAssigneeCode(initialAssignee);
    setDefaultAssigneeCode(initialAssignee);
    setChangeReceiver(false);
    setReceiveError('');
    setReceiveResult(null);
    setScannerOpen(false);
    setConfirmedItems({});
    await loadAssets();
  };

  const loadAssets = async () => {
    if (!hasPermission('assets', 'read')) { setAllAssets(null); return; }
    try {
      const res = await axios.get('/assets');
      const data = res.data;
      setAllAssets(Array.isArray(data) ? data : (data.data || data.items || []));
    } catch {
      setAllAssets(null);
    }
  };

  useEffect(() => {
    const code = assigneeCode.trim();
    if (!receiveRequest || receiveStage !== 2 || !code || !hasPermission('assets', 'assign')) {
      setAssigneeInfo({ state: 'idle', user: null });
      return undefined;
    }
    setAssigneeInfo({ state: 'loading', user: null });
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`/users/lookup/${encodeURIComponent(code)}`);
        const body = res.data;
        setAssigneeInfo({ state: 'found', user: body?.data !== undefined ? body.data : body });
      } catch (err) {
        setAssigneeInfo({ state: err.response?.status === 404 ? 'notfound' : 'error', user: null });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [assigneeCode, receiveStage, receiveRequest]);

  const closeReceive = () => {
    setReceiveRequest(null);
    setReceiveResult(null);
    setReceiveError('');
    setReceiveStage(1);
    setScannerOpen(false);
    fetchData();
  };

  const resolveScannedTag = (text) => {
    let value = String(text || '').trim();
    const m = value.match(/\/assets\/([A-Za-z0-9_-]+)/);
    if (m) value = m[1];
    if (Array.isArray(allAssets)) {
      const key = value.toLowerCase();
      const hit = allAssets.find((a) => String(a._id).toLowerCase() === key || (a.assetTag || '').toLowerCase() === key);
      if (hit?.assetTag) return hit.assetTag;
    }
    return value;
  };

  const scannedTags = () => {
    const seen = new Set();
    return scanTags
      .split(/\r?\n/)
      .map((s) => resolveScannedTag(s))
      .filter((t) => {
        const k = t.toLowerCase();
        if (!t || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  };

  const appendScannedTag = (text) => {
    const tag = resolveScannedTag(text);
    if (!tag) return;
    setScanTags((prev) => {
      const existing = prev.split(/\r?\n/).map((s) => resolveScannedTag(s)).filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      const trimmed = prev.replace(/\s+$/, '');
      return trimmed ? `${trimmed}\n${tag}` : tag;
    });
    setReceiveError('');
  };

  const receiveIsDept = isDeptRequest(receiveRequest);
  const reqItems = receiveRequest && Array.isArray(receiveRequest.items) ? receiveRequest.items : [];
  const hasCanonicalTracking = reqItems.some((item) => typeof item.requiresAssetTag === 'boolean');
  const isAssetTrackedItem = (item) => !hasCanonicalTracking || item.requiresAssetTag === true;
  const assetRequestItems = reqItems.filter(isAssetTrackedItem);
  const isLinkedToConsumableCatalog = (asset) => {
    const id = refId(asset?.catalogItemId);
    if (!id) return false;
    const linkedItem = catalog.find((item) => String(item._id) === String(id));
    return linkedItem?.itemType === 'CONSUMABLE';
  };

  const scanResults = receiveRequest
    ? scannedTags().map((tag) => {
        if (!Array.isArray(allAssets)) return { tag };
        const a = allAssets.find((x) => (x.assetTag || '').toLowerCase() === tag.toLowerCase());
        if (!a) return { tag, status: 'not-found' };
        const assetCatalogId = refId(a.catalogItemId);
        const matchesRequestedConsumable = !!assetCatalogId && reqItems.some((item) =>
          item.requiresAssetTag === false && refId(item.catalogItemId) === assetCatalogId,
        );
        const matchesAssetCatalog = !!assetCatalogId && assetRequestItems.some((item) =>
          refId(item.catalogItemId) === assetCatalogId,
        );
        const assetType = (a.type || '').toLowerCase();
        const matchesAssetName = assetRequestItems.some((item) => {
          const n = (item.name || '').toLowerCase();
          return !!n && !!assetType && (n.includes(assetType) || assetType.includes(n));
        });
        const typeOk = !isLinkedToConsumableCatalog(a) && !matchesRequestedConsumable && assetRequestItems.length > 0 && (matchesAssetCatalog || matchesAssetName);
        const deptBranchId = receiveIsDept ? refId(receiveRequest?.departmentId?.branchId) : '';
        const assetBranchId = refId(a.branchId);
        const branchOk = !deptBranchId || assetBranchId === deptBranchId;
        const status = a.status !== 'AVAILABLE'
          ? 'not-available'
          : !branchOk
            ? 'branch-mismatch'
            : !typeOk
              ? 'type-mismatch'
              : 'ok';
        return { tag, status, asset: a };
      })
    : [];

  const assetsKnown = Array.isArray(allAssets);
  const nameMatch = (itemName, assetType) => {
    const n = (itemName || '').toLowerCase();
    const t = (assetType || '').toLowerCase();
    return !!n && !!t && (n.includes(t) || t.includes(n));
  };
  const itemPlan = (() => {
    const counts = reqItems.map(() => 0);
    scanResults.forEach((r) => {
      const a = r.asset;
      if (!a || r.status !== 'ok') return;
      const assetCatalogId = refId(a.catalogItemId);
      const same = reqItems.map((_, k) => k).filter((k) =>
        isAssetTrackedItem(reqItems[k]) && assetCatalogId && refId(reqItems[k].catalogItemId) === assetCatalogId,
      );
      let idx;
      if (same.length > 0) idx = same.find((k) => counts[k] < (Number(reqItems[k].quantity) || 0)) ?? same[0];
      else idx = reqItems.findIndex((it) => isAssetTrackedItem(it) && nameMatch(it.name, a.type));
      if (idx >= 0) counts[idx] += 1;
    });
    return reqItems.map((it, k) => {
      const qty = Number(it.quantity) || 0;
      const linked = assetsKnown && it.catalogItemId
        ? allAssets.filter((a) => a.status !== 'RETIRED' && a.catalogItemId === it.catalogItemId)
        : [];
      const kind = typeof it.requiresAssetTag === 'boolean'
        ? (it.requiresAssetTag ? 'asset' : 'consumable')
        : (!assetsKnown ? 'unknown' : (linked.length > 0 ? 'asset' : 'consumable'));
      const scanned = counts[k];
      const requiredBranchId = receiveIsDept
        ? refId(receiveRequest?.departmentId?.branchId)
        : '';
      const availableAll = assetsKnown && kind === 'asset'
        ? allAssets.filter((a) =>
            a.status === 'AVAILABLE' &&
            !isLinkedToConsumableCatalog(a) &&
            (!requiredBranchId || refId(a.branchId) === requiredBranchId) &&
            ((it.catalogItemId && refId(a.catalogItemId) === refId(it.catalogItemId)) || nameMatch(it.name, a.type))
          ).length
        : 0;
      const remainingAvail = Math.max(0, availableAll - scanned);
      const need = Math.max(0, qty - scanned);
      const done = kind === 'asset' ? scanned === qty : kind === 'consumable' ? (scanned > 0 || !!confirmedItems[k]) : false;
      return { it, k, qty, kind, scanned, need, remainingAvail, done, over: scanned > qty, blocked: kind === 'asset' && need > remainingAvail };
    });
  })();
  const blockedPlan = itemPlan.filter((p) => p.blocked);
  const plannedDone = itemPlan.filter((p) => p.done).length;
  const scanAllOk = scanResults.every((r) => !r.status || r.status === 'ok');
  const canProceed = assetsKnown
    ? itemPlan.length > 0 && itemPlan.every((p) => p.done) && !itemPlan.some((p) => p.over) && scanAllOk
    : scannedTags().length > 0 || !!confirmedItems.all;
  const consumablePlan = itemPlan.filter((p) => p.kind === 'consumable' && p.scanned === 0);

  const gotoStage2 = () => {
    const tags = scannedTags();
    if (!canProceed) {
      setReceiveError(
        assetsKnown
          ? 'ຍັງຮັບບໍ່ຄົບທຸກລາຍການ — ເບິ່ງລາຍການທີ່ຂໍດ້ານເທິງ (ສະແກນໃຫ້ຄົບ ຫຼື ຕິກ "ໄດ້ຮັບແລ້ວ" ສຳລັບຂອງສິ້ນເປືອງ)'
          : 'ກະລຸນາສະແກນ Asset Tag ຢ່າງໜ້ອຍ 1 ລາຍການ ຫຼື ຕິກຢືນຢັນຂອງສິ້ນເປືອງ',
      );
      return;
    }
    if (tags.length === 0 && consumablePlan.length === 0 && !confirmedItems.all) {
      setReceiveError('ກະລຸນາສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຢ່າງໜ້ອຍ 1 ລາຍການ');
      return;
    }
    if (Array.isArray(allAssets) && scanResults.some((r) => r.status && r.status !== 'ok')) {
      setReceiveError('ມີລາຍການທີ່ບໍ່ຜ່ານການກວດ (ເບິ່ງສີແດງ) — ໃຫ້ແກ້/ລຶບແຖວນັ້ນກ່ອນ ຈຶ່ງດຳເນີນການຕໍ່ (ເພື່ອບໍ່ມອບເຄື່ອງຜິດ)');
      return;
    }
    setReceiveError('');
    setReceiveStage(2);
  };

  const submitReceive = async (e) => {
    e.preventDefault();
    const assetTags = scannedTags();
    const confirmConsumables = !!confirmedItems.all || consumablePlan.some((p) => confirmedItems[p.k]);
    if (assetTags.length === 0 && !confirmConsumables) {
      setReceiveError('ກະລຸນາສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຢ່າງໜ້ອຍ 1 ລາຍການ');
      return;
    }
    setReceiving(true);
    setReceiveError('');
    try {
      await axios.patch(`/supply-requests/${receiveRequest._id}/receive`, {
        assetTags,
        ...(confirmConsumables ? { confirmConsumables: true } : {}),
        ...(assigneeCode.trim() ? { assigneeCode: assigneeCode.trim() } : {}),
      });
      setReceiveResult({ ok: true, assetTags, assigneeCode, consumables: consumablePlan.filter((p) => confirmedItems[p.k]).length });
      fetchData();
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 405) {
        setReceiveError('Backend ຍັງບໍ່ມີ Endpoint ນີ້: PATCH /supply-requests/:id/receive — ລໍຖ້າຝ່າຍ Backend ເພີ່ມໃຫ້ກ່ອນ');
      } else {
        setReceiveError(err.response?.data?.msg || err.response?.data?.message || 'ການບັນທຶກບໍ່ສຳເລັດ — ກະລຸນາກວດສອບລະຫັດທີ່ສະແກນ ຫຼື ລະຫັດພະນັກງານຜູ້ຮັບ');
      }
    } finally {
      setReceiving(false);
    }
  };

  const renderStatus = (status, req) => {
    switch (status) {
      case 'ORDERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-600 border border-violet-200">
            <Clock size={12} /> ລໍຂອງເຂົ້າຄັງ
          </span>
        );
      case 'PENDING_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Clock size={12} /> ລໍຖ້າຫົວໜ້າພະແນກ
          </span>
        );
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <Clock size={12} /> {req?.managerApprovedBy ? 'ຫົວໜ້າອະນຸມັດແລ້ວ · ລໍຖ້າຝ່າຍສາງ' : 'ລໍຖ້າອະນຸມັດ'}
          </span>
        );
      case 'APPROVED':
        if (req?.readyToCollectAt) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
              <Package size={12} /> ພ້ອມມາຮັບ
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
            <CheckCircle size={12} /> ອະນຸມັດແລ້ວ
          </span>
        );
      case 'FULFILLED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Package size={12} /> ຮັບເຄື່ອງແລ້ວ
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle size={12} /> ຖືກປະຕິເສດ
          </span>
        );
      default:
        return status;
    }
  };

  useEffect(() => {
    setDelegatePickerOpen(false);
    setCandQuery('');
    setCandDept('');
    setCandError('');
  }, [detailId]);

  useEffect(() => {
    if (!detailId || !delegatePickerOpen) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setCandLoading(true);
        setCandError('');
        const res = await axios.get(`/supply-requests/${detailId}/delegate-candidates`, {
          params: { q: candQuery.trim() || undefined, departmentId: candDept || undefined },
        });
        if (cancelled) return;
        const body = res.data?.data !== undefined ? res.data.data : res.data;
        setCandidates({ users: body?.users || [], departments: body?.departments || [] });
      } catch (err) {
        if (!cancelled) setCandError(err.response?.data?.msg || err.response?.data?.message || 'ໂຫຼດລາຍຊື່ບໍ່ສຳເລັດ');
      } finally {
        if (!cancelled) setCandLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [detailId, delegatePickerOpen, candQuery, candDept]);

  const saveDelegate = async (employeeCode) => {
    if (!detailId) return;
    try {
      setDelegateSaving(true);
      setCandError('');
      await axios.patch(`/supply-requests/${detailId}/delegate`, { delegateCode: employeeCode });
      await fetchData();
      setDelegatePickerOpen(false);
      setCandQuery('');
    } catch (err) {
      setCandError(err.response?.data?.msg || err.response?.data?.message || 'ບັນທຶກຜູ້ຮັບແທນບໍ່ສຳເລັດ');
    } finally {
      setDelegateSaving(false);
    }
  };

  const pickupOpenCount = requests.filter((r) => isPickupForOther(r) && OPEN_STATUSES.includes(r.status)).length;

  const visibleRequests = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return requests.filter((req) => {
      if (listTab === 'MINE' && !isMe(req.requestedBy)) return false;
      if (listTab === 'PICKUP' && !isPickupForOther(req)) return false;
      if (!matchesStatusFilter(req.status, statusFilter)) return false;
      if (!q) return true;
      const haystack = [
        req._id,
        ...(Array.isArray(req.items) ? req.items.map((i) => `${i.name} ${i.reason || ''}`) : []),
        refName(req.requestedBy),
        req.requestedBy?.employeeCode,
        refName(req.departmentId),
        refName(req.custodianId),
        req.custodianId?.employeeCode,
        refName(req.delegateId),
        req.delegateId?.employeeCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, listTab, statusFilter, searchText, me]);

  const switchTab = (tab) => {
    setListTab(tab);
    setStatusFilter(tab === 'PICKUP' ? 'OPEN' : 'ALL');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຂໍອຸປະກອນສິ້ນເປືອງ (Supply Requests)</h1>
            <p className="text-sm text-gray-500 mt-1">ຍື່ນຄຳຂໍເບີກວັດສະດຸ ແລະ ຕິດຕາມສະຖານະການອະນຸມັດ</p>
          </div>
          {canRequest && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ສ້າງຄຳຂໍອຸປະກອນ</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'ALL', label: 'ທັງໝົດ' },
              { value: 'MINE', label: 'ຄຳຂໍຂອງຂ້ອຍ' },
              { value: 'PICKUP', label: 'ຮັບແທນຜູ້ອື່ນ', badge: pickupOpenCount },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => switchTab(tab.value)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                  listTab === tab.value
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.value === 'PICKUP' && <UserCheck size={14} />}
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`text-[11px] rounded-full px-1.5 ${listTab === tab.value ? 'bg-white/30' : 'bg-amber-100 text-amber-700'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="ຄົ້ນຫາ: ເລກໃບຂໍ, ລາຍການ, ຜູ້ຂໍ, ແຜນກ, ຜູ້ຮັບແທນ..."
                className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm bg-white"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  aria-label="ລ້າງການຄົ້ນຫາ"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
              aria-label="ກັ່ນຕອງຕາມສະຖານະ"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          {!loading && (
            <div className="text-xs text-gray-400">ສະແດງ {visibleRequests.length} ຈາກ {requests.length} ໃບ — ກົດທີ່ແຖວເພື່ອເບິ່ງລາຍລະອຽດທັງໝົດ</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດຄຳຂໍ (_id)</th>
                <th className="p-4 font-medium">ລາຍການອຸປະກອນ</th>
                <th className="p-4 font-medium">ຈຳນວນລວມ</th>
                <th className="p-4 font-medium">ວັນທີຍື່ນ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                </tr>
              ) : visibleRequests.length > 0 ? (
                visibleRequests.map((req) => (
                  <Fragment key={req._id}>
                  <tr
                    onClick={() => setDetailId(req._id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setDetailId(req._id); }}
                    tabIndex={0}
                    className="hover:bg-gray-50 cursor-pointer focus:outline-none focus:bg-amber-50/40"
                  >
                    <td className="p-4 font-semibold text-gray-900">
                      {req._id}
                      {isPickupForOther(req) && (
                        <div className="mt-1 text-[11px] font-normal">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5">
                            <UserCheck size={11} /> ຮັບແທນ {refName(req.requestedBy)}
                          </span>
                        </div>
                      )}
                      {isDeptRequest(req) && (
                        <div className="mt-1 text-[11px] font-normal text-gray-500 space-y-0.5">
                          <div>
                            <span className="inline-flex items-center rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5">
                              ແຜນກ {refName(req.departmentId)}
                            </span>
                          </div>
                          {req.custodianId && (
                            <div>ຜູ້ຮັບຜິດຊອບ: {refName(req.custodianId)}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {Array.isArray(req.items) && req.items.map((i, idx) => (
                        <div key={idx} className="text-xs flex items-center gap-2">
                          <span>• {i.name} (x{i.quantity})</span>
                        </div>
                      ))}
                    </td>
                    <td className="p-4">
                      {Array.isArray(req.items) ? req.items.reduce((sum, i) => sum + i.quantity, 0) : 0} ຊິ້ນ
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">
                      {renderStatus(req.status, req)}
                      {req.status === 'APPROVED' && hasPermission('supplies', 'fulfill') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openReceive(req); }}
                          title="ສະແກນເຄື່ອງ — ຮັບເຄື່ອງທີ່ຄັງ ແລະ ຜູກເຂົ້າທະບຽນຊັບສິນ"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition"
                        >
                          <ScanLine size={13} /> ສະແກນເຄື່ອງ
                        </button>
                      )}
                      {req.status === 'APPROVED' && (
                        <Link
                          to={`/supplies/receipt/${req._id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="ເປີດໃບຮັບເຄື່ອງ — ສະແກນ/ພິມ QR ເພື່ອຢືນຢັນຮັບເຄື່ອງທັງໃບ"
                          className="mt-1.5 ml-1.5 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition"
                        >
                          <QrCode size={13} /> ໃບຮັບເຄື່ອງ
                        </Link>
                      )}
                    </td>
                  </tr>
                  {!shouldHideProgress(req) && (
                    <tr
                      onClick={() => setDetailId(req._id)}
                      style={{ borderTopWidth: 0 }}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td colSpan="5" className="px-4 pb-4 pt-0">
                        <RequestProgress req={req} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    {requests.length === 0
                      ? 'ຍັງບໍ່ມີຄຳຂໍອຸປະກອນໃນລະບົບ'
                      : listTab === 'PICKUP'
                        ? 'ບໍ່ມີໃບຂໍທີ່ຖືກກຳນົດໃຫ້ທ່ານໄປຮັບແທນ'
                        : 'ບໍ່ພົບໃບຂໍທີ່ກົງກັບການຄົ້ນຫາ/ຕົວກັ່ນຕອງ'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {detailRequest && (() => {
          const d = detailRequest;
          const totalQty = Array.isArray(d.items) ? d.items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0;
          const person = (ref) => {
            const name = refName(ref);
            const code = ref && typeof ref === 'object' ? ref.employeeCode : '';
            return name ? `${name}${code ? ` (${code})` : ''}` : '—';
          };
          const Row = ({ label, children }) => (
            <div className="flex justify-between gap-4 py-2 border-b border-gray-50 text-sm">
              <span className="text-gray-500 shrink-0">{label}</span>
              <span className="text-gray-800 font-medium text-right break-words">{children}</span>
            </div>
          );
          return (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDetailId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`ລາຍລະອຽດໃບຂໍ ${d._id}`}
                className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-gray-800">ໃບຂໍ {d._id}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {renderStatus(d.status, d)}
                      {d.status === 'APPROVED' && hasPermission('supplies', 'fulfill') && (
                        <button
                          type="button"
                          onClick={() => { setDetailId(null); openReceive(d); }}
                          title="ສະແກນເຄື່ອງ — ຮັບເຄື່ອງທີ່ຄັງ ແລະ ຜູກເຂົ້າທະບຽນຊັບສິນ"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition"
                        >
                          <ScanLine size={13} /> ສະແກນເຄື່ອງ
                        </button>
                      )}
                      {OPEN_STATUSES.includes(d.status) && (
                        <Link
                          to={`/supplies/receipt/${d._id}`}
                          title="ເປີດໃບຮັບເຄື່ອງ — ສະແກນ/ພິມ QR ເພື່ອຢືນຢັນຮັບເຄື່ອງທັງໃບ"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition"
                        >
                          <QrCode size={13} /> ໃບຮັບເຄື່ອງ
                        </Link>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => setDetailId(null)} aria-label="ປິດ" className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {isPickupForOther(d) && OPEN_STATUSES.includes(d.status) && (
                  <div className="text-sm bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 flex items-start gap-2">
                    <UserCheck size={16} className="mt-0.5 shrink-0" />
                    <span>
                      {refName(d.requestedBy)} ຂໍໃຫ້ທ່ານໄປຮັບເຄື່ອງແທນ — ເປີດໃບຮັບເຄື່ອງເພື່ອຢືນຢັນເມື່ອໄດ້ຮັບແລ້ວ. ເຄື່ອງຈະຖືກບັນທຶກໃຫ້ຜູ້ຂໍ{isDeptRequest(d) ? '/ແຜນກ' : ''}.
                    </span>
                  </div>
                )}

                <div>
                  <Row label="ຜູ້ຂໍ">{person(d.requestedBy)}</Row>
                  {isDeptRequest(d) && <Row label="ແຜນກ">{refName(d.departmentId) || '—'}</Row>}
                  {isDeptRequest(d) && <Row label="ຜູ້ຮັບຜິດຊອບ">{person(d.custodianId)}</Row>}
                  <Row label="ຜູ້ຮັບແທນ">
                    {d.delegateId ? (
                      <>
                        {person(d.delegateId)}
                        {d.delegateSetAt && <span className="block text-[11px] font-normal text-gray-400">ກຳນົດເມື່ອ {formatDateTime(d.delegateSetAt)}</span>}
                      </>
                    ) : (
                      <span className="font-normal text-gray-400">ຍັງບໍ່ໄດ້ກຳນົດ</span>
                    )}
                  </Row>
                  <Row label="ວັນທີຍື່ນ">{formatDateTime(d.createdAt)}</Row>
                  {d.managerApprovedBy && <Row label="ຫົວໜ້າພະແນກອະນຸມັດ">{person(d.managerApprovedBy)} · {formatDateTime(d.managerApprovedAt)}</Row>}
                  {d.approvedAt && <Row label="ອະນຸມັດ">{person(d.approvedBy)} · {formatDateTime(d.approvedAt)}</Row>}
                  {d.rejectionReason && <Row label="ເຫດຜົນທີ່ປະຕິເສດ"><span className="text-rose-600">{d.rejectionReason}</span></Row>}
                  {d.fulfilledAt && <Row label="ຢືນຢັນຮັບເຄື່ອງໂດຍ">{person(d.fulfilledBy)} · {formatDateTime(d.fulfilledAt)}</Row>}
                  {d.receivedBy && <Row label="ຜູ້ຮັບເຄື່ອງ">{person(d.receivedBy)}</Row>}
                </div>

                {Array.isArray(d.items) && d.items.some((it) => it.purchaseRequestId) && (
                  <div className="border border-violet-100 bg-violet-50/40 rounded-xl p-4 space-y-3">
                    <div className="text-sm font-semibold text-violet-800">ລາຍການທີ່ຕ້ອງຊື້ເພີ່ມ (ສະຕັອກບໍ່ພໍ)</div>
                    {d.items.filter((it) => it.purchaseRequestId).map((it, k) => {
                      const arrived = it.arrivedQty || 0;
                      const stalled = it.purchaseStatus === 'REJECTED' || it.purchaseStatus === 'CANCELLED';
                      return (
                        <div key={`${it.purchaseRequestId}-${k}`} className="text-sm space-y-1">
                          <div className="flex justify-between gap-3">
                            <span className="font-medium text-gray-800">{it.name}</span>
                            <span className="text-gray-500 font-mono text-xs">{it.purchaseRequestNo}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            ຂໍ {it.quantity} = ໃຊ້ສະຕັອກ {Math.max((it.quantity || 0) - (it.purchaseQty || 0), 0)} + ຊື້ເພີ່ມ {it.purchaseQty}
                            {' · '}ຂອງມາແລ້ວ <b>{arrived}/{it.purchaseQty}</b>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, Math.round((arrived / (it.purchaseQty || 1)) * 100))}%` }} />
                          </div>
                          {stalled && (
                            <div className="text-xs text-red-600">
                              ໃບສະເໜີຊື້ຖືກ{it.purchaseStatus === 'REJECTED' ? 'ປະຕິເສດ' : 'ຍົກເລີກ'} — ຄຳຂໍນີ້ຍັງຄ້າງ ສ່ວນທີ່ຂາດຍັງບໍ່ໄດ້ຮັບການຈັດຫາ
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {d.status === 'PENDING_MANAGER' && (
                      <div className="text-xs text-indigo-700">ລໍຖ້າຫົວໜ້າພະແນກອະນຸມັດກ່ອນ — ຫຼັງຈາກນັ້ນຈຶ່ງສົ່ງຕໍ່ໃຫ້ຝ່າຍສາງ</div>
                    )}
                    {d.status === 'REQUESTED' && (
                      <div className="text-xs text-gray-500">ຜູ້ອະນຸມັດຈະອະນຸມັດຄຳຂໍນີ້ພ້ອມໃບສະເໜີຊື້</div>
                    )}
                    {d.status === 'ORDERED' && (
                      <div className="text-xs text-violet-700">ລໍຂອງເຂົ້າຄັງ — ຈະແຈ້ງເມື່ອຂອງມາຄົບ ແລະພ້ອມມາຮັບ</div>
                    )}
                    {d.status === 'APPROVED' && d.readyToCollectAt && (
                      <div className="text-xs text-teal-700">
                        ພ້ອມມາຮັບແລ້ວ ({formatDateTime(d.readyToCollectAt)}) — ເຄື່ອງຖືກຈອງໄວ້ໃຫ້ ມາສະແກນຮັບໄດ້ເລີຍ
                      </div>
                    )}
                  </div>
                )}

                {OPEN_STATUSES.includes(d.status) && (isMe(d.requestedBy) || isMe(d.custodianId)) && (
                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-700">ຜູ້ມາຮັບເຄື່ອງແທນຂ້ອຍ</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDelegatePickerOpen((v) => !v)}
                          className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium"
                        >
                          {delegatePickerOpen ? 'ປິດລາຍຊື່' : d.delegateId ? 'ປ່ຽນຄົນ' : 'ເລືອກຄົນ'}
                        </button>
                        {d.delegateId && (
                          <button
                            type="button"
                            disabled={delegateSaving}
                            onClick={() => saveDelegate(null)}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40"
                          >
                            ລຶບ
                          </button>
                        )}
                      </div>
                    </div>

                    {delegatePickerOpen && (
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              autoFocus
                              value={candQuery}
                              onChange={(e) => setCandQuery(e.target.value)}
                              placeholder="ຄົ້ນຫາຊື່ ຫຼື ລະຫັດພະນັກງານ..."
                              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm"
                            />
                          </div>
                          <select
                            value={candDept}
                            onChange={(e) => setCandDept(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            aria-label="ກັ່ນຕອງຕາມແຜນກ"
                          >
                            <option value="">ທຸກແຜນກ</option>
                            {candidates.departments.map((dep) => (
                              <option key={dep._id} value={dep._id}>{dep.name}</option>
                            ))}
                          </select>
                        </div>
                        {candError && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{candError}</div>
                        )}
                        <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                          {candLoading && candidates.users.length === 0 ? (
                            <li className="p-3 text-xs text-gray-400 text-center">ກຳລັງຄົ້ນຫາ...</li>
                          ) : candidates.users.length === 0 ? (
                            <li className="p-3 text-xs text-gray-400 text-center">ບໍ່ພົບຄົນທີ່ຕົງກັບການຄົ້ນຫາ</li>
                          ) : (
                            candidates.users.map((u) => {
                              const isCurrent = refId(d.delegateId) === u._id;
                              return (
                                <li key={u._id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-800 truncate">
                                      {refName(u)} <span className="font-mono text-xs text-gray-400">({u.employeeCode})</span>
                                    </div>
                                    {u.departmentId?.name && <div className="text-[11px] text-gray-500">{u.departmentId.name}</div>}
                                  </div>
                                  {isCurrent ? (
                                    <span className="text-[11px] text-emerald-600 font-medium shrink-0">ປັດຈຸບັນ</span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={delegateSaving}
                                      onClick={() => saveDelegate(u.employeeCode)}
                                      className="shrink-0 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
                                    >
                                      ເລືອກ
                                    </button>
                                  )}
                                </li>
                              );
                            })
                          )}
                        </ul>
                        <div className="text-[11px] text-gray-400">
                          ເລືອກໄດ້ 1 ຄົນ ແລະປ່ຽນໄດ້ຈົນກວ່າຈະຮັບເຄື່ອງ — ເຄື່ອງຍັງບັນທຶກໃຫ້ຜູ້ຂໍ{isDeptRequest(d) ? '/ແຜນກ' : ''}ຄືເກົ່າ
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {d.receiveOverride && (
                  <div className="text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 space-y-0.5">
                    <div className="font-semibold">ເຈົ້າໜ້າທີ່ສາງຮັບແທນ (override)</div>
                    <div>ໂດຍ {person(d.receiveOverride.by)} · {formatDateTime(d.receiveOverride.at)}</div>
                    <div>ເຫດຜົນ: {d.receiveOverride.reason}</div>
                  </div>
                )}

                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs">
                      <tr>
                        <th className="p-3">ລາຍການ</th>
                        <th className="p-3 text-center">ຈຳນວນ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(d.items || []).map((i, k) => (
                        <tr key={k}>
                          <td className="p-3">
                            <div className="flex items-start gap-3">
                              <CatalogThumb url={catalogById(i.catalogItemId)?.imageUrl} name={i.name} size={40} />
                              <div className="min-w-0">
                                <div className="font-medium text-gray-800">{i.name}</div>
                                {i.catalogItemId && <div className="text-[11px] font-mono text-gray-400">{i.catalogItemId}</div>}
                                {i.reason && <div className="text-xs text-gray-500">ເຫດຜົນ: {i.reason}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center font-semibold">{i.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 text-sm">
                        <td className="p-3 text-gray-500">ລວມ</td>
                        <td className="p-3 text-center font-semibold">{totalQty} ຊິ້ນ</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setDetailId(null)} className="px-4 py-2 text-sm text-gray-600">ປິດ</button>
                </div>
              </div>
            </div>
          );
        })()}

        {isModalOpen && (() => {
          const activeCatalog = (Array.isArray(catalog) ? catalog : []).filter((c) => c.isActive !== false);
          const categoryChips = [...new Set(
            activeCatalog.flatMap((c) => String(c.category || '').split(',').map((t) => t.trim()).filter(Boolean)),
          )].sort();
          const q = shopSearch.trim().toLowerCase();
          const shown = activeCatalog.filter((c) => {
            if (shopCategory && !String(c.category || '').split(',').map((t) => t.trim()).includes(shopCategory)) return false;
            return !q || `${c.name} ${c.category || ''} ${c._id}`.toLowerCase().includes(q);
          });
          const cartRows = items.map((it, index) => ({ it, index })).filter(({ it }) => !isBlankRow(it));
          const totalQty = cartRows.reduce((s, { it }) => s + (parseInt(it.quantity, 10) || 0), 0);
          const closeModal = () => { setIsModalOpen(false); setSubmitError(''); };

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
                <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">ສ້າງຄຳຂໍເບີກອຸປະກອນ</h2>
                    <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ">✕</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${reqStep === 1 ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'}`}>
                      <b>1</b> ເລືອກສິນຄ້າ
                    </span>
                    <span className="text-gray-300">—</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${reqStep === 2 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <b>2</b> ລາຍລະອຽດ ແລະ ສົ່ງຄຳຂໍ
                    </span>
                  </div>
                </div>

                {reqStep === 1 ? (
                  <>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50/60">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={shopSearch}
                            onChange={(e) => setShopSearch(e.target.value)}
                            placeholder="ຄົ້ນຫາຊື່, ລະຫັດ ຫຼື ໝວດໝູ່..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {categoryChips.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {['', ...categoryChips].map((c) => (
                            <button
                              key={c || '__all'}
                              type="button"
                              onClick={() => setShopCategory(c)}
                              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                                shopCategory === c
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {c || 'ທັງໝົດ'}
                            </button>
                          ))}
                        </div>
                      )}

                      {shown.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-400">
                          {activeCatalog.length === 0 ? 'ຍັງບໍ່ມີລາຍການໃນ Catalog' : 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {shown.map((c) => {
                            const stock = c.stockQty ?? 0;
                            const low = stock > 0 && stock <= (c.lowStockThreshold ?? 0);
                            const inCart = items.find((it) => it.catalogItemId === c._id);
                            const qtyInCart = inCart ? parseInt(inCart.quantity, 10) || 0 : 0;
                            return (
                              <div
                                key={c._id}
                                className={`flex flex-col bg-white rounded-xl border overflow-hidden transition ${
                                  qtyInCart > 0 ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200 hover:shadow-sm'
                                }`}
                              >
                                <div className="relative aspect-square bg-gray-50">
                                  {c.imageUrl ? (
                                    <img src={imageSrc(c.imageUrl)} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                                      <Package size={44} />
                                    </div>
                                  )}
                                  <span
                                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      stock <= 0 ? 'bg-red-100 text-red-700' : low ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {stock <= 0 ? 'ສະຕ໊ອກໝົດ' : `ເຫຼືອ ${stock} ${c.unit || ''}`}
                                  </span>
                                  {qtyInCart > 0 && (
                                    <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                                      {qtyInCart}
                                    </span>
                                  )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug" title={c.name}>{c.name}</div>
                                    <div className="text-[11px] text-gray-400 truncate">{c._id}{c.category ? ` · ${c.category}` : ''}</div>
                                  </div>
                                  <div className="mt-auto">
                                    {qtyInCart > 0 ? (
                                      <QtyStepper
                                        value={qtyInCart}
                                        onMinus={() => shopSetQty(c._id, qtyInCart - 1)}
                                        onPlus={() => shopSetQty(c._id, qtyInCart + 1)}
                                        onType={(n) => shopSetQty(c._id, n)}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => shopAdd(c)}
                                        className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600"
                                      >
                                        <Plus size={14} /> ເພີ່ມ
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">ບໍ່ພົບສິນຄ້າທີ່ຕ້ອງການ? ພິມຊື່ເອງ</div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
                            placeholder="ຕົວຢ່າງ: ບີກສີຟ້າ, ເຈ້ຍ A4"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={addCustomItem}
                            disabled={!customName.trim()}
                            className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                          >
                            + ເພີ່ມ
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        {cartRows.length === 0 ? (
                          <span className="text-gray-400">ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າ</span>
                        ) : (
                          <>ເລືອກແລ້ວ <b className="text-gray-900">{cartRows.length}</b> ລາຍການ · ລວມ <b className="text-gray-900">{totalQty}</b> ຊິ້ນ</>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">ຍົກເລີກ</button>
                        <button
                          type="button"
                          disabled={cartRows.length === 0}
                          onClick={() => { setSubmitError(''); setReqStep(2); }}
                          className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
                        >
                          ຕໍ່ໄປ →
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSubmitRequest} className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ລາຍການທີ່ເລືອກ ({cartRows.length})</div>
                          <button type="button" onClick={() => setReqStep(1)} className="text-xs text-amber-600 font-medium hover:underline">+ ເລືອກສິນຄ້າເພີ່ມ</button>
                        </div>
                        {cartRows.map(({ it: item, index }) => {
                          const cat = item.catalogItemId ? catalogById(item.catalogItemId) : null;
                          const stock = cat?.stockQty ?? 0;
                          const qtyNum = parseInt(item.quantity, 10) || 0;
                          const over = cat && qtyNum > stock;
                          return (
                            <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                              <CatalogThumb url={cat?.imageUrl} name={item.name} size={64} />
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                                    <div className="text-[11px] text-gray-400">
                                      {cat ? `${cat._id} · ${cat.category || '—'}` : 'ລາຍການພິມເອງ (ບໍ່ຢູ່ໃນ Catalog)'}
                                    </div>
                                  </div>
                                  <button type="button" onClick={() => removeRow(index)} className="text-rose-500 text-xs font-medium hover:underline shrink-0">ລຶບ</button>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <QtyStepper
                                    value={item.quantity}
                                    onMinus={() => setRowQty(index, qtyNum - 1)}
                                    onPlus={() => setRowQty(index, qtyNum + 1)}
                                    onType={(n) => setRowQty(index, n)}
                                  />
                                  {cat && (
                                    <span className={`text-[11px] ${over ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                      {over ? `⚠ ເກີນສະຕ໊ອກ (ມີ ${stock} ${cat.unit || ''})` : `ຄົງເຫຼືອ ${stock} ${cat.unit || ''}`}
                                    </span>
                                  )}
                                </div>
                                {cat && item.purchaseRequestId ? (
                                  <div className="text-[11px] space-y-0.5">
                                    <p className={purchaseLinkIssue(item) ? 'text-red-600 font-medium' : 'text-emerald-700 font-medium'}>
                                      ✓ ຜູກກັບ {item.purchaseRequestNo} — ຊື້ເພີ່ມ {item.purchaseQty}, ໃຊ້ສະຕັອກ {Math.max(qtyNum - item.purchaseQty, 0)}
                                    </p>
                                    {purchaseLinkIssue(item) && <p className="text-red-600">{purchaseLinkIssue(item)}</p>}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...items];
                                        clearPurchaseLink(next[index]);
                                        setItems(next);
                                      }}
                                      className="text-gray-500 hover:underline"
                                    >
                                      ຍົກເລີກການຜູກ
                                    </button>
                                  </div>
                                ) : (
                                  cat && over && canRequest && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRestockPrefill({
                                          itemIndex: index,
                                          catalogItemId: item.catalogItemId,
                                          quantity: Math.max(qtyNum - stock, 1),
                                          reason: `ສະຕັອກບໍ່ພຽງພໍສຳລັບຄຳຂໍເບີກ (ຕ້ອງການ ${qtyNum}, ມີ ${stock})`,
                                        })
                                      }
                                      className="text-[11px] font-medium text-blue-600 hover:underline"
                                    >
                                      + ຂໍຊື້ເພີ່ມ
                                    </button>
                                  )
                                )}
                                <input
                                  type="text"
                                  value={item.reason}
                                  onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                                  placeholder="ເຫດຜົນການຂໍເບີກ (ຕົວຢ່າງ: ເຄື່ອງເກົ່າໝົດ, ໃຊ້ງານໂຄງການໃໝ່)"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ຂໍໃນນາມ</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRequestFor('PERSON')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                              requestFor === 'PERSON' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            ຂໍສ່ວນຕົວ
                          </button>
                          {requestableDepartments.length > 0 && (
                            <button
                              type="button"
                              onClick={chooseDepartmentRequest}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                requestFor === 'DEPARTMENT' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              ຂໍໃນນາມແຜນກ
                            </button>
                          )}
                        </div>
                        {requestFor === 'DEPARTMENT' && (
                          <>
                            {requestableDepartments.length > 1 && (
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">ເລືອກພະແນກ *</label>
                                <select
                                  required
                                  value={selectedDepartmentId}
                                  onChange={(e) => changeRequestDepartment(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                                >
                                  <option value="">-- ເລືອກພະແນກ --</option>
                                  {requestableDepartments.map((department) => (
                                    <option key={department._id} value={department._id}>
                                      {department.name}{department.branchId ? ` (${department.branchId})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                              ແຜນກ: <b>{myDepartmentName || 'ກະລຸນາເລືອກພະແນກ'}</b> — ຊັບສິນທີ່ໄດ້ຮັບຈະຂຶ້ນກັບແຜນກ ແລະ ມອບໃຫ້ຜູ້ຮັບຜິດຊອບທີ່ລະບຸ
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">ຜູ້ຮັບຜິດຊອບ *</label>
                              {custodian ? (
                                <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-2.5 bg-white">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                      {custodian.name || custodian.employeeCode}
                                      <span className="ml-1 font-mono text-xs text-gray-400">({custodian.employeeCode})</span>
                                    </div>
                                    {custodian.employeeCode === me?.employeeCode && (
                                      <div className="text-[11px] text-violet-600">ທ່ານເອງ (ຄ່າເລີ່ມຕົ້ນ)</div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setCustPickerOpen((v) => !v)}
                                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                                  >
                                    {custPickerOpen ? 'ປິດ' : 'ປ່ຽນຄົນ'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!selectedDepartmentId}
                                  onClick={() => setCustPickerOpen(true)}
                                  className="w-full text-sm px-3 py-2 rounded-lg border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                                >
                                  + ເລືອກຜູ້ຮັບຜິດຊອບ
                                </button>
                              )}

                              {custPickerOpen && (
                                <div className="mt-2 space-y-2">
                                  <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                      type="text"
                                      autoFocus
                                      value={custQuery}
                                      onChange={(e) => setCustQuery(e.target.value)}
                                      placeholder="ຄົ້ນຫາຊື່ ຫຼື ລະຫັດພະນັກງານ..."
                                      className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-white"
                                    />
                                  </div>
                                  {custError && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{custError}</div>
                                  )}
                                  <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white">
                                    {custLoading && custResults.length === 0 ? (
                                      <li className="p-3 text-xs text-gray-400 text-center">ກຳລັງຄົ້ນຫາ...</li>
                                    ) : custResults.length === 0 ? (
                                      <li className="p-3 text-xs text-gray-400 text-center">ບໍ່ພົບຄົນທີ່ຕົງກັບການຄົ້ນຫາ</li>
                                    ) : (
                                      custResults.map((u) => {
                                        const isCurrent = u.employeeCode === custodianCode;
                                        return (
                                          <li key={u._id}>
                                            <button
                                              type="button"
                                              onClick={() => pickCustodian(u)}
                                              className={`w-full text-left flex items-center justify-between gap-3 p-2.5 text-sm hover:bg-violet-50 ${
                                                isCurrent ? 'bg-violet-50' : ''
                                              }`}
                                            >
                                              <span className="min-w-0">
                                                <span className="block font-medium text-gray-800 truncate">
                                                  {refName(u)} <span className="font-mono text-xs text-gray-400">({u.employeeCode})</span>
                                                </span>
                                                {u.departmentId?.name && (
                                                  <span className="block text-[11px] text-gray-500">{u.departmentId.name}</span>
                                                )}
                                              </span>
                                              {isCurrent && <span className="shrink-0 text-[11px] text-violet-600 font-medium">ເລືອກແລ້ວ</span>}
                                            </button>
                                          </li>
                                        );
                                      })
                                    )}
                                  </ul>
                                </div>
                              )}
                              <p className="text-[11px] text-gray-400 mt-1">
                                ເລືອກໄດ້ສະເພາະສະມາຊິກ ຫຼື ຫົວໜ້າຂອງແຜນກນີ້ — ຄ່າເລີ່ມຕົ້ນແມ່ນຕົວທ່ານເອງ
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {overStockCount > 0 && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          ມີ {overStockCount} ລາຍການທີ່ຂໍເກີນສະຕ໊ອກປັດຈຸບັນ — ສົ່ງໄດ້ ແຕ່ເຈົ້າໜ້າທີ່ສາງອາດຈ່າຍບໍ່ຄົບຈົນກວ່າຂອງຈະເຂົ້າສາງ. ກົດ "+ ຂໍຊື້ເພີ່ມ" ເພື່ອຜູກກັບໃບສະເໜີຊື້ ລະບົບຈະແຈ້ງເມື່ອຂອງມາຮອດ
                        </div>
                      )}
                      {linkedCount > 0 && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          {linkedCount} ລາຍການຜູກກັບໃບສະເໜີຊື້ — ເມື່ອຜູ້ອະນຸມັດອະນຸມັດໃບສະເໜີຊື້ ຄຳຂໍນີ້ຈະຖືກອະນຸມັດພ້ອມກັນ ແລະທ່ານຈະໄດ້ຮັບແຈ້ງເມື່ອຂອງພ້ອມມາຮັບ (ຍັງຕ້ອງສະແກນຮັບຕາມປົກກະຕິ)
                        </div>
                      )}
                      {submitError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
                      )}
                      {restockNotice && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{restockNotice}</div>
                      )}
                    </div>

                    <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        <b className="text-gray-900">{cartRows.length}</b> ລາຍການ · ລວມ <b className="text-gray-900">{totalQty}</b> ຊິ້ນ
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setReqStep(1)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">← ກັບຄືນ</button>
                        <button
                          type="submit"
                          disabled={cartRows.length === 0}
                          className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-sm disabled:opacity-40"
                        >
                          ສົ່ງຄຳຂໍ
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          );
        })()}

        {restockPrefill && (
          <PurchaseRequestModal
            catalog={catalog}
            initialCatalogItemId={restockPrefill.catalogItemId}
            initialQuantity={restockPrefill.quantity}
            initialReason={restockPrefill.reason}
            onClose={() => setRestockPrefill(null)}
            onSaved={(pr) => {
              const rowIndex = restockPrefill.itemIndex;
              setRestockPrefill(null);
              if (pr?._id && Number.isInteger(rowIndex)) {
                setItems((prev) =>
                  prev.map((row, i) =>
                    i === rowIndex
                      ? { ...row, purchaseRequestId: pr._id, purchaseRequestNo: pr.prNo, purchaseQty: pr.quantity }
                      : row,
                  ),
                );
                setRestockNotice(`ສົ່ງໃບສະເໜີຊື້ ${pr.prNo} ສຳເລັດ ແລະຜູກກັບແຖວນີ້ແລ້ວ — ກົດ \"ສົ່ງຄຳຂໍ\" ເພື່ອຢືນຢັນ`);
              } else {
                setRestockNotice('ສົ່ງໃບສະເໜີຊື້ສຳເລັດ — ລໍອະນຸມັດ');
              }
              setTimeout(() => setRestockNotice(''), 6000);
            }}
          />
        )}

        {receiveRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">
                  {receiveStage === 1 ? 'ສະແກນເຄື່ອງ' : 'ຢືນຢັນຜູ້ຮັບ'} — {receiveRequest._id}
                </h2>
                <button type="button" onClick={closeReceive} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {receiveIsDept && (
                <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  ໃບຂໍຂອງແຜນກ <b>{refName(receiveRequest.departmentId)}</b>
                  {receiveRequest.custodianId && <> · ຜູ້ຮັບຜິດຊອບ <b>{refName(receiveRequest.custodianId)}</b></>}
                  {' '}— ຊັບສິນຈະຂຶ້ນກັບແຜນກ
                </div>
              )}

              {receiveStage === 1 ? (
                <form onSubmit={(e) => { e.preventDefault(); gotoStage2(); }} className="space-y-3">
                  <p className="text-xs text-gray-500">
                    ສະແກນ ຫຼື ກຣອກລະຫັດ Asset Tag ຈາກບາໂຄ໊ດ/QR ທີ່ຕິດກັບເຄື່ອງຂອງບໍລິສັດ.
                    ລະບົບຈະກວດກັບທະບຽນຊັບສິນ ແລະ ລາຍການທີ່ຂໍ ກ່ອນຈະຢືນຢັນ.
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-700">
                        ລາຍການທີ່ຂໍ {assetsKnown && <span className={plannedDone === itemPlan.length ? 'text-emerald-600' : 'text-amber-600'}>({plannedDone}/{itemPlan.length} ຄົບ)</span>}
                      </div>
                      {hasPermission('assets', 'read') && (
                        <button type="button" onClick={loadAssets} className="text-xs text-blue-600 hover:underline">↻ ໂຫຼດທະບຽນໃໝ່</button>
                      )}
                    </div>
                    {itemPlan.map((p) => (
                      <div key={p.k} className={`text-xs bg-white border rounded-lg px-3 py-2 space-y-1 ${p.over ? 'border-red-200' : p.done ? 'border-emerald-200' : 'border-gray-100'}`}>
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-gray-800">{p.it.name} <span className="text-gray-400">x{p.qty}</span></span>
                          {p.kind === 'asset' && (
                            <span className={p.over ? 'text-red-600' : p.done ? 'text-emerald-600' : 'text-amber-600'}>
                              {p.over ? `ສະແກນເກີນ ${p.scanned}/${p.qty}` : p.done ? `✓ ສະແກນຄົບ ${p.scanned}/${p.qty}` : `ສະແກນ ${p.scanned}/${p.qty}`}
                            </span>
                          )}
                          {p.kind === 'consumable' && (
                            <span className={p.done ? 'text-emerald-600' : 'text-amber-600'}>{p.done ? '✓ ຮັບແລ້ວ' : 'ລໍຖ້າຢືນຢັນ'}</span>
                          )}
                        </div>
                        {p.kind === 'asset' && p.blocked && (
                          <div className="text-red-600">
                            ⚠ ໃນທະບຽນມີຊັບສິນວ່າງ {p.remainingAvail} ຊິ້ນ ແຕ່ຍັງຕ້ອງການອີກ {p.need} ຊິ້ນ —
                            {' '}<a href={`/asset-registry?fromRequest=${encodeURIComponent(receiveRequest._id)}`} target="_blank" rel="noreferrer" className="underline">ເພີ່ມຊັບສິນທີ່ຂາດຕາມໃບນີ້</a>, ແລ້ວກົດ "ໂຫຼດທະບຽນໃໝ່"
                          </div>
                        )}
                        {p.kind === 'consumable' && p.scanned === 0 && (
                          <label className="flex items-center gap-2 text-gray-600">
                            <input
                              type="checkbox"
                              checked={!!confirmedItems[p.k]}
                              onChange={(e) => { setConfirmedItems((prev) => ({ ...prev, [p.k]: e.target.checked })); setReceiveError(''); }}
                            />
                            ໄດ້ຮັບແລ້ວ — ຂອງສິ້ນເປືອງ (ບໍ່ມີ Asset Tag, ລະບົບຕັດສະຕ໊ອກໃຫ້)
                          </label>
                        )}
                      </div>
                    ))}
                    {!assetsKnown && (
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={!!confirmedItems.all} onChange={(e) => setConfirmedItems((prev) => ({ ...prev, all: e.target.checked }))} />
                        ມີຂອງສິ້ນເປືອງ (ບໍ່ມີ Asset Tag) ໃນໃບນີ້ ແລະໄດ້ຮັບຄົບແລ້ວ (ເຈົ້າບໍ່ມີສິດເບິ່ງທະບຽນ — Backend ຈະກວດອີກຄັ້ງ)
                      </label>
                    )}
                    {blockedPlan.length > 0 && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        ໃບນີ້ຍັງຮັບບໍ່ຄົບໄດ້ ເພາະຊັບສິນບາງລາຍການບໍ່ພໍໃນທະບຽນ. ທາງອອກ: (1) ເພີ່ມຊັບສິນທີ່ຂາດໃນທະບຽນ ແລ້ວມາສະແກນໃໝ່, ຫຼື (2) ໃຫ້ແອັດມິນປະຕິເສດ/ແກ້ຈຳນວນຄຳຂໍ.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-600">Asset Tag (ສະແກນ/ພິມ)</label>
                      <button
                        type="button"
                        onClick={() => setScannerOpen(true)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition"
                      >
                        <Camera size={13} /> ສະແກນດ້ວຍກ້ອງ
                      </button>
                    </div>
                    <textarea
                      autoFocus
                      rows={4}
                      value={scanTags}
                      onChange={(e) => { setScanTags(e.target.value); setReceiveError(''); }}
                      placeholder="ສະແກນ ຫຼື ກຣອກ ລະຫັດ Asset Tag — 1 ລາຍການຕໍ່ແຖວ..."
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">ສະແກນຫຼາຍອັນຕິດຕໍ່ກັນໄດ້ — ແຕ່ລະອັນຂຶ້ນບັນທັດໃໝ່ (Enter ພາຍຫຼັງສະແກນ)</p>
                  </div>

                  {scanResults.length > 0 && (
                    <div className="space-y-1.5">
                      {scanResults.map((r, i) => {
                        const { cls, text } =
                          !r.status
                            ? { text: 'ລໍຖ້າ Backend ກວດສອບຕອນບັນທຶກ', cls: 'text-gray-500' }
                            : r.status === 'ok'
                              ? { text: `✓ ${r.asset.type} — ກົງກັບລາຍການ ແລະ ວ່າງ`, cls: 'text-emerald-600' }
                              : r.status === 'not-found'
                                ? { text: '✕ ບໍ່ພົບລະຫັດນີ້ໃນທະບຽນຊັບສິນ', cls: 'text-red-600' }
                                : r.status === 'not-available'
                                  ? { text: `✕ ສະຖານະ ${r.asset.status} — ບໍ່ວ່າງ`, cls: 'text-red-600' }
                                  : { text: `✕ ຊະນິດບໍ່ກົງກັບລາຍການທີ່ຂໍ (${r.asset.type})`, cls: 'text-red-600' };
                        return (
                          <div key={i} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex justify-between gap-2">
                            <span className="font-mono truncate">{r.tag}</span>
                            <span className={cls}>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {receiveError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{receiveError}</div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeReceive} className="px-4 py-2 text-sm text-gray-600">ປິດ</button>
                    <button
                      type="submit"
                      disabled={!canProceed}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <PackageCheck size={15} /> ຖັດໄປ: ຢືນຢັນຜູ້ຮັບ
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={submitReceive} className="space-y-3">
                  <p className="text-xs text-gray-500">
                    ກວດສອບຜູ້ທີ່ຈະຮັບເຄື່ອງ. Backend ຈະຢືນຢັນລະຫັດອີກຄັ້ງ ກ່ອນຜູກເຄື່ອງເຂົ້າທະບຽນຊັບສິນຂອງບໍລິສັດ.
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="font-semibold text-gray-700">ເຄື່ອງທີ່ຈະຮັບ ({scannedTags().length}{consumablePlan.some((p) => confirmedItems[p.k]) ? ` + ຂອງສິ້ນເປືອງ ${consumablePlan.filter((p) => confirmedItems[p.k]).length}` : ''})</div>
                    <div className="text-xs text-gray-600 break-all font-mono">{scannedTags().join(', ')}</div>
                    {consumablePlan.filter((p) => confirmedItems[p.k]).map((p) => (
                      <div key={p.k} className="text-xs text-gray-600">• {p.it.name} x{p.qty} (ຂອງສິ້ນເປືອງ)</div>
                    ))}
                    <div className="pt-1">
                      <label className="block text-xs text-gray-500 mb-1">
                        ລະຫັດພະນັກງານຜູ້ຮັບ {receiveIsDept ? '(ທາງເລືອກ)' : '*'}
                      </label>
                      {receiveIsDept || changeReceiver ? (
                        <input
                          required={!receiveIsDept}
                          value={assigneeCode}
                          onChange={(e) => setAssigneeCode(e.target.value)}
                          placeholder="ລະຫັດພະນັກງານ..."
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm tracking-widest"
                        />
                      ) : (
                        <div className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm tracking-widest text-gray-700">
                          {assigneeCode || '—'}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {receiveIsDept
                          ? `ເວັ້ນວ່າງ = ຜູ້ຮັບຜິດຊອບຂອງແຜນກ (${refName(receiveRequest.custodianId)}) — ຜູ້ຮັບແທນຕ້ອງເປັນສະມາຊິກ ຫຼື ຫົວໜ້າແຜນກ`
                          : changeReceiver
                            ? 'ໃສ່ລະຫັດຄົນທີ່ມາຮັບແທນ (ຖ້າບໍ່ມີສິດ assets:assign Backend ຈະປະຕິເສດ)'
                            : 'ຜູ້ຮັບ = ຜູ້ຂໍຂອງຄຳຂໍນີ້'}
                      </p>
                      {!receiveIsDept && (
                        <button
                          type="button"
                          onClick={() => {
                            if (changeReceiver) setAssigneeCode(defaultAssigneeCode);
                            setChangeReceiver(!changeReceiver);
                          }}
                          className="mt-1 text-xs text-blue-600 hover:underline"
                        >
                          {changeReceiver ? 'ໃຊ້ຜູ້ຂໍເປັນຜູ້ຮັບ' : 'ຜູ້ຮັບເປັນຄົນອື່ນ'}
                        </button>
                      )}
                      {assigneeInfo.state === 'found' && assigneeInfo.user && (
                        <div className={`mt-2 text-xs rounded-lg px-3 py-2 border ${assigneeInfo.user.isActive === false ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                          ຜູ້ຮັບ: <b>{`${assigneeInfo.user.firstName || ''} ${assigneeInfo.user.lastName || ''}`.trim()}</b> ({assigneeInfo.user.employeeCode})
                          {assigneeInfo.user.isActive === false ? ' — ບັນຊີຖືກປິດໃຊ້ງານ' : ' — ກວດຊື່ກັບບັດພະນັກງານກ່ອນຢືນຢັນ'}
                        </div>
                      )}
                      {assigneeInfo.state === 'notfound' && (
                        <div className="mt-2 text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">ບໍ່ພົບລະຫັດພະນັກງານນີ້</div>
                      )}
                    </div>
                  </div>

                  {receiveError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{receiveError}</div>
                  )}
                  {receiveResult?.ok && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      ✓ ບັນທຶກສຳເລັດ — ຜູກ {receiveResult.assetTags.length} ຊິ້ນ ກັບຜູ້ຮັບ {receiveResult.assigneeCode || refName(receiveRequest?.custodianId)} ແລະ ຂຶ້ນທະບຽນຊັບສິນແລ້ວ{receiveResult.consumables > 0 ? ` (ຂອງສິ້ນເປືອງ ${receiveResult.consumables} ລາຍການ ຕັດສະຕ໊ອກແລ້ວ)` : ''}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setReceiveStage(1)} className="px-4 py-2 text-sm text-gray-600">ກັບຄືນ</button>
                    <button type="button" onClick={closeReceive} className="px-4 py-2 text-sm text-gray-600">ປິດ</button>
                    <button
                      type="submit"
                      disabled={receiving || !!receiveResult?.ok}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <PackageCheck size={15} />
                      {receiving ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນ ແລະ ບັນທຶກ'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {scannerOpen && (
          <CameraScanner
            continuous
            title="ສະແກນ Asset Tag"
            hint="ຈ່ອງກ້ອງໃສ່ QR/ບາໂຄ໊ດ — ສະແກນໄດ້ຫຼາຍອັນຕິດຕໍ່ກັນ"
            onScan={appendScannedTag}
            onClose={() => setScannerOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}