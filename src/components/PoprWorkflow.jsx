import { useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Search, Trash2, Check, ChevronLeft, ChevronRight, Info, Pencil,
  ClipboardList, PackageCheck, Settings2, Send,
} from 'lucide-react';
import { POPR_STEPS, POPR_STATUS, POPR_ORDER_STATUS, POPR_DELIVERY_STATUS, POPR_ITEM_TYPE } from '../constants/poprSteps';
import { getCurrentUser, hasPermission } from '../utils/permissions';
import api from '../services/api';

const STEP_ICONS = [ClipboardList, PackageCheck, Settings2, Send];

const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);

const emptyForm = () => ({
  itemType: 'ELECTRONIC',
  // 1) P — ການຈັດຫາ/ຈັດຊື້
  catalogItemId: '',
  itemName: '',
  quantity: 1,
  spec: '',
  budget: '',
  price: '',
  vendor: '',
  vendorStandard: false,
  warrantyAgreement: false,
  poNumber: '',
  goodsReceiptNo: '',
  orderStatus: 'PENDING',
  // 2) O — ການຮັບເຂົ້າ/ຕ້ອນຮັບ
  receivedDate: '',
  deliveryStatus: 'SHIPPING',
  boxCondition: 'good',
  equipmentCondition: 'good',
  serialNumber: '',
  snMatch: false,
  assetTag: '',
  assetId: '',
  assetRegistered: false,
  receivedBy: '',
  receivedByUserId: '',
  custodian: '',
  location: '',
  // 3) P — ການຕຽມ/ກຳນົດຄ່າ
  os: '',
  software: '',
  secAntivirus: false,
  secEdr: false,
  secFirewall: false,
  domainJoined: false,
  userAccount: '',
  network: '',
  accessRights: '',
  diskEncryption: false,
  securityPolicy: false,
  // 4) R — ການປ່ອຍ/ລົງທະບຽນ
  deliveredTo: '',
  deliveredToUserId: '',
  deliveryDate: '',
  signedHandover: false,
  userOrientation: false,
  assetStatus: 'IN_USE',
  assignedUser: '',
  assignedUserId: '',
});

const BOX_CONDITIONS = [
  { value: 'good', label: 'ສົມບູນດີ' },
  { value: 'damaged', label: 'ມີຄວາມເສຍຫາຍ' },
  { value: 'partial', label: 'ບໍ່ຄົບ / ຂາດອຸປະກອນ' },
];

const ASSET_STATUSES = [
  { value: 'IN_USE', label: 'ກຳລັງໃຊ້ງານ' },
  { value: 'IN_STOCK', label: 'ເກັບສຕັອກ' },
  { value: 'MAINTENANCE', label: 'ກຳລັງສ້ອມ' },
  { value: 'RETIRED', label: 'ປົດລະວາງ' },
];

const day = (v) => (v ? String(v).slice(0, 10) : '');

/** API record (nested) → flat form ຂອງ UI */
function toForm(rec = {}) {
  const p = rec.procurement || {};
  const o = rec.receiving || {};
  const c = rec.preparation || {};
  const r = rec.release || {};
  return {
    itemType: rec.itemType || 'ELECTRONIC',
    catalogItemId: p.catalogItemId || '',
    itemName: p.itemName || '',
    quantity: p.quantity ?? 1,
    spec: p.spec || '',
    budget: p.budget ?? '',
    price: p.price ?? '',
    vendor: p.vendor || '',
    vendorStandard: !!p.vendorStandard,
    warrantyAgreement: !!p.warrantyAgreement,
    poNumber: p.poNumber || '',
    goodsReceiptNo: p.goodsReceiptNo || '',
    orderStatus: p.orderStatus || 'PENDING',
    receivedDate: day(o.receivedDate),
    deliveryStatus: o.deliveryStatus || 'SHIPPING',
    boxCondition: o.boxCondition || 'good',
    equipmentCondition: o.equipmentCondition || 'good',
    serialNumber: o.serialNumber || '',
    snMatch: !!o.snMatch,
    assetTag: o.assetTag || '',
    assetId: o.assetId?._id || o.assetId || '',
    assetRegistered: !!o.assetRegistered,
    receivedBy: o.receivedBy || '',
    receivedByUserId: o.receivedByUserId?._id || o.receivedByUserId || '',
    custodian: o.custodian || '',
    location: o.location || '',
    os: c.os || '',
    software: c.software || '',
    secAntivirus: !!c.secAntivirus,
    secEdr: !!c.secEdr,
    secFirewall: !!c.secFirewall,
    domainJoined: !!c.domainJoined,
    userAccount: c.userAccount || '',
    network: c.network || '',
    accessRights: c.accessRights || '',
    diskEncryption: !!c.diskEncryption,
    securityPolicy: !!c.securityPolicy,
    deliveredTo: r.deliveredTo || '',
    deliveredToUserId: r.deliveredToUserId?._id || r.deliveredToUserId || '',
    deliveryDate: day(r.deliveryDate),
    signedHandover: !!r.signedHandover,
    userOrientation: !!r.userOrientation,
    assetStatus: r.assetStatus || 'IN_USE',
    assignedUser: r.assignedUser || '',
    assignedUserId: r.assignedUserId?._id || r.assignedUserId || '',
  };
}

/** flat form → API payload (nested) */
function toPayload(form, status, stage) {
  const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  return {
    status,
    stage,
    itemType: form.itemType,
    procurement: {
      catalogItemId: form.catalogItemId || undefined,
      itemName: form.itemName,
      quantity: Number(form.quantity) || 1,
      spec: form.spec,
      budget: num(form.budget),
      price: num(form.price),
      vendor: form.vendor,
      vendorStandard: form.vendorStandard,
      warrantyAgreement: form.warrantyAgreement,
      poNumber: form.poNumber,
      goodsReceiptNo: form.goodsReceiptNo || undefined,
      orderStatus: form.orderStatus,
    },
    receiving: {
      receivedDate: form.receivedDate || undefined,
      boxCondition: form.boxCondition,
      equipmentCondition: form.equipmentCondition,
      serialNumber: form.serialNumber || undefined,
      snMatch: form.snMatch,
      assetTag: form.assetTag || undefined,
      assetId: form.assetId || null,
      assetRegistered: form.assetRegistered,
      receivedBy: form.receivedBy || undefined,
      receivedByUserId: form.receivedByUserId || null,
      custodian: form.custodian || undefined,
      location: form.location || undefined,
      deliveryStatus: form.deliveryStatus,
    },
    preparation: {
      os: form.os || undefined,
      software: form.software || undefined,
      secAntivirus: form.secAntivirus,
      secEdr: form.secEdr,
      secFirewall: form.secFirewall,
      domainJoined: form.domainJoined,
      userAccount: form.userAccount || undefined,
      network: form.network || undefined,
      accessRights: form.accessRights || undefined,
      diskEncryption: form.diskEncryption,
      securityPolicy: form.securityPolicy,
    },
    release: {
      deliveredTo: form.deliveredTo || undefined,
      deliveredToUserId: form.deliveredToUserId || null,
      assignedUser: form.assignedUser || undefined,
      assignedUserId: form.assignedUserId || null,
      deliveryDate: form.deliveryDate || undefined,
      assetStatus: form.assetStatus,
      signedHandover: form.signedHandover,
      userOrientation: form.userOrientation,
    },
  };
}

function creatorName(user) {
  if (!user) return '';
  if (typeof user === 'string') return user;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || user.employeeCode || '';
}

/** API record → shape ທີ່ UI ໃຊ້ (form flat + meta) */
function normalize(rec) {
  return {
    _id: rec._id,
    status: rec.status,
    itemType: rec.itemType || 'ELECTRONIC',
    stage: rec.stage,
    createdAt: rec.createdAt,
    createdBy: creatorName(rec.createdBy),
    form: toForm(rec),
  };
}

const apiErr = (err, fallback) =>
  err.response?.data?.msg || err.response?.data?.message || fallback;

function validateStep(step, form) {
  const err = {};
  if (step === 0) {
    if (!form.itemName.trim()) err.itemName = 'ກະລຸນາລະບຸຊື່/ລາຍການອຸປະກອນ';
    if (!(Number(form.quantity) >= 1)) err.quantity = 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1';
    if (!form.spec.trim()) err.spec = 'ກະລຸນາລະບຸຂໍ້ກຳນົດ/ຂໍ້ມູນຈຳເພາະ';
    if (form.budget === '' || Number(form.budget) < 0) err.budget = 'ກະລຸນາລະບຸງົບປະມານ';
    if (!form.vendor.trim()) err.vendor = 'ກະລຸນາລະບຸຜູ້ຂາຍ';
    if (!form.poNumber.trim()) err.poNumber = 'ກະລຸນາລະບຸເລກໃບສັ່ງຊື້ (PO)';
  }
  if (step === 1) {
    const isGeneral = form.itemType === 'GENERAL';
    if (!form.receivedDate) err.receivedDate = 'ກະລຸນາລະບຸວັນທີຮັບ';
    if (!form.assetTag.trim()) err.assetTag = 'ກະລຸນາລະບຸ Asset Tag / ບາໂຄດ';
    if (!isGeneral) {
      if (!form.serialNumber.trim()) err.serialNumber = 'ກະລຸນາລະບຸ Serial Number (S/N)';
      if (!form.snMatch) err.snMatch = 'ຕ້ອງຢືນຢັນວ່າ S/N ກົງກັບເອກະສານ';
    }
  }
  if (step === 2 && form.itemType !== 'GENERAL') {
    if (!form.os.trim()) err.os = 'ກະລຸນາລະບຸລະບົບປະຕິບັດການ (OS)';
    if (!form.secAntivirus && !form.secEdr && !form.secFirewall) {
      err.security = 'ເລືອກຢ່າງໜ້ອຍ 1 ຊອບແວຄວາມປອດໄພ';
    }
  }
  if (step === 3) {
    if (!form.deliveredTo.trim()) err.deliveredTo = 'ກະລຸນາລະບຸຜູ້ຮັບມອບ/ພະແນກ';
    if (!form.assignedUser.trim()) err.assignedUser = 'ກະລຸນາລະບຸຊື່ຜູ້ໃຊ້ທີ່ມອບໃຫ້';
    if (!form.signedHandover) err.signedHandover = 'ຕ້ອງຢືນຢັນການລົງນາມຮັບມອບ';
  }
  return err;
}

function Field({ label, required, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300"
      />
      <span>{children}</span>
    </label>
  );
}

/** ຄົ້ນຊັບສິນໃນທະບຽນດ້ວຍ Asset Tag / _id → ຜູກ assetId (additive) */
function AssetCodeLookup({ onResolved, linkedLabel }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.get(`/popr-records/lookup/asset/${encodeURIComponent(c)}`);
      const a = unwrap(res.data);
      onResolved({ assetId: a._id, assetTag: a.assetTag });
      setCode('');
    } catch (err) {
      setError(apiErr(err, 'ບໍ່ພົບຊັບສິນນີ້ໃນທະບຽນ'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } }}
        placeholder="Asset Tag ຫຼື AS001"
        className="w-52 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
      />
      <button
        type="button"
        onClick={run}
        disabled={busy || !code.trim()}
        className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
      >
        {busy ? '...' : 'ຜູກກັບທະບຽນ'}
      </button>
      {linkedLabel && <span className="text-xs text-emerald-600">ຜູກແລ້ວ: {linkedLabel}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

/** ຄົ້ນພະນັກງານດ້ວຍລະຫັດ → ຜູກ userId (additive) */
function EmployeeCodeLookup({ onResolved, linkedLabel }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.get(`/popr-records/lookup/employee/${encodeURIComponent(c)}`);
      const u = unwrap(res.data);
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      onResolved({ userId: u._id, name: name || u.employeeCode });
      setCode('');
    } catch (err) {
      setError(apiErr(err, 'ບໍ່ພົບລະຫັດພະນັກງານນີ້'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } }}
        placeholder="ລະຫັດພະນັກງານ"
        className="w-52 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
      />
      <button
        type="button"
        onClick={run}
        disabled={busy || !code.trim()}
        className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
      >
        {busy ? '...' : 'ຄົ້ນຫາ'}
      </button>
      {linkedLabel && <span className="text-xs text-emerald-600">ຜູກແລ້ວ: {linkedLabel}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export default function PoprWorkflow({ catalog = [], canManage = false }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [detail, setDetail] = useState(null);

  const currentUser = getCurrentUser();
  const operatorName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || ''
    : '';
  // ການປິດສຳເລັດ ແລະ ການລຶບ ເປັນສິດແຍກຕ່າງຫາກ (approve / delete) ບໍ່ໃຊ້ manage ດຽວ
  const canApprove = hasPermission('supplies', 'approve');
  const canDelete = hasPermission('supplies', 'delete');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/popr-records');
      const list = unwrap(res.data) || [];
      setRecords(Array.isArray(list) ? list.map(normalize) : []);
    } catch (err) {
      setLoadError(apiErr(err, 'ບໍ່ສາມາດໂຫຼດບັນທຶກ POPR ໄດ້'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
  }, []);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      receivedBy: operatorName,
      receivedDate: new Date().toISOString().slice(0, 10),
      deliveryDate: new Date().toISOString().slice(0, 10),
    });
    setStep(0);
    setErrors({});
    setSubmitError('');
    setIsOpen(true);
  };

  const openEdit = (record) => {
    setEditingId(record._id);
    setForm(record.form);
    setStep(Math.max(0, Math.min(3, (record.stage || 1) - 1)));
    setErrors({});
    setSubmitError('');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingId(null);
  };

  const handleCatalogChange = (value) => {
    const clean = value.trim().toLowerCase();
    const matched = catalog.find(
      (c) => (c.name || '').toLowerCase() === clean || (c._id || '').toLowerCase() === clean,
    );
    set({ itemName: value, catalogItemId: matched ? matched._id : '' });
  };

  const goNext = () => {
    const err = validateStep(step, form);
    if (Object.keys(err).length > 0) {
      setErrors(err);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, POPR_STEPS.length - 1));
  };

  const goPrev = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const persist = async (status) => {
    setSaving(true);
    setSubmitError('');
    const stage = status === 'COMPLETED' ? POPR_STEPS.length : step + 1;
    const payload = toPayload(form, status, stage);
    try {
      if (editingId) {
        await api.patch(`/popr-records/${editingId}`, payload);
      } else {
        await api.post('/popr-records', payload);
      }
      setIsOpen(false);
      setEditingId(null);
      await fetchRecords();
    } catch (err) {
      setSubmitError(apiErr(err, 'ບັນທຶກບໍ່ສຳເລັດ'));
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => persist(step === 0 ? 'DRAFT' : 'IN_PROGRESS');

  const submitAll = () => {
    for (let i = 0; i < POPR_STEPS.length; i += 1) {
      const err = validateStep(i, form);
      if (Object.keys(err).length > 0) {
        setStep(i);
        setErrors(err);
        return;
      }
    }
    setErrors({});
    persist('COMPLETED');
  };

  const removeRecord = async (id) => {
    if (!window.confirm('ລຶບບັນທຶກ POPR ນີ້?')) return;
    try {
      await api.delete(`/popr-records/${id}`);
      if (detail?._id === id) setDetail(null);
      await fetchRecords();
    } catch (err) {
      alert(apiErr(err, 'ລຶບບໍ່ສຳເລັດ'));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      const f = r.form || {};
      return [r._id, f.itemName, f.vendor, f.poNumber, f.serialNumber, f.assetTag, f.assignedUser]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [records, search, statusFilter]);

  const completedCount = records.filter((r) => r.status === 'COMPLETED').length;

  const stepContent = () => {
    const isGeneral = form.itemType === 'GENERAL';
    if (step === 0) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="ລາຍການອຸປະກອນ" required error={errors.itemName} className="sm:col-span-2">
              <input
                type="text"
                list="popr-catalog-options"
                value={form.itemName}
                onChange={(e) => handleCatalogChange(e.target.value)}
                placeholder="ເລືອກຈາກ Catalog ຫຼື ພິມຊື່ໃໝ່"
                className={inputCls}
              />
            </Field>
            <Field label="ຈຳນວນ" required error={errors.quantity}>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="ຂໍ້ກຳນົດ / ຂໍ້ມູນຈຳເພາະ" required error={errors.spec}>
            <textarea
              rows={2}
              value={form.spec}
              onChange={(e) => set({ spec: e.target.value })}
              placeholder="ຢົກຕົວຢ່າງ: CPU i5, RAM 16GB, SSD 512GB, ປະກັນ 3 ປີ"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ງົບປະມານ (ກີບ)" required error={errors.budget}>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={(e) => set({ budget: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="ລາຄາຕົວຈິງ (ກີບ)">
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="ຜູ້ຂາຍ / ຜູ້ສະໜອງ" required error={errors.vendor}>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => set({ vendor: e.target.value })}
              placeholder="ຊື່ບໍລິສັດ ຫຼື ຮ້ານສະໜອງ"
              className={inputCls}
            />
          </Field>
          <div className="flex flex-wrap gap-5">
            <Toggle checked={form.vendorStandard} onChange={(v) => set({ vendorStandard: v })}>
              ຜູ້ຂາຍຕົງມາດຕະຖານ
            </Toggle>
            <Toggle checked={form.warrantyAgreement} onChange={(v) => set({ warrantyAgreement: v })}>
              ມີຂໍ້ຕົກລົງຮັບປະກັນ
            </Toggle>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ເລກໃບສັ່ງຊື້ (PO)" required error={errors.poNumber}>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => set({ poNumber: e.target.value })}
                placeholder="PO-2026-0001"
                className={inputCls}
              />
            </Field>
            <Field label="ເລກໃບຮັບ/ໃບສົ່ງສິນຄ້າ">
              <input
                type="text"
                value={form.goodsReceiptNo}
                onChange={(e) => set({ goodsReceiptNo: e.target.value })}
                placeholder="GRN-0001 / DN-0001"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="ສະຖານະການສັ່ງຊື້" error={errors.orderStatus}>
            <select
              value={form.orderStatus}
              onChange={(e) => set({ orderStatus: e.target.value })}
              className={inputCls}
            >
              {Object.entries(POPR_ORDER_STATUS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="ວັນທີຮັບ" required error={errors.receivedDate}>
              <input
                type="date"
                value={form.receivedDate}
                onChange={(e) => set({ receivedDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="ສະພາບກ່ອງ/ຫີບ">
              <select value={form.boxCondition} onChange={(e) => set({ boxCondition: e.target.value })} className={inputCls}>
                {BOX_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ສະພາບອຸປະກອນຕົວຈິງ">
              <select value={form.equipmentCondition} onChange={(e) => set({ equipmentCondition: e.target.value })} className={inputCls}>
                {BOX_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ສະຖານະການສົ່ງ/ກວດຮັບ">
              <select value={form.deliveryStatus} onChange={(e) => set({ deliveryStatus: e.target.value })} className={inputCls}>
                {Object.entries(POPR_DELIVERY_STATUS).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isGeneral && (
              <Field label="Serial Number (S/N)" required error={errors.serialNumber}>
                <input
                  type="text"
                  value={form.serialNumber}
                  onChange={(e) => set({ serialNumber: e.target.value })}
                  placeholder="S/N ຂອງເຄື່ອງ"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Asset Tag / ບາໂຄດສິນຊັບ" required error={errors.assetTag}>
              <input
                type="text"
                value={form.assetTag}
                onChange={(e) => set({ assetTag: e.target.value, assetId: '' })}
                placeholder="SC002-001"
                className={inputCls}
              />
              <AssetCodeLookup
                onResolved={(a) => set({ assetId: a.assetId, assetTag: a.assetTag })}
                linkedLabel={form.assetId ? form.assetTag : ''}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5">
            {!isGeneral && (
              <Toggle checked={form.snMatch} onChange={(v) => set({ snMatch: v })}>
                S/N ກົງກັບເອກະສານ
              </Toggle>
            )}
            <Toggle checked={form.assetRegistered} onChange={(v) => set({ assetRegistered: v })}>
              ລົງທະບຽນໃນລະບົບຈັດການສິນຊັບແລ້ວ
            </Toggle>
          </div>
          {errors.snMatch && <p className="text-xs text-red-500">{errors.snMatch}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="ຜູ້ຮັບເຄື່ອງ">
              <input
                type="text"
                value={form.receivedBy}
                onChange={(e) => set({ receivedBy: e.target.value, receivedByUserId: '' })}
                className={inputCls}
              />
              <EmployeeCodeLookup
                onResolved={(u) => set({ receivedBy: u.name, receivedByUserId: u.userId })}
                linkedLabel={form.receivedByUserId ? form.receivedBy : ''}
              />
            </Field>
            <Field label="ຜູ້ດູແລ/ຜູ້ຄຸ້ມຄອງ">
              <input type="text" value={form.custodian} onChange={(e) => set({ custodian: e.target.value })} className={inputCls} />
            </Field>
            <Field label="ສະຖານທີ່">
              <input
                type="text"
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="ຫ້ອງ / ສາຂາ"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      );
    }

    if (step === 2) {
      if (isGeneral) {
        return (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            ອຸປະກອນທົ່ວໄປ ບໍ່ຈຳເປັນຕ້ອງຕິດຕັ້ງ OS ຫຼື ຊອບແວຄວາມປອດໄພ — ກົດ "ຕໍ່ໄປ" ໄດ້ເລີຍ.
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ລະບົບປະຕິບັດການ (OS)" required error={errors.os}>
              <input
                type="text"
                value={form.os}
                onChange={(e) => set({ os: e.target.value })}
                placeholder="Windows 11 Pro / Ubuntu 24.04"
                className={inputCls}
              />
            </Field>
            <Field label="ຊອບແວຈຳເປັນ">
              <input
                type="text"
                value={form.software}
                onChange={(e) => set({ software: e.target.value })}
                placeholder="Office, VPN, ໂປຣແກຣມວິຊາຊີບ"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="ຊອບແວຄວາມປອດໄພ" required error={errors.security}>
            <div className="flex flex-wrap gap-5 pt-1">
              <Toggle checked={form.secAntivirus} onChange={(v) => set({ secAntivirus: v })}>Antivirus</Toggle>
              <Toggle checked={form.secEdr} onChange={(v) => set({ secEdr: v })}>EDR</Toggle>
              <Toggle checked={form.secFirewall} onChange={(v) => set({ secFirewall: v })}>Firewall</Toggle>
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ບັນຊີຜູ້ໃຊ້">
              <input
                type="text"
                value={form.userAccount}
                onChange={(e) => set({ userAccount: e.target.value })}
                placeholder="username / ອີເມວ"
                className={inputCls}
              />
            </Field>
            <Field label="ເຄືອຂ່າຍ (VLAN / Wi-Fi)">
              <input
                type="text"
                value={form.network}
                onChange={(e) => set({ network: e.target.value })}
                placeholder="VLAN-10 / WIFI-OFFICE"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="ສິດເຂົ້າເຖິງຂໍ້ມູນ">
            <input
              type="text"
              value={form.accessRights}
              onChange={(e) => set({ accessRights: e.target.value })}
              placeholder="Shared Drive, ERP, ແຟ້ມຂໍ້ມູນ..."
              className={inputCls}
            />
          </Field>
          <div className="flex flex-wrap gap-5">
            <Toggle checked={form.domainJoined} onChange={(v) => set({ domainJoined: v })}>
              ເຊື່ອມກັບ Active Directory / Domain
            </Toggle>
            <Toggle checked={form.diskEncryption} onChange={(v) => set({ diskEncryption: v })}>
              ເປີດເຂົ້າລະຫັດດິສ (BitLocker)
            </Toggle>
            <Toggle checked={form.securityPolicy} onChange={(v) => set({ securityPolicy: v })}>
              ຕັ້ງຄ່າຄວາມປອດໄພຕາມນະໂຍບາຍອົງກອນ
            </Toggle>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="ສົ່ງມອບໃຫ້ (ພະນັກງານ/ພະແນກ)" required error={errors.deliveredTo}>
            <input
              type="text"
              value={form.deliveredTo}
              onChange={(e) => set({ deliveredTo: e.target.value, deliveredToUserId: '' })}
              className={inputCls}
            />
            <EmployeeCodeLookup
              onResolved={(u) => set({ deliveredTo: u.name, deliveredToUserId: u.userId })}
              linkedLabel={form.deliveredToUserId ? form.deliveredTo : ''}
            />
          </Field>
          <Field label="ຊື່ຜູ້ໃຊ້ທີ່ມອບໃຫ້" required error={errors.assignedUser}>
            <input
              type="text"
              value={form.assignedUser}
              onChange={(e) => set({ assignedUser: e.target.value, assignedUserId: '' })}
              className={inputCls}
            />
            <EmployeeCodeLookup
              onResolved={(u) => set({ assignedUser: u.name, assignedUserId: u.userId })}
              linkedLabel={form.assignedUserId ? form.assignedUser : ''}
            />
          </Field>
          <Field label="ວັນທີສົ່ງມອບ">
            <input type="date" value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="ສະຖານະສິນຊັບຫຼັງມອບ">
          <select value={form.assetStatus} onChange={(e) => set({ assetStatus: e.target.value })} className={inputCls}>
            {ASSET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-5">
          <Toggle checked={form.signedHandover} onChange={(v) => set({ signedHandover: v })}>
            ຜູ້ຮັບລົງນາມເອກະສານຮັບມອບ
          </Toggle>
          <Toggle checked={form.userOrientation} onChange={(v) => set({ userOrientation: v })}>
            ແນະນຳການໃຊ້ / ຄວາມປອດໄພ / ຊ່ອງທາງແຈ້ງບັນຫາ IT
          </Toggle>
        </div>
        {errors.signedHandover && <p className="text-xs text-red-500">{errors.signedHandover}</p>}

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">ສະຫຼຸບການຕັ້ງຄ່າ</p>
          <p>ລາຍການ: {form.itemName || '—'} (x{form.quantity})</p>
          <p>ຜູ້ຂາຍ: {form.vendor || '—'} · PO: {form.poNumber || '—'}</p>
          <p>S/N: {form.serialNumber || '—'} · Asset Tag: {form.assetTag || '—'}</p>
          <p>OS: {form.os || '—'} · AD: {form.domainJoined ? 'ເຊື່ອມແລ້ວ' : 'ຍັງ'} · BitLocker: {form.diskEncryption ? 'ເປີດ' : 'ຍັງ'}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          ຂະບວນການ POPR: <b>P</b> ຈັດຫາ/ຈັດຊື້ → <b>O</b> ຮັບເຂົ້າ → <b>P</b> ຕຽມ/ກຳນົດຄ່າ → <b>R</b> ປ່ອຍ/ລົງທະບຽນ.
          ບັນທຶກຜ່ານ API <code>/api/popr-records</code> ແລ້ວ.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-800">ບັນທຶກ POPR</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {records.length} ລາຍການ · ສຳເລັດ {completedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ຄົ້ນຫາ ລາຍການ / PO / S/N / Tag..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-full sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">ທຸກສະຖານະ</option>
              {Object.entries(POPR_STATUS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
            {canManage && (
              <button
                onClick={openCreate}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm shrink-0"
              >
                <Plus size={18} /> <span>ເພີ່ມລາຍການໃໝ່</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ລະຫັດ</th>
                <th className="p-4 font-medium">ລາຍການ</th>
                <th className="p-4 font-medium">ຜູ້ຂາຍ</th>
                <th className="p-4 font-medium">ເລກ PO</th>
                <th className="p-4 font-medium">S/N</th>
                <th className="p-4 font-medium">Asset Tag</th>
                <th className="p-4 font-medium">ໄລຍະ</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
                <th className="p-4 font-medium text-center">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-sm text-red-500 px-4">⚠️ {loadError}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-sm text-gray-400">
                    {records.length === 0 ? 'ຍັງບໍ່ມີບັນທຶກ POPR' : 'ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const s = POPR_STATUS[r.status] || POPR_STATUS.DRAFT;
                  const f = r.form || {};
                  return (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="p-4 font-semibold text-gray-900">{r._id}</td>
                      <td className="p-4 font-medium text-gray-800">{f.itemName || '—'}{Number(f.quantity) > 1 ? ` (x${f.quantity})` : ''}</td>
                      <td className="p-4">{f.vendor || '—'}</td>
                      <td className="p-4">{f.poNumber || '—'}</td>
                      <td className="p-4">{f.serialNumber || '—'}</td>
                      <td className="p-4">{f.assetTag || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {POPR_STEPS.map((st, i) => (
                            <span
                              key={st.key}
                              title={st.label}
                              className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                i < (r.stage || 0) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {st.code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDetail(r)}
                            className="text-xs px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
                          >
                            ເບິ່ງ
                          </button>
                          {canManage && r.status !== 'COMPLETED' && (
                            <button
                              onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                              title="ແກ້ໄຂ"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => removeRecord(r._id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              title="ລຶບ"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="popr-catalog-options">
        {catalog.map((c) => (
          <option key={c._id} value={c.name}>{c._id} — {c.category}</option>
        ))}
      </datalist>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                {editingId ? `ແກ້ໄຂບັນທຶກ ${editingId}` : 'ເພີ່ມລາຍການອຸປະກອນໃໝ່ — POPR'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              {POPR_STEPS.map((st, idx) => {
                const Icon = STEP_ICONS[idx];
                const isDone = idx < step;
                const isCurrent = idx === step;
                return (
                  <div key={st.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                              ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isDone ? <Check size={18} /> : <Icon size={18} />}
                      </div>
                      <span className={`text-[11px] mt-1 whitespace-nowrap ${isCurrent ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                        {st.code} · {st.label}
                      </span>
                    </div>
                    {idx < POPR_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 mb-5 ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-xs text-gray-500 mb-4">{POPR_STEPS[step].desc}</p>
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                  {submitError}
                </div>
              )}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">ປະເພດອຸປະກອນ</label>
                <select
                  value={form.itemType}
                  onChange={(e) => set({ itemType: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                >
                  {Object.entries(POPR_ITEM_TYPE).map(([key, t]) => (
                    <option key={key} value={key}>{t.label}</option>
                  ))}
                </select>
              </div>
              {stepContent()}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} /> ກ່ອນໜ້າ
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saving || !form.itemName.trim()}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
                >
                  {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຮ່າງ'}
                </button>
                {step < POPR_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={saving}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    ຕໍ່ໄປ <ChevronRight size={16} />
                  </button>
                ) : canApprove ? (
                  <button
                    type="button"
                    onClick={submitAll}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check size={16} /> {saving ? 'ກຳລັງບັນທຶກ...' : 'ສຳເລັດ'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 max-w-[16rem] text-right">
                    ບັນທຶກເປັນຮ່າງໄດ້ — ການປິດສຳເລັດຕ້ອງມີສິດອະນຸມັດ (supplies:approve)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{detail._id}</h3>
                <p className="text-xs text-gray-500">
                  {(POPR_ITEM_TYPE[detail.itemType] || POPR_ITEM_TYPE.ELECTRONIC).label} ·{' '}
                  {(POPR_STATUS[detail.status] || POPR_STATUS.DRAFT).label} · ສ້າງໂດຍ {detail.createdBy || '—'} ·{' '}
                  {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-700 space-y-4">
              {POPR_STEPS.map((st, idx) => {
                const f = detail.form || {};
                const rows = [
                  [
                    ['ລາຍການ', f.itemName], ['ຈຳນວນ', f.quantity],
                    ['ຂໍ້ກຳນົດ', f.spec], ['ງົບປະມານ', f.budget], ['ລາຄາ', f.price],
                    ['ຜູ້ຂາຍ', f.vendor], ['ຕົງມາດຕະຖານ', f.vendorStandard ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ຮັບປະກັນ', f.warrantyAgreement ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ເລກ PO', f.poNumber], ['ເລກໃບຮັບ', f.goodsReceiptNo],
                    ['ສະຖານະສັ່ງຊື້', (POPR_ORDER_STATUS[f.orderStatus] || {}).label],
                  ],
                  [
                    ['ວັນທີຮັບ', f.receivedDate], ['ສະພາບກ່ອງ', f.boxCondition],
                    ['ສະພາບອຸປະກອນ', f.equipmentCondition], ['S/N', f.serialNumber],
                    ['S/N ກົງ', f.snMatch ? 'ແມ່ນ' : 'ບໍ່'], ['Asset Tag', f.assetTag],
                    ['ຜູກທະບຽນຊັບສິນ', f.assetId ? 'ຜູກແລ້ວ' : 'ບໍ່'], ['ລົງທະບຽນ', f.assetRegistered ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ຜູ້ຮັບ', f.receivedBy], ['ຜູ້ຮັບ (ບັນຊີ)', f.receivedByUserId ? 'ຜູກແລ້ວ' : 'ບໍ່'],
                    ['ຜູ້ດູແລ', f.custodian], ['ສະຖານທີ່', f.location],
                    ['ສະຖານະສົ່ງຮັບ', (POPR_DELIVERY_STATUS[f.deliveryStatus] || {}).label],
                  ],
                  [
                    ['OS', f.os], ['ຊອບແວ', f.software],
                    ['Antivirus', f.secAntivirus ? 'ແມ່ນ' : 'ບໍ່'], ['EDR', f.secEdr ? 'ແມ່ນ' : 'ບໍ່'],
                    ['Firewall', f.secFirewall ? 'ແມ່ນ' : 'ບໍ່'], ['AD', f.domainJoined ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ບັນຊີ', f.userAccount], ['ເຄືອຂ່າຍ', f.network], ['ສິດເຂົ້າເຖິງ', f.accessRights],
                    ['BitLocker', f.diskEncryption ? 'ແມ່ນ' : 'ບໍ່'], ['ນະໂຍບາຍ', f.securityPolicy ? 'ແມ່ນ' : 'ບໍ່'],
                  ],
                  [
                    ['ສົ່ງໃຫ້', f.deliveredTo], ['ຜູ້ມອບ (ບັນຊີ)', f.deliveredToUserId ? 'ຜູກແລ້ວ' : 'ບໍ່'],
                    ['ຜູ້ໃຊ້', f.assignedUser], ['ຜູ້ໃຊ້ (ບັນຊີ)', f.assignedUserId ? 'ຜູກແລ້ວ' : 'ບໍ່'],
                    ['ວັນມອບ', f.deliveryDate],
                    ['ສະຖານະ', f.assetStatus], ['ລົງນາມ', f.signedHandover ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ແນະນຳ', f.userOrientation ? 'ແມ່ນ' : 'ບໍ່'],
                  ],
                ][idx];
                return (
                  <div key={st.key}>
                    <p className="font-semibold text-gray-800 mb-1">{st.code} · {st.label}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-dashed border-gray-100 py-1">
                          <span className="text-gray-400">{k}</span>
                          <span className="text-gray-700 text-right break-words">{v === '' || v === undefined || v === null ? '—' : v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
