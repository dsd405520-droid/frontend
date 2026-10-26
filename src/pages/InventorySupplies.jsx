import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, Plus, CheckCircle, Clock, XCircle, PackageCheck, ScanLine, Camera, QrCode } from 'lucide-react';
import { hasPermission, getCurrentUser } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import axios from '../services/api';

const refId = (value) => (value && typeof value === 'object' ? value._id : value);
const refName = (value) => {
  if (!value) return '';
  if (typeof value !== 'object') return value;
  return `${value.firstName || ''} ${value.lastName || ''}`.trim() || value.name || value.email || value._id || '';
};
const isDeptRequest = (req) => !!(req && refId(req.departmentId));

export default function InventorySupplies() {
  const [searchParams] = useSearchParams();
  const canRequest = hasPermission('supplies', 'create');

  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [items, setItems] = useState([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
  const [submitError, setSubmitError] = useState('');
  const [requestFor, setRequestFor] = useState('PERSON');
  const [custodianCode, setCustodianCode] = useState('');

  const myDepartmentId = refId(me?.departmentId);
  const myDepartmentName = me?.departmentId?.name || myDepartmentId;

  // ຕົວເລືອກຫຼາຍລາຍການຈາກ Catalog — ຕິກຫຼາຍອັນ + ໃສ່ຈຳນວນ ແລ້ວເພີ່ມເຂົ້າໃບຂໍພ້ອມກັນ
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState({}); // { [catalogId]: quantity }

  // ຮັບເຄື່ອງທີ່ຄັງ — ຫຼັງອະນຸມັດແລ້ວ ພະນັກງານສະແກນ QR/ບາໂຄ໊ດ ຂອງອຸປະກອນ 2 ຂັ້ນ:
  //   1. ສະແກນເຄື່ອງ → ກວດກັບລາຍການທີ່ຂໍ (ຖ້າມີສິດອ່ານທະບຽນຊັບສິນ)
  //   2. ຢືນຢັນຜູ້ຮັບ (ລະຫັດພະນັກງານ) → ບັນທຶກ ເຄື່ອງຈະຂຶ້ນກັບທະບຽນຊັບສິນຂອງບໍລິສັດ
  const [receiveRequest, setReceiveRequest] = useState(null);
  const [scanTags, setScanTags] = useState('');
  const [receiveStage, setReceiveStage] = useState(1); // 1 = ສະແກນເຄື່ອງ, 2 = ຢືນຢັນຜູ້ຮັບ
  const [allAssets, setAllAssets] = useState(null);    // null = ບໍ່ມີສິດ assets:read → ໃຫ້ Backend ກວດຕອນບັນທຶກ
  const [assigneeCode, setAssigneeCode] = useState('');
  const [confirmedItems, setConfirmedItems] = useState({}); // ຂອງສິ້ນເປືອງ (ບໍ່ມີ Asset Tag) ທີ່ຕິກ "ໄດ້ຮັບແລ້ວ" — key = index ລາຍການ, 'all' = ກໍລະນີກວດທະບຽນບໍ່ໄດ້
  const [receiving, setReceiving] = useState(false);
  // ຊື່ຜູ້ຮັບຈາກລະຫັດ (ສະເພາະຜູ້ມີສິດ assets:assign) — ໃຫ້ຜູ້ເບີກຈ່າຍກວດກັບບັດພະນັກງານ
  const [assigneeInfo, setAssigneeInfo] = useState({ state: 'idle', user: null });
  const [receiveError, setReceiveError] = useState('');
  const [receiveResult, setReceiveResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, catRes, meRes] = await Promise.all([
        axios.get('/supply-requests/my'),
        axios.get('/supply-catalog'),
        axios.get('/auth/me')
      ]);
      setMe(meRes.data?.data !== undefined ? meRes.data.data : meRes.data);
      
      const reqData = reqRes.data;
      setRequests(Array.isArray(reqData) ? reqData : (reqData.data || reqData.requests || reqData.items || []));

      const catData = catRes.data;
      setCatalog(Array.isArray(catData) ? catData : (catData.data || catData.items || []));
    } catch (err) {
      console.error('Failed to fetch supply data', err);
      setRequests([]);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Navbar "ສ້າງໃໝ່" → ເປີດ Modal ຂໍອຸປະກອນສິ້ນເປືອງ ອັດຕະໂນມັດ
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('create')]);

  const handleAddItem = () => {
    setItems([...items, { catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'catalogItemId' && value) {
      const selectedCat = catalog.find(c => c._id === value);
      if (selectedCat) {
        newItems[index].name = selectedCat.name;
      }
    }
    
    setItems(newItems);
  };

  // ຊ່ອງຄົ້ນຫາ+ເລືອກ Catalog — ໃຊ້ <input list> (datalist) ຄົ້ນຫາຊື່ໄດ້ ເຖິງມີເປັນຮ້ອຍລາຍການ.
  // ເມື່ອຄ່າທີ່ພິມ/ເລືອກກົງກັບຊື່ໃນ Catalog ພໍດີ (ເລືອກຈາກ dropdown ຫຼືພິມຄົບຊື່) ຈຶ່ງຈະຜູກ catalogItemId ໃຫ້;
  // ຖ້າຍັງພິມບໍ່ຄົບ/ບໍ່ກົງ ຈະຖືວ່າຍັງບໍ່ໄດ້ເລືອກ (catalogItemId ຫວ່າງ, ຊື່ໃນ "ຊື່ອຸປະກອນ" ຍັງແກ້ໄຂເອງໄດ້ຢູ່)
  const handleCatalogSearchChange = (index, value) => {
    const newItems = [...items];
    newItems[index].catalogSearch = value;

    const matched = catalog.find((c) => c.name === value);
    if (matched) {
      newItems[index].catalogItemId = matched._id;
      newItems[index].name = matched.name;
    } else {
      newItems[index].catalogItemId = '';
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const catalogById = (id) => (Array.isArray(catalog) ? catalog.find((c) => c._id === id) : undefined);

  const isBlankRow = (it) => !it.catalogItemId && !String(it.name || '').trim() && !String(it.reason || '').trim();

  const resetRequestForm = () => {
    setItems([{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }]);
    setSubmitError('');
    setPickerOpen(false);
    setPickerSearch('');
    setPickerSelected({});
    setRequestFor('PERSON');
    setCustodianCode('');
  };

  const chooseDepartmentRequest = () => {
    setRequestFor('DEPARTMENT');
    if (!custodianCode.trim()) setCustodianCode(me?.employeeCode || '');
  };

  const togglePicked = (id) => {
    setPickerSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setPickedQty = (id, qty) => {
    setPickerSelected((prev) => ({ ...prev, [id]: Math.max(1, parseInt(qty, 10) || 1) }));
  };

  // ເພີ່ມທຸກລາຍການທີ່ຕິກເຂົ້າໃບຂໍ — ຖ້າມີໃນໃບຂໍແລ້ວ ຈະບວກຈຳນວນເພີ່ມ ບໍ່ສ້າງແຖວຊ້ຳ
  const addPickedToRequest = () => {
    const ids = Object.keys(pickerSelected);
    if (ids.length === 0) return;
    let next = items.filter((it) => !isBlankRow(it));
    for (const id of ids) {
      const cat = catalogById(id);
      if (!cat) continue;
      const qty = pickerSelected[id];
      const existing = next.findIndex((it) => it.catalogItemId === id);
      if (existing >= 0) {
        next[existing] = { ...next[existing], quantity: (parseInt(next[existing].quantity, 10) || 0) + qty };
      } else {
        next.push({ catalogItemId: id, catalogSearch: cat.name, name: cat.name, quantity: qty, reason: '' });
      }
    }
    if (next.length === 0) next = [{ catalogItemId: '', catalogSearch: '', name: '', quantity: 1, reason: '' }];
    setItems(next);
    setPickerSelected({});
    setPickerSearch('');
    setPickerOpen(false);
  };

  // ລາຍການທີ່ຂໍເກີນສະຕ໊ອກ — ເຕືອນເທົ່ານັ້ນ (ບໍ່ບລັອກ ເພາະອາດລໍຖ້າຂອງເຂົ້າສາງໄດ້)
  const overStockCount = items.filter((it) => {
    const cat = it.catalogItemId ? catalogById(it.catalogItemId) : null;
    return cat && (parseInt(it.quantity, 10) || 0) > (cat.stockQty ?? 0);
  }).length;

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      // ລວມແຖວທີ່ເລືອກ catalog ອັນດຽວກັນ (ບວກຈຳນວນ, ຕໍ່ເຫດຜົນ) ກ່ອນສົ່ງ ເພື່ອບໍ່ໃຫ້ມີລາຍການຊ້ຳໃນໃບດຽວ
      const merged = [];
      for (const it of items.filter((x) => !isBlankRow(x))) {
        const qty = parseInt(it.quantity, 10) || 1;
        const name = String(it.name || '').trim();
        const prev = it.catalogItemId ? merged.find((m) => m.catalogItemId === it.catalogItemId) : null;
        if (prev) {
          prev.quantity += qty;
          if (it.reason && !String(prev.reason || '').includes(it.reason)) {
            prev.reason = prev.reason ? `${prev.reason}; ${it.reason}` : it.reason;
          }
        } else {
          merged.push({ catalogItemId: it.catalogItemId || '', name, quantity: qty, reason: it.reason || '' });
        }
      }
      if (merged.length === 0 || merged.some((m) => !m.name)) {
        setSubmitError('ກະລຸນາໃສ່ຊື່ອຸປະກອນຢ່າງໜ້ອຍ 1 ລາຍການ');
        return;
      }
      // catalogSearch ເປັນ field ໃຊ້ພາຍໃນ UI ເທົ່ານັ້ນ — ບໍ່ສົ່ງໄປໃຫ້ Backend
      const payloadItems = merged.map(({ catalogItemId, name, quantity, reason }) => ({
        ...(catalogItemId ? { catalogItemId } : {}),
        name,
        quantity,
        ...(reason ? { reason } : {}),
      }));
      if (requestFor === 'DEPARTMENT') {
        if (!myDepartmentId) {
          setSubmitError('ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຜູກກັບແຜນກ — ຈຶ່ງຂໍໃນນາມແຜນກບໍ່ໄດ້');
          return;
        }
        if (!custodianCode.trim()) {
          setSubmitError('ກະລຸນາລະບຸລະຫັດພະນັກງານຜູ້ຮັບຜິດຊອບຂອງແຜນກ');
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
      // backend ສົ່ງເຫດຜົນມາທີ່ `msg` (ບໍ່ແມ່ນ `message`)
      setSubmitError(err.response?.data?.msg || err.response?.data?.message || 'ສົ່ງຄຳຂໍບໍ່ສຳເລັດ');
    }
  };

  const openReceive = async (req) => {
    setReceiveRequest(req);
    setScanTags('');
    setReceiveStage(1);
    setAllAssets(null);
    setAssigneeCode(
      (isDeptRequest(req) ? req.custodianId?.employeeCode : req.requestedBy?.employeeCode)
        || req.userId?.employeeCode
        || req.createdBy?.employeeCode
        || getCurrentUser()?.employeeCode
        || ''
    );
    setReceiveError('');
    setReceiveResult(null);
    setScannerOpen(false);
    setConfirmedItems({});
    await loadAssets();
  };

  // ໂຫຼດທະບຽນຊັບສິນ (ເພື່ອກວດວ່າ tag ມີຈິງ/ຊະນິດກົງ/ສະຖານະວ່າງ ແລະຮູ້ວ່າແຕ່ລະລາຍການມີຊັບສິນວ່າງພໍບໍ) — ຖ້າບໍ່ມີສິດ ໃຫ້ Backend ກວດຕອນບັນທຶກ
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const scannedTags = () => scanTags.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // ເພີ່ມ tag ທີ່ສະແກນຈາກກ້ອງ (ກັນຊ້ຳ, ແຍກບັນທັດລະແຖວ)
  const appendScannedTag = (text) => {
    const tag = String(text || '').trim();
    if (!tag) return;
    setScanTags((prev) => {
      const existing = prev.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      const trimmed = prev.replace(/\s+$/, '');
      return trimmed ? `${trimmed}\n${tag}` : tag;
    });
    setReceiveError('');
  };

  // ກວດ tag ທີ່ສະແກນກັບທະບຽນຊັບສິນ + ລາຍການທີ່ຂໍ (ສະແດງຜົນກ່ອນຢືນຢັນ)
  const scanResults = receiveRequest
    ? scannedTags().map((tag) => {
        if (!Array.isArray(allAssets)) return { tag };
        const a = allAssets.find((x) => (x.assetTag || '').toLowerCase() === tag.toLowerCase());
        if (!a) return { tag, status: 'not-found' };
        const reqNames = (receiveRequest.items || []).map((i) => (i.name || '').toLowerCase()).filter(Boolean);
        const typeOk =
          reqNames.length === 0 ||
          reqNames.some((n) => n.includes((a.type || '').toLowerCase()) || (a.type || '').toLowerCase().includes(n));
        const status = a.status === 'AVAILABLE' && typeOk ? 'ok' : (a.status !== 'AVAILABLE' ? 'not-available' : 'type-mismatch');
        return { tag, status, asset: a };
      })
    : [];

  // ແຜນຮັບເຄື່ອງຕໍ່ລາຍການ: ມີ Asset Tag (ຕ້ອງສະແກນຄົບ) ຫຼື ຂອງສິ້ນເປືອງ (ຕິກ "ໄດ້ຮັບແລ້ວ") + ຊັບສິນວ່າງໃນທະບຽນພໍບໍ
  // (ກົດດຽວກັບ Backend: catalog ທີ່ມີຊັບສິນຜູກຢູ່ = ມີ Asset Tag, ນອກນັ້ນ = ຂອງສິ້ນເປືອງ)
  const assetsKnown = Array.isArray(allAssets);
  const receiveIsDept = isDeptRequest(receiveRequest);
  const reqItems = receiveRequest && Array.isArray(receiveRequest.items) ? receiveRequest.items : [];
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
      const same = reqItems.map((_, k) => k).filter((k) => a.catalogItemId && reqItems[k].catalogItemId === a.catalogItemId);
      let idx;
      if (same.length > 0) idx = same.find((k) => counts[k] < (Number(reqItems[k].quantity) || 0)) ?? same[0];
      else idx = reqItems.findIndex((it) => nameMatch(it.name, a.type));
      if (idx >= 0) counts[idx] += 1;
    });
    return reqItems.map((it, k) => {
      const qty = Number(it.quantity) || 0;
      const linked = assetsKnown && it.catalogItemId
        ? allAssets.filter((a) => a.status !== 'RETIRED' && a.catalogItemId === it.catalogItemId)
        : [];
      const kind = !assetsKnown ? 'unknown' : (linked.length > 0 ? 'asset' : 'consumable');
      const scanned = counts[k];
      const availableAll = assetsKnown
        ? allAssets.filter((a) => a.status === 'AVAILABLE' && ((it.catalogItemId && a.catalogItemId === it.catalogItemId) || nameMatch(it.name, a.type))).length
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
    // ຖ້າສາມາດກວດໃນໜ້າໄດ້ ຕ້ອງຜ່ານທຸກລາຍການກ່ອນ (ບໍ່ພົບ/ບໍ່ວ່າງ/ຊະນິດບໍ່ກົງ) ຈຶ່ງດຳເນີນຕໍ່ໄດ້
    if (Array.isArray(allAssets) && scanResults.some((r) => r.status && r.status !== 'ok')) {
      setReceiveError('ມີລາຍການທີ່ບໍ່ຜ່ານການກວດ (ເບິ່ງສີແດງ) — ໃຫ້ແກ້/ລຶບແຖວນັ້ນກ່ອນ ຈຶ່ງດຳເນີນການຕໍ່ (ເພື່ອບໍ່ມອບເຄື່ອງຜິດ)');
      return;
    }
    setReceiveError('');
    setReceiveStage(2);
  };

  // ບັນທຶກ: Backend ກວດ ໃບຂໍຕ້ອງເປັນ APPROVED, asset ມີຢູ່ + AVAILABLE + ຊະນິດກົງກັບລາຍການ,
  // ຢືນຢັນລະຫັດຜູ້ຮັບ ແລ້ວຜູກ asset ກັບຜູ້ຮັບ + ອັບທະບຽນຊັບສິນ ແລະ ຕັ້ງໃບຂໍເປັນ FULFILLED
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

  const renderStatus = (status) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <Clock size={12} /> ລໍຖ້າອະນຸມັດ
          </span>
        );
      case 'APPROVED':
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
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">
                      {req._id}
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
                      {renderStatus(req.status)}
                      {req.status === 'APPROVED' && hasPermission('supplies', 'fulfill') && (
                        <button
                          onClick={() => openReceive(req)}
                          title="ສະແກນເຄື່ອງ — ຮັບເຄື່ອງທີ່ຄັງ ແລະ ຜູກເຂົ້າທະບຽນຊັບສິນ"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition"
                        >
                          <ScanLine size={13} /> ສະແກນເຄື່ອງ
                        </button>
                      )}
                      {req.status === 'APPROVED' && (
                        <Link
                          to={`/supplies/receipt/${req._id}`}
                          title="ເປີດໃບຮັບເຄື່ອງ — ສະແກນ/ພິມ QR ເພື່ອຢືນຢັນຮັບເຄື່ອງທັງໃບ"
                          className="mt-1.5 ml-1.5 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium transition"
                        >
                          <QrCode size={13} /> ໃບຮັບເຄື່ອງ
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີຄຳຂໍອຸປະກອນໃນລະບົບ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">ສ້າງຄຳຂໍເບີກອຸປະກອນ</h2>
                <button type="button" onClick={() => { setIsModalOpen(false); setSubmitError(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestFor('PERSON')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        requestFor === 'PERSON'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      ຂໍສ່ວນຕົວ
                    </button>
                    <button
                      type="button"
                      disabled={!myDepartmentId}
                      onClick={chooseDepartmentRequest}
                      title={!myDepartmentId ? 'ບັນຊີຍັງບໍ່ໄດ້ຜູກກັບແຜນກ' : undefined}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-40 ${
                        requestFor === 'DEPARTMENT'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      ຂໍໃນນາມແຜນກ
                    </button>
                  </div>
                  {requestFor === 'DEPARTMENT' && (
                    <>
                      <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                        ແຜນກ: <b>{myDepartmentName}</b> — ຊັບສິນທີ່ໄດ້ຮັບຈະຂຶ້ນກັບແຜນກ ແລະ ມອບໃຫ້ຜູ້ຮັບຜິດຊອບທີ່ລະບຸ
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ລະຫັດພະນັກງານຜູ້ຮັບຜິດຊອບ *</label>
                        <input
                          type="text"
                          required
                          value={custodianCode}
                          onChange={(e) => setCustodianCode(e.target.value)}
                          placeholder="ລະຫັດພະນັກງານ..."
                          className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white tracking-widest"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          ຕ້ອງເປັນສະມາຊິກ ຫຼື ຫົວໜ້າຂອງແຜນກນີ້ — ຄ່າເລີ່ມຕົ້ນແມ່ນລະຫັດຂອງທ່ານ
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ລາຍການສິນຄ້າທີ່ຕ້ອງການ</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-xs text-blue-600 font-medium hover:underline">
                        {pickerOpen ? 'ປິດການເລືອກຈາກ Catalog' : '☑ ເລືອກຫຼາຍລາຍການຈາກ Catalog'}
                      </button>
                      <button type="button" onClick={handleAddItem} className="text-xs text-amber-600 font-medium hover:underline">+ ເພີ່ມລາຍການອື່ນ</button>
                    </div>
                  </div>

                  {pickerOpen && (
                    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 space-y-2">
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="ຄົ້ນຫາຊື່ ຫຼື ໝວດໝູ່..."
                        className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                      />
                      <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 bg-white rounded-lg border border-gray-100">
                        {(Array.isArray(catalog) ? catalog : [])
                          .filter((c) => c.isActive !== false)
                          .filter((c) => {
                            const q = pickerSearch.trim().toLowerCase();
                            return !q || `${c.name} ${c.category || ''}`.toLowerCase().includes(q);
                          })
                          .map((c) => {
                            const checked = !!pickerSelected[c._id];
                            const stock = c.stockQty ?? 0;
                            return (
                              <div key={c._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <input type="checkbox" checked={checked} onChange={() => togglePicked(c._id)} className="rounded" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-800 truncate">{c.name}</div>
                                  <div className="text-[11px] text-gray-500">{c.category || '—'} · ຄົງເຫຼືອ {stock} {c.unit || ''}</div>
                                </div>
                                {checked && (
                                  <input
                                    type="number"
                                    min="1"
                                    value={pickerSelected[c._id]}
                                    onChange={(e) => setPickedQty(c._id, e.target.value)}
                                    className="w-20 border border-gray-200 rounded-lg p-1.5 text-sm"
                                  />
                                )}
                              </div>
                            );
                          })}
                        {(!Array.isArray(catalog) || catalog.length === 0) && (
                          <div className="p-3 text-xs text-gray-400 text-center">ຍັງບໍ່ມີລາຍການໃນ Catalog</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">ເລືອກແລ້ວ {Object.keys(pickerSelected).length} ລາຍການ</span>
                        <button
                          type="button"
                          onClick={addPickedToRequest}
                          disabled={Object.keys(pickerSelected).length === 0}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          ເພີ່ມເຂົ້າໃບຂໍ
                        </button>
                      </div>
                    </div>
                  )}

                  {items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 relative">
                      {items.length > 1 && (
                        <button type="button" onClick={() => handleRemoveItem(index)} className="absolute top-3 right-3 text-rose-500 text-xs font-bold hover:underline">ລຶບ</button>
                      )}
                      
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ຄົ້ນຫາ ແລະ ເລືອກຈາກ Catalog (ທາງເລືອກ)</label>
                        <input
                          type="text"
                          list={`catalog-options-${index}`}
                          value={item.catalogSearch ?? ''}
                          onChange={(e) => handleCatalogSearchChange(index, e.target.value)}
                          placeholder="ພິມຄົ້ນຫາຊື່ອຸປະກອນ... ຫຼື ພິມຊື່ເອງຂ້າງລຸ່ມ"
                          className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                        />
                        <datalist id={`catalog-options-${index}`}>
                          {Array.isArray(catalog) && catalog.map(cat => (
                            <option key={cat._id} value={cat.name}>{`ຄົງເຫຼືອ: ${cat.stockQty ?? 0}`}</option>
                          ))}
                        </datalist>
                        {item.catalogItemId && (
                          <p className="text-xs text-green-600 mt-1">✓ ເລືອກແລ້ວ: {item.name} (ລະຫັດ {item.catalogItemId})</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">ຊື່ອຸປະກອນ *</label>
                          <input 
                            type="text" 
                            required
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="ຕົວຢ່າງ: ບີກສີຟ້າ, ເຈ້ຍ A4"
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">ຈຳນວນ *</label>
                          <input 
                            type="number" 
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                          />
                          {item.catalogItemId && (() => {
                            const cat = catalogById(item.catalogItemId);
                            if (!cat) return null;
                            const stock = cat.stockQty ?? 0;
                            const over = (parseInt(item.quantity, 10) || 0) > stock;
                            return (
                              <p className={`text-[11px] mt-1 ${over ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                {over ? `⚠ ເກີນສະຕ໊ອກ (ມີ ${stock} ${cat.unit || ''})` : `ຄົງເຫຼືອ ${stock} ${cat.unit || ''}`}
                              </p>
                            );
                          })()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ເຫດຜົນການຂໍເບີກ</label>
                        <input 
                          type="text" 
                          value={item.reason}
                          onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                          placeholder="ຕົວຢ່າງ: ເຄື່ອງເກົ່າໝົດ, ໃຊ້ງານໂຄງການໃໝ່"
                          className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {overStockCount > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ມີ {overStockCount} ລາຍການທີ່ຂໍເກີນສະຕ໊ອກປັດຈຸບັນ — ສົ່ງໄດ້ ແຕ່ເຈົ້າໜ້າທີ່ສາງອາດຈ່າຍບໍ່ຄົບຈົນກວ່າຂອງຈະເຂົ້າສາງ
                  </div>
                )}
                {submitError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
                )}
                <div className="text-xs text-gray-500">ລວມ {items.filter((it) => !isBlankRow(it)).length} ລາຍການ</div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => { setIsModalOpen(false); setSubmitError(''); }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                  >
                    ຍົກເລີກ
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition shadow-sm"
                  >
                    ສົ່ງຄຳຂໍ
                  </button>
                </div>
              </form>
            </div>
          </div>
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
                      <input
                        required={!receiveIsDept}
                        value={assigneeCode}
                        onChange={(e) => setAssigneeCode(e.target.value)}
                        placeholder="ລະຫັດພະນັກງານ..."
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm tracking-widest"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {receiveIsDept
                          ? `ເວັ້ນວ່າງ = ຜູ້ຮັບຜິດຊອບຂອງແຜນກ (${refName(receiveRequest.custodianId)}) — ຜູ້ຮັບແທນຕ້ອງເປັນສະມາຊິກ ຫຼື ຫົວໜ້າແຜນກ`
                          : 'ຄ່າເລີ່ມຕົ້ນ = ຜູ້ຂໍຂອງຄຳຂໍນີ້ — ແກ້ໄດ້ຖ້າໃຫ້ຄົນອື່ນຮັບ (ຖ້າບໍ່ມີສິດ assets:assign Backend ຈະປະຕິເສດ)'}
                      </p>
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