import { useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Search, Trash2, Check, ChevronLeft, ChevronRight, Info, Pencil,
  ClipboardList, PackageCheck, Settings2, Send, RotateCcw,
} from 'lucide-react';
import { POPR_STEPS, POPR_STATUS, POPR_ORDER_STATUS, POPR_DELIVERY_STATUS, POPR_ITEM_TYPE } from '../constants/poprSteps';

// ເກນມູນຄ່າຕໍ່ໜ່ວຍ (ກີບ) ທີ່ຕ່ຳກວ່າ ມັກເປັນຂອງສິ້ນເປືອງ — ປັບໄດ້ຕາມນະໂຍບາຍບໍລິສັດ
const ASSET_PRICE_THRESHOLD = 500000;
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
  quantity: 1, // ຈຳນວນຂອງງວດນີ້
  poTotalQuantity: '', // ຈຳນວນສັ່ງທັງໝົດຕາມ PO (ວ່າງ = ເທົ່າກັບຈຳນວນງວດນີ້)
  lotNo: 1,
  // ໃຊ້ສ້າງລາຍການ Catalog ໃໝ່ຕອນປິດ POPR (ຖ້າຊື່ບໍ່ມີໃນ Catalog)
  category: '',
  unit: '',
  lowStockThreshold: '',
  spec: '',
  budget: '',
  price: '',
  vendor: '',
  vendorStandard: false,
  warrantyAgreement: false,
  poNumber: '',
  goodsReceiptNo: '',
  orderedBy: '', // ຜູ້ສັ່ງຊື້ — ຖ້າວ່າງ = ຜູ້ບັນທຶກ POPR
  orderedByUserId: '',
  orderStatus: 'PENDING',
  // 2) O — ການຮັບເຂົ້າ/ຕ້ອນຮັບ
  receivedDate: '',
  receivedQuantity: '', // ສະເພາະ CONSUMABLE
  boxCount: '', // ຕົວຊ່ວຍຄຳນວນ (UI ເທົ່ານັ້ນ ບໍ່ສົ່ງໄປ backend): ຈຳນວນກ່ອງ
  perBox: '', // ຈຳນວນຕໍ່ກ່ອງ
  // ຕໍ່ໜ່ວຍ (ELECTRONIC/GENERAL): { serialNumber, assetId (ຜູກຊັບສິນເດີມ), assetTag }
  units: [],
  deliveryStatus: 'SHIPPING',
  boxCondition: 'good',
  equipmentCondition: 'good',
  snMatch: false,
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
  storeInStock: false, // true = ເຂົ້າຄັງ (ຊັບສິນວ່າງ, ບວກສະຕ໊ອກ, ບໍ່ຕ້ອງມີຜູ້ຮັບ)
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

const blankUnit = () => ({ serialNumber: '', assetId: '', assetTag: '' });

/** ປັບລາຍການໜ່ວຍໃຫ້ມີຈຳນວນແຖວເທົ່າກັບຈຳນວນທີ່ຈັດຊື້ */
const padUnits = (units, qty) =>
  Array.from({ length: Math.max(0, qty) }, (_, i) => ({ ...blankUnit(), ...(units[i] || {}) }));

/** API record (nested) → flat form ຂອງ UI */
function toForm(rec = {}) {
  const p = rec.procurement || {};
  const o = rec.receiving || {};
  const c = rec.preparation || {};
  const r = rec.release || {};
  // ຂໍ້ມູນເກົ່າ (ໜ່ວຍດຽວ): ແປງ serialNumber/assetId ເປັນໜຶ່ງແຖວ
  const rawUnits =
    o.units && o.units.length > 0
      ? o.units
      : o.serialNumber || o.assetId
        ? [{ serialNumber: o.serialNumber, assetId: o.assetId }]
        : [];
  const units = rawUnits.map((u) => ({
    serialNumber: u.serialNumber || u.assetId?.serialNumber || '',
    assetId: u.assetId?._id || u.assetId || '',
    assetTag: u.assetId?.assetTag || '',
  }));
  return {
    itemType: rec.itemType || 'ELECTRONIC',
    catalogItemId: p.catalogItemId || '',
    itemName: p.itemName || '',
    quantity: p.quantity ?? 1,
    poTotalQuantity: p.poTotalQuantity ?? '',
    lotNo: p.lotNo ?? 1,
    category: p.category || '',
    unit: p.unit || '',
    lowStockThreshold: p.lowStockThreshold ?? '',
    spec: p.spec || '',
    budget: p.budget ?? '',
    price: p.price ?? '',
    vendor: p.vendor || '',
    vendorStandard: !!p.vendorStandard,
    warrantyAgreement: !!p.warrantyAgreement,
    poNumber: p.poNumber || '',
    goodsReceiptNo: p.goodsReceiptNo || '',
    orderedBy: p.orderedByUserId
      ? `${p.orderedByUserId.firstName || ''} ${p.orderedByUserId.lastName || ''}`.trim() ||
        p.orderedByUserId.employeeCode || p.orderedBy || ''
      : p.orderedBy || '',
    orderedByUserId: p.orderedByUserId?._id || p.orderedByUserId || '',
    orderStatus: p.orderStatus || 'PENDING',
    receivedDate: day(o.receivedDate),
    deliveryStatus: o.deliveryStatus || 'SHIPPING',
    boxCondition: o.boxCondition || 'good',
    equipmentCondition: o.equipmentCondition || 'good',
    receivedQuantity: o.receivedQuantity ?? '',
    units,
    // ສະແດງໃນຕາຕະລາງ/ຄົ້ນຫາ
    serialNumber: units.map((u) => u.serialNumber).filter(Boolean).join(', '),
    assetTag: o.assetTag || units.map((u) => u.assetTag).filter(Boolean).join(', '),
    snMatch: !!o.snMatch,
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
    storeInStock: !!r.storeInStock,
    assetStatus: r.assetStatus || 'IN_USE',
    assignedUser: r.assignedUser || '',
    assignedUserId: r.assignedUserId?._id || r.assignedUserId || '',
  };
}

/** flat form → API payload (nested) */
function toPayload(form, status, stage) {
  const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  const qty = Number(form.quantity) || 1;
  const isConsumable = form.itemType === 'CONSUMABLE';
  // ໜ່ວຍທີ່ຜູກຊັບສິນເດີມ ສົ່ງສະເພາະ assetId; ໜ່ວຍໃໝ່ສົ່ງ S/N; ຕັດແຖວຫວ່າງທ້າຍລາຍການ
  const units = isConsumable
    ? []
    : padUnits(form.units || [], qty).map((u) => ({
        assetId: u.assetId || undefined,
        serialNumber: u.assetId ? undefined : u.serialNumber.trim() || undefined,
      }));
  while (units.length > 0 && !units[units.length - 1].assetId && !units[units.length - 1].serialNumber) {
    units.pop();
  }
  return {
    status,
    stage,
    itemType: form.itemType,
    procurement: {
      catalogItemId: form.catalogItemId || undefined,
      itemName: form.itemName,
      quantity: qty,
      poTotalQuantity: num(form.poTotalQuantity) ?? qty,
      lotNo: Number(form.lotNo) || 1,
      category: form.catalogItemId ? undefined : form.category.trim() || undefined,
      unit: form.catalogItemId ? undefined : form.unit.trim() || undefined,
      lowStockThreshold: form.catalogItemId ? undefined : num(form.lowStockThreshold),
      spec: form.spec,
      budget: num(form.budget),
      price: num(form.price),
      vendor: form.vendor,
      vendorStandard: form.vendorStandard,
      warrantyAgreement: form.warrantyAgreement,
      poNumber: form.poNumber.trim() || undefined, // ຫວ່າງ = ບໍ່ສົ່ງ (ບໍ່ໃຫ້ຊົນ unique index)
      goodsReceiptNo: form.goodsReceiptNo || undefined,
      orderedBy: form.orderedBy || undefined,
      orderedByUserId: form.orderedByUserId || undefined,
      orderStatus: form.orderStatus,
    },
    receiving: {
      receivedDate: form.receivedDate || undefined,
      boxCondition: form.boxCondition,
      equipmentCondition: form.equipmentCondition,
      receivedQuantity: isConsumable ? num(form.receivedQuantity) ?? qty : undefined,
      units,
      snMatch: form.snMatch,
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
      storeInStock: form.itemType !== 'CONSUMABLE' && !!form.storeInStock,
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
    poClosedShort: !!rec.poClosedShort,
    poClosedReason: rec.poClosedReason || '',
    form: toForm(rec),
  };
}

const apiErr = (err, fallback) =>
  err.response?.data?.msg || err.response?.data?.message || fallback;

function validateStep(step, form) {
  const err = {};
  const type = form.itemType;
  const qty = Number(form.quantity) || 1;
  if (step === 0) {
    if (!form.itemName.trim()) err.itemName = 'ກະລຸນາລະບຸຊື່/ລາຍການອຸປະກອນ';
    if (!(Number(form.quantity) >= 1)) err.quantity = 'ຈຳນວນຕ້ອງຢ່າງໜ້ອຍ 1';
    // ລາຍການທີ່ບໍ່ມີໃນ Catalog ຈະຖືກສ້າງໃໝ່ຕອນປິດ POPR → ຕ້ອງມີໝວດໝູ່ ແລະ ຫົວໜ່ວຍ
    if (!form.catalogItemId) {
      if (!form.category.trim()) err.category = 'ກະລຸນາລະບຸໝວດໝູ່ (ລາຍການໃໝ່)';
      if (!form.unit.trim()) err.unit = 'ກະລຸນາລະບຸຫົວໜ່ວຍ (ລາຍການໃໝ່)';
    }
    if (form.poTotalQuantity !== '' && Number(form.poTotalQuantity) < Number(form.quantity)) {
      err.poTotalQuantity = 'ຈຳນວນສັ່ງທັງ PO ຕ້ອງບໍ່ໜ້ອຍກວ່າຈຳນວນຂອງງວດນີ້';
    }
    if (!form.spec.trim()) err.spec = 'ກະລຸນາລະບຸຂໍ້ກຳນົດ/ຂໍ້ມູນຈຳເພາະ';
    if (form.budget === '' || Number(form.budget) < 0) err.budget = 'ກະລຸນາລະບຸງົບປະມານ';
    if (!form.vendor.trim()) err.vendor = 'ກະລຸນາລະບຸຜູ້ຂາຍ';
    if (!form.poNumber.trim()) err.poNumber = 'ກະລຸນາລະບຸເລກໃບສັ່ງຊື້ (PO)';
  }
  if (step === 1) {
    if (!form.receivedDate) err.receivedDate = 'ກະລຸນາລະບຸວັນທີຮັບ';
    if (type === 'CONSUMABLE') {
      if (form.receivedQuantity === '' || !(Number(form.receivedQuantity) >= 0)) {
        err.receivedQuantity = 'ກະລຸນາລະບຸຈຳນວນທີ່ຮັບເຂົ້າຄັງຈິງ';
      }
    } else if (type === 'ELECTRONIC') {
      const units = padUnits(form.units || [], qty);
      const missing = [];
      const seenSn = new Set();
      const seenAsset = new Set();
      let dup = '';
      units.forEach((u, i) => {
        const sn = u.serialNumber.trim().toLowerCase();
        if (u.assetId) {
          if (seenAsset.has(u.assetId)) dup = `ຊັບສິນ ${u.assetTag || u.assetId} ຖືກຜູກຊ້ຳ`;
          seenAsset.add(u.assetId);
        } else if (!sn) {
          missing.push(i + 1);
        } else {
          if (seenSn.has(sn)) dup = `S/N "${u.serialNumber.trim()}" ຊ້ຳກັນ`;
          seenSn.add(sn);
        }
      });
      if (missing.length > 0) {
        err.units = `ຕ້ອງໃສ່ S/N ຫຼື ຜູກຊັບສິນເດີມ ໃຫ້ຄົບທຸກໜ່ວຍ — ຍັງຂາດໜ່ວຍທີ: ${missing.slice(0, 15).join(', ')}${missing.length > 15 ? ' ...' : ''}`;
      } else if (dup) {
        err.units = dup;
      }
      if (!form.snMatch) err.snMatch = 'ຕ້ອງຢືນຢັນວ່າ S/N ກົງກັບເອກະສານ';
    }
  }
  if (step === 2 && type === 'ELECTRONIC') {
    if (!form.os.trim()) err.os = 'ກະລຸນາລະບຸລະບົບປະຕິບັດການ (OS)';
    if (!form.secAntivirus && !form.secEdr && !form.secFirewall) {
      err.security = 'ເລືອກຢ່າງໜ້ອຍ 1 ຊອບແວຄວາມປອດໄພ';
    }
  }
  // ວັດສະດຸສິ້ນເປືອງເຂົ້າຄັງ — ບໍ່ຕ້ອງມີຜູ້ຮັບ/ລາຍເຊັນ
  if (step === 3 && type !== 'CONSUMABLE' && form.storeInStock && !form.location.trim()) {
    err.location = 'ເຂົ້າຄັງ: ກະລຸນາລະບຸສະຖານທີ່ເກັບ (ກັບໄປຂັ້ນ O ແລ້ວໃສ່ຊ່ອງ "ສະຖານທີ່")';
  }
  if (step === 3 && type !== 'CONSUMABLE' && !form.storeInStock) {
    if (!form.deliveredTo.trim()) err.deliveredTo = 'ກະລຸນາລະບຸຜູ້ຮັບມອບ/ພະແນກ';
    if (!form.assignedUserId) err.assignedUser = 'ຕ້ອງເລືອກຜູ້ຮັບດ້ວຍລະຫັດພະນັກງານ (ກົດ "ຄົ້ນຫາ")';
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
      if (a.status !== 'AVAILABLE') {
        setError(`ຊັບສິນ ${a.assetTag} ບໍ່ວ່າງ (ສະຖານະ ${a.status}) — ຜູກບໍ່ໄດ້`);
        return;
      }
      onResolved({ assetId: a._id, assetTag: a.assetTag, serialNumber: a.serialNumber || '' });
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

const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US');

/** ຈຳນວນທີ່ຮັບໃນງວດ (ສິ້ນເປືອງ = ຈຳນວນຮັບຈິງ) */
const lotQtyOf = (r) =>
  r.itemType === 'CONSUMABLE' && r.form.receivedQuantity !== '' && r.form.receivedQuantity != null
    ? Number(r.form.receivedQuantity) || 0
    : Number(r.form.quantity) || 0;

/** ສະຫຼຸບ PO ຈາກທຸກງວດ (ນັບສະເພາະງວດທີ່ປິດແລ້ວເປັນ "ຮັບແລ້ວ"); ບໍ່ນັບ excludeId (ງວດທີ່ກຳລັງແກ້) */
function computePo(records, po, excludeId) {
  const key = (po || '').trim();
  if (!key) return null;
  const lots = records.filter((r) => r._id !== excludeId && (r.form.poNumber || '').trim() === key);
  if (lots.length === 0) return null;
  const done = lots.filter((r) => r.status === 'COMPLETED');
  return {
    lots: lots.length,
    maxLot: Math.max(...lots.map((r) => Number(r.form.lotNo) || 1)),
    received: done.reduce((sum, r) => sum + lotQtyOf(r), 0),
    cost: done.reduce((sum, r) => sum + (Number(r.form.price) || 0) * lotQtyOf(r), 0),
    total: Math.max(...lots.map((r) => Number(r.form.poTotalQuantity) || Number(r.form.quantity) || 0)),
    budget: lots[0].form.budget,
    closedShort: lots.some((r) => r.poClosedShort),
    first: lots[0].form, // ງວດຫຼ້າສຸດ (ລາຍການຮຽງໃໝ່ → ເກົ່າ)
  };
}

/** ຕາຕະລາງຕໍ່ໜ່ວຍ: S/N ຕໍ່ໜ່ວຍ ຫຼື ຜູກຊັບສິນເດີມ (ເລືອກທາງດຽວຕໍ່ໜ່ວຍ) */
function UnitsTable({ units, qty, onChange, required }) {
  const rows = padUnits(units, qty);
  const [linkRow, setLinkRow] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState('');

  const update = (i, patch) => {
    const next = padUnits(units, qty);
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const applyBulk = () => {
    const lines = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const next = padUnits(units, qty);
    let li = 0;
    for (let i = 0; i < next.length && li < lines.length; i += 1) {
      if (next[i].assetId) continue; // ຂ້າມໜ່ວຍທີ່ຜູກຊັບສິນເດີມແລ້ວ
      next[i] = { ...next[i], serialNumber: lines[li] };
      li += 1;
    }
    onChange(next);
    setBulk('');
    setShowBulk(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <span>
          {rows.length} ໜ່ວຍ{required ? ' — ຕ້ອງມີ S/N ຫຼື ຜູກຊັບສິນ ທຸກໜ່ວຍ' : ' — S/N ບໍ່ບັງຄັບ'}
          {required && (() => {
            const filled = rows.filter((u) => (u.serialNumber || '').trim() || u.assetId).length;
            return (
              <b className={`ml-2 ${filled === rows.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                ໃສ່ແລ້ວ {filled}/{rows.length}
              </b>
            );
          })()}
        </span>
        <button type="button" onClick={() => setShowBulk((v) => !v)} className="text-amber-600 hover:underline">
          ວາງ S/N ຫຼາຍໜ່ວຍ
        </button>
      </div>
      {showBulk && (
        <div className="p-3 border-b border-gray-100 space-y-2">
          <textarea
            rows={4}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'1 ບັນທັດ = 1 ໜ່ວຍ (ຈະຕື່ມໃສ່ແຖວທີ່ຍັງບໍ່ຜູກຊັບສິນຕາມລຳດັບ)\nSN-0001\nSN-0002'}
            className={inputCls}
          />
          <button type="button" onClick={applyBulk} className="text-xs px-3 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
            ຕື່ມລົງຕາຕະລາງ
          </button>
        </div>
      )}
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {rows.map((u, i) => (
          <div key={i} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="w-8 text-xs text-gray-400">#{i + 1}</span>
            {u.assetId ? (
              <>
                <span className="text-emerald-600 text-xs">
                  ຜູກຊັບສິນເດີມ: <b>{u.assetTag || u.assetId}</b>
                  {u.serialNumber ? ` · S/N ${u.serialNumber}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => update(i, { assetId: '', assetTag: '' })}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  ຍົກເລີກການຜູກ
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={u.serialNumber}
                  onChange={(e) => update(i, { serialNumber: e.target.value })}
                  placeholder="Serial Number (S/N)"
                  className="flex-1 min-w-[10rem] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setLinkRow(linkRow === i ? null : i)}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  ຜູກຊັບສິນເດີມ
                </button>
                {linkRow === i && (
                  <AssetCodeLookup
                    onResolved={(a) => {
                      update(i, { assetId: a.assetId, assetTag: a.assetTag, serialNumber: a.serialNumber });
                      setLinkRow(null);
                    }}
                    linkedLabel=""
                  />
                )}
              </>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="p-3 text-xs text-gray-400">ບໍ່ມີໜ່ວຍ</p>}
      </div>
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
    // ຂອງສິ້ນເປືອງ: ຕື່ມຈຳນວນຮັບເລີ່ມຕົ້ນ = ຈຳນວນທີ່ຈັດຊື້
    if (step === 0 && form.itemType === 'CONSUMABLE' && form.receivedQuantity === '') {
      set({ receivedQuantity: String(form.quantity) });
    }
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

  // ສ້າງງວດຕໍ່ໄປ: ກັອບຂໍ້ມູນ PO ຈາກງວດກ່ອນ
  const openNextLot = (r) => {
    const stat = computePo(records, r.form.poNumber);
    const remaining = stat ? Math.max(stat.total - stat.received, 1) : 1;
    setEditingId(null);
    setForm({
      ...emptyForm(),
      itemType: r.itemType,
      catalogItemId: r.form.catalogItemId,
      itemName: r.form.itemName,
      category: r.form.category,
      unit: r.form.unit,
      lowStockThreshold: r.form.lowStockThreshold,
      spec: r.form.spec,
      budget: r.form.budget,
      price: r.form.price,
      vendor: r.form.vendor,
      vendorStandard: r.form.vendorStandard,
      warrantyAgreement: r.form.warrantyAgreement,
      poNumber: r.form.poNumber,
      poTotalQuantity: stat ? stat.total : r.form.poTotalQuantity,
      lotNo: (stat ? stat.maxLot : Number(r.form.lotNo) || 1) + 1,
      quantity: remaining,
      orderedBy: r.form.orderedBy,
      orderedByUserId: r.form.orderedByUserId,
      receivedBy: operatorName,
      receivedDate: new Date().toISOString().slice(0, 10),
      deliveryDate: new Date().toISOString().slice(0, 10),
    });
    setStep(0);
    setErrors({});
    setSubmitError('');
    setIsOpen(true);
  };

  const closePoShort = async (r) => {
    const stat = computePo(records, r.form.poNumber);
    const reason = window.prompt(
      `ປິດ PO ${r.form.poNumber} ແບບບໍ່ຄົບ? (ຮັບແລ້ວ ${stat?.received ?? '?'}/${stat?.total ?? '?'} — ຍົກເລີກສ່ວນທີ່ເຫຼືອ)\nເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ):`,
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      alert('ກະລຸນາລະບຸເຫດຜົນຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ');
      return;
    }
    try {
      await api.patch(`/popr-records/${r._id}/close-po-short`, { reason: reason.trim() });
      await fetchRecords();
    } catch (err) {
      alert(apiErr(err, 'ປິດ PO ບໍ່ສຳເລັດ'));
    }
  };

  const reopenRecord = async (r) => {
    const reason = window.prompt(
      `ເປີດ ${r._id} ຄືນ? ລະບົບຈະຍ້ອນກັບຊັບສິນ/ສະຕ໊ອກທີ່ເກີດຕອນປິດ (ຖ້າຊັບສິນຖືກໃຊ້ແລ້ວຈະປະຕິເສດ).\nເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ):`,
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      alert('ກະລຸນາລະບຸເຫດຜົນຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ');
      return;
    }
    try {
      await api.patch(`/popr-records/${r._id}/reopen`, { reason: reason.trim() });
      if (detail?._id === r._id) setDetail(null);
      await fetchRecords();
    } catch (err) {
      alert(apiErr(err, 'ເປີດຄືນບໍ່ສຳເລັດ'));
    }
  };

  const removeRecord = async (id) => {
    const rec = records.find((x) => x._id === id);
    const msg =
      rec?.status === 'COMPLETED'
        ? 'ລຶບ POPR ທີ່ປິດແລ້ວ? ລະບົບຈະຍ້ອນກັບຊັບສິນ/ສະຕ໊ອກກ່ອນ (ຖ້າຊັບສິນຖືກໃຊ້ແລ້ວ ຈະປະຕິເສດ).'
        : 'ລຶບບັນທຶກ POPR ນີ້?';
    if (!window.confirm(msg)) return;
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

  const poStats = useMemo(() => {
    const m = {};
    records.forEach((r) => {
      const po = (r.form.poNumber || '').trim();
      if (po && !m[po]) m[po] = computePo(records, po);
    });
    return m;
  }, [records]);

  const completedCount = records.filter((r) => r.status === 'COMPLETED').length;

  const stepContent = () => {
    const isConsumable = form.itemType === 'CONSUMABLE';
    const isElectronic = form.itemType === 'ELECTRONIC';
    const qty = Number(form.quantity) || 1;
    const categories = [...new Set(catalog.map((c) => c.category).filter(Boolean))];
    const poInfo = computePo(records, form.poNumber, editingId);
    const thisCost = (Number(form.price) || 0) * (Number(form.quantity) || 0);
    const poOver = !!poInfo && poInfo.total > 0 && poInfo.received + (Number(form.quantity) || 0) > poInfo.total;
    const costOver = !!poInfo && form.budget !== '' && poInfo.cost + thisCost > Number(form.budget);
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
          {form.itemName.trim() &&
            (form.catalogItemId ? (
              <p className="text-xs text-emerald-600">ໃຊ້ລາຍການ Catalog ເດີມ: {form.catalogItemId}</p>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-2">
                <p className="text-xs text-amber-700">
                  ລາຍການນີ້ຍັງບໍ່ມີໃນ Catalog — ລະບົບຈະສ້າງໃໝ່ຕອນປິດ POPR (ຕ້ອງລະບຸໝວດໝູ່ ແລະ ຫົວໜ່ວຍ)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="ໝວດໝູ່" required error={errors.category}>
                    <input
                      type="text"
                      list="popr-category-options"
                      value={form.category}
                      onChange={(e) => set({ category: e.target.value })}
                      placeholder="ເຊັ່ນ ຄອມພິວເຕີ"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="ຫົວໜ່ວຍ" required error={errors.unit}>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => set({ unit: e.target.value })}
                      placeholder="ເຊັ່ນ ເຄື່ອງ / ອັນ / ກ່ອງ"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="ຂັ້ນຕ່ຳສະຕ໊ອກ (ແຈ້ງເຕືອນ)">
                    <input
                      type="number"
                      min="0"
                      value={form.lowStockThreshold}
                      onChange={(e) => set({ lowStockThreshold: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            ))}
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
            <Field label="ງົບປະມານທັງ PO (ກີບ)" required error={errors.budget}>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={(e) => set({ budget: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="ລາຄາຊື້ ຕໍ່ 1 ໜ່ວຍ (ກີບ)">
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                className={inputCls}
              />
              {form.price !== '' && (
                <p className="text-xs text-gray-500 mt-1">
                  ລວມງວດນີ້: <b>{fmtMoney(Number(form.price) * (Number(form.quantity) || 0))}</b> ກີບ
                </p>
              )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ຈຳນວນສັ່ງທັງໝົດຕາມ PO" error={errors.poTotalQuantity}>
              <input
                type="number"
                min="1"
                value={form.poTotalQuantity}
                onChange={(e) => set({ poTotalQuantity: e.target.value })}
                placeholder={`ວ່າງ = ${form.quantity} (PO ງວດດຽວ)`}
                className={inputCls}
              />
            </Field>
            <Field label="ງວດທີ (ຮັບເປັນລອດ)">
              <input
                type="number"
                min="1"
                value={form.lotNo}
                onChange={(e) => set({ lotNo: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          {poInfo && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800 space-y-1">
              <p>
                PO ນີ້ມີແລ້ວ {poInfo.lots} ງວດ — ຮັບແລ້ວ <b>{poInfo.received}/{poInfo.total}</b>
                {poInfo.closedShort ? ' (ປິດແບບບໍ່ຄົບ)' : ''}
              </p>
              {!form.vendor.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    set({
                      itemType: poInfo.first.itemType,
                      catalogItemId: poInfo.first.catalogItemId,
                      itemName: poInfo.first.itemName,
                      category: poInfo.first.category,
                      unit: poInfo.first.unit,
                      spec: poInfo.first.spec,
                      budget: poInfo.first.budget,
                      price: poInfo.first.price,
                      vendor: poInfo.first.vendor,
                      poTotalQuantity: poInfo.total,
                      lotNo: poInfo.maxLot + 1,
                    })
                  }
                  className="px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  ໃຊ້ຂໍ້ມູນຂອງ PO ນີ້ (ງວດທີ {poInfo.maxLot + 1})
                </button>
              )}
              {poOver && (
                <p className="text-red-600">
                  ⚠ ງວດນີ້ ({Number(form.quantity) || 0}) ເຮັດໃຫ້ຮັບເກີນຈຳນວນສັ່ງ ({poInfo.total}) — ບັນທຶກໄດ້ ແຕ່ຈະມີການເຕືອນໃນ audit
                </p>
              )}
              {costOver && (
                <p className="text-amber-700">
                  ⚠ ຍອດຊື້ສະສົມ {fmtMoney(poInfo.cost + thisCost)} ກີບ ເກີນງົບ {fmtMoney(form.budget)} ກີບ
                </p>
              )}
            </div>
          )}
          <Field label="ຜູ້ສັ່ງຊື້">
            <input
              type="text"
              value={form.orderedBy}
              readOnly
              placeholder="ບໍ່ລະບຸ = ຜູ້ບັນທຶກ POPR (ທ່ານ) — ກົດຄົ້ນຫາເພື່ອປ່ຽນ"
              className={`${inputCls} bg-gray-50`}
            />
            <EmployeeCodeLookup
              onResolved={(u) => set({ orderedBy: u.name, orderedByUserId: u.userId })}
              linkedLabel={form.orderedByUserId ? form.orderedBy : ''}
            />
          </Field>
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
          {(() => {
            const po = (form.poNumber || '').trim();
            if (!po) return null;
            const others = records
              .filter((r) => r._id !== editingId && (r.form.poNumber || '').trim() === po)
              .sort((x, y) => (Number(x.form.lotNo) || 1) - (Number(y.form.lotNo) || 1));
            const thisQty = isConsumable
              ? (form.receivedQuantity !== '' ? Number(form.receivedQuantity) || 0 : Number(form.quantity) || 0)
              : Number(form.quantity) || 0;
            const doneQty = others.filter((r) => r.status === 'COMPLETED').reduce((sum, r) => sum + lotQtyOf(r), 0);
            const total = Math.max(
              Number(form.poTotalQuantity) || 0,
              ...others.map((r) => Number(r.form.poTotalQuantity) || 0),
            ) || Number(form.quantity) || 0;
            const running = doneQty + thisQty;
            const remain = total - running;
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs space-y-2">
                <p className="font-medium text-amber-800">
                  ການຮັບແຕ່ລະງວດຂອງ PO {po} — ຮັບສະສົມ <b>{running}/{total}</b>{' '}
                  {remain > 0 ? `(ຍັງເຫຼືອ ${remain})` : remain === 0 ? '(ຄົບແລ້ວ)' : `(ເກີນ ${-remain})`}
                </p>
                <table className="w-full text-left">
                  <thead className="text-gray-500">
                    <tr><th className="py-1">ງວດ</th><th>ວັນທີຮັບ</th><th>ເລກໃບຮັບ/ໃບສົ່ງ</th><th className="text-right">ຈຳນວນ</th><th className="text-right">ສະຖານະ</th></tr>
                  </thead>
                  <tbody>
                    {others.map((r) => (
                      <tr key={r._id} className="border-t border-amber-100">
                        <td className="py-1">{r.form.lotNo || 1}</td>
                        <td>{r.form.receivedDate || '-'}</td>
                        <td>{r.form.goodsReceiptNo || '-'}</td>
                        <td className="text-right">{lotQtyOf(r)}</td>
                        <td className="text-right">{r.status === 'COMPLETED' ? 'ຮັບແລ້ວ' : 'ລໍຖ້າ'}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-amber-200 font-medium">
                      <td className="py-1">{form.lotNo || 1} (ງວດນີ້)</td>
                      <td>{form.receivedDate || '-'}</td>
                      <td>{form.goodsReceiptNo || '-'}</td>
                      <td className="text-right">{thisQty}</td>
                      <td className="text-right">ກຳລັງບັນທຶກ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
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
          {isConsumable ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-2">
                <p className="text-xs font-medium text-purple-700">ຕົວຊ່ວຍນັບເປັນກ່ອງ (ບໍ່ບັງຄັບ)</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="ຈຳນວນກ່ອງ" className="w-28">
                    <input
                      type="number"
                      min="0"
                      value={form.boxCount ?? ''}
                      onChange={(e) => {
                        const boxCount = e.target.value;
                        const total = (Number(boxCount) || 0) * (Number(form.perBox) || 0);
                        set({ boxCount, ...(boxCount !== '' && form.perBox !== '' ? { receivedQuantity: String(total) } : {}) });
                      }}
                      className={inputCls}
                    />
                  </Field>
                  <span className="pb-2 text-gray-400">×</span>
                  <Field label="ຈຳນວນຕໍ່ກ່ອງ" className="w-28">
                    <input
                      type="number"
                      min="0"
                      value={form.perBox ?? ''}
                      onChange={(e) => {
                        const perBox = e.target.value;
                        const total = (Number(form.boxCount) || 0) * (Number(perBox) || 0);
                        set({ perBox, ...(perBox !== '' && form.boxCount !== '' ? { receivedQuantity: String(total) } : {}) });
                      }}
                      className={inputCls}
                    />
                  </Field>
                  {form.boxCount !== '' && form.perBox !== '' && (
                    <span className="pb-2 text-sm text-gray-600">
                      = <b>{(Number(form.boxCount) || 0) * (Number(form.perBox) || 0)}</b> {form.unit || 'ໜ່ວຍ'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  ຕົວຢ່າງ 5 ກ່ອງ × 10 ແທ່ງ = 50. ລາຄາຊື້ ໃສ່ເປັນລາຄາຕໍ່ 1 ໜ່ວຍ (ບໍ່ແມ່ນຕໍ່ກ່ອງ).
                </p>
              </div>
              <Field label="ຈຳນວນທີ່ຮັບເຂົ້າຄັງຈິງ" required error={errors.receivedQuantity} className="sm:w-1/2">
                <input
                  type="number"
                  min="0"
                  value={form.receivedQuantity}
                  onChange={(e) => set({ receivedQuantity: e.target.value })}
                  placeholder={`ຈັດຊື້ ${form.quantity}`}
                  className={inputCls}
                />
              </Field>
              <p className="text-xs text-gray-500">
                ວັດສະດຸສິ້ນເປືອງ: ສະຕ໊ອກຈະບວກຕາມຈຳນວນນີ້ຕອນປິດ POPR — ບໍ່ສ້າງຊັບສິນ/Asset Tag ແລະ ບໍ່ຕ້ອງມີຜູ້ຮັບ.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">
                ຂໍ້ມູນຕໍ່ໜ່ວຍ ({qty} ໜ່ວຍ){isElectronic && <span className="text-red-500"> *</span>}
              </p>
              <UnitsTable
                units={form.units || []}
                qty={qty}
                required={isElectronic}
                onChange={(units) => {
                  set({ units });
                  // ຖ້າມີ error ຄ້າງ: ຄຳນວນໃໝ່ທັນທີທີ່ແກ້ ເພື່ອບໍ່ໃຫ້ຂຶ້ນແດງຄ້າງຕອນໃສ່ຄົບແລ້ວ
                  if (errors.units) {
                    const e = validateStep(1, { ...form, units });
                    setErrors((prev) => {
                      const c = { ...prev };
                      if (e.units) c.units = e.units;
                      else delete c.units;
                      return c;
                    });
                  }
                }}
              />
              {errors.units && <p className="text-xs text-red-500">{errors.units}</p>}
              <p className="text-xs text-gray-500">
                ແຕ່ລະໜ່ວຍເລືອກທາງດຽວ: ໃສ່ S/N (ລະບົບສ້າງຊັບສິນ + Asset Tag ໃຫ້ຕອນປິດ) ຫຼື ຜູກຊັບສິນທີ່ລົງທະບຽນໄວ້ແລ້ວ
                (ຈະບໍ່ສ້າງຊ້ຳ). ຊັບສິນບໍ່ບວກສະຕ໊ອກ.
              </p>
            </div>
          )}
          {isElectronic && (
            <div className="flex flex-wrap gap-5">
              <Toggle checked={form.snMatch} onChange={(v) => set({ snMatch: v })}>
                S/N ກົງກັບເອກະສານ
              </Toggle>
            </div>
          )}
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
            <Field label="ຜູ້ເກັບຮັກສາ (ບໍ່ບັງຄັບ)">
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
      if (!isElectronic) {
        return (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            ອຸປະກອນທົ່ວໄປ/ວັດສະດຸສິ້ນເປືອງ ບໍ່ຈຳເປັນຕ້ອງຕິດຕັ້ງ OS ຫຼື ຊອບແວຄວາມປອດໄພ — ກົດ "ຕໍ່ໄປ" ໄດ້ເລີຍ.
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

    if (isConsumable) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 text-sm text-purple-800">
            ວັດສະດຸສິ້ນເປືອງເຂົ້າຄັງ — ບໍ່ຕ້ອງລະບຸຜູ້ຮັບ/ລາຍເຊັນ. ເມື່ອປິດ POPR ສະຕ໊ອກຂອງ "{form.itemName || '—'}" ຈະເພີ່ມ{' '}
            <b>{form.receivedQuantity === '' ? form.quantity : form.receivedQuantity}</b> {form.unit || 'ໜ່ວຍ'}.
          </div>
          <Field label="ວັນທີເຂົ້າຄັງ">
            <input type="date" value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
      );
    }

    const modeBox = (
      <div className="rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">ປ່ອຍແບບໃດ?</p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="radio" checked={!form.storeInStock} onChange={() => set({ storeInStock: false })} className="mt-1" />
          <span><b>ມອບໃຫ້ຜູ້ໃຊ້ທັນທີ</b> — ຊັບສິນຢູ່ກັບຜູ້ຮັບ, ສະຕ໊ອກບໍ່ເພີ່ມ</span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="radio" checked={!!form.storeInStock} onChange={() => set({ storeInStock: true })} className="mt-1" />
          <span><b>ເຂົ້າຄັງ</b> — ຊັບສິນ "ວ່າງ", ສະຕ໊ອກ +{qty}, ບໍ່ຕ້ອງເລືອກຜູ້ຮັບ (ຜູ້ຂໍມາເບີກພາຍຫຼັງຕາມໃບຂໍ)</span>
        </label>
      </div>
    );
    if (form.storeInStock) {
      return (
        <div className="space-y-4">
          {modeBox}
          {errors.location && <p className="text-xs text-red-500">{errors.location}</p>}
          <Field label="ວັນທີເຂົ້າຄັງ">
            <input type="date" value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {modeBox}
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
          <Field label="ຜູ້ຮັບ/ຜູ້ໃຊ້ (ເລືອກດ້ວຍລະຫັດພະນັກງານ)" required error={errors.assignedUser}>
            <input
              type="text"
              value={form.assignedUser}
              readOnly
              placeholder="ກົດຄົ້ນຫາດ້ວຍລະຫັດພະນັກງານ"
              className={`${inputCls} bg-gray-50`}
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
          <p>ຈຳນວນໜ່ວຍ: {qty} · ຜູກຊັບສິນເດີມ: {(form.units || []).filter((u) => u.assetId).length}</p>
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
                <th className="p-4 font-medium">ຜູ້ສັ່ງຊື້</th>
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
                  <td colSpan="10" className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-sm text-red-500 px-4">⚠️ {loadError}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-sm text-gray-400">
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
                      <td className="p-4">{f.orderedBy || r.createdBy || '—'}</td>
                      <td className="p-4">
                        <div>{f.poNumber || '—'}</div>
                        {f.poNumber && poStats[f.poNumber] && (
                          <div className="text-[11px] text-gray-400">
                            ງວດ {f.lotNo || 1} · ຮັບແລ້ວ {poStats[f.poNumber].received}/{poStats[f.poNumber].total}
                            {poStats[f.poNumber].closedShort ? ' · ປິດບໍ່ຄົບ' : ''}
                          </div>
                        )}
                      </td>
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
                          {canManage && r.status === 'COMPLETED' && f.poNumber && poStats[f.poNumber]
                            && poStats[f.poNumber].received < poStats[f.poNumber].total
                            && !poStats[f.poNumber].closedShort && (
                            <button
                              onClick={() => openNextLot(r)}
                              className="text-xs px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                              title="ສ້າງງວດຮັບຕໍ່ໄປຂອງ PO ນີ້"
                            >
                              + ງວດຕໍ່ໄປ
                            </button>
                          )}
                          {canApprove && r.status === 'COMPLETED' && f.poNumber && poStats[f.poNumber]
                            && poStats[f.poNumber].received < poStats[f.poNumber].total
                            && !poStats[f.poNumber].closedShort && (
                            <button
                              onClick={() => closePoShort(r)}
                              className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 whitespace-nowrap"
                              title="ຍົກເລີກສ່ວນທີ່ເຫຼືອ ແລະ ປິດ PO"
                            >
                              ປິດ PO ບໍ່ຄົບ
                            </button>
                          )}
                          {canApprove && r.status === 'COMPLETED' && (
                            <button
                              onClick={() => reopenRecord(r)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                              title="ເປີດຄືນ"
                            >
                              <RotateCcw size={15} />
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

      <datalist id="popr-category-options">
        {[...new Set(catalog.map((c) => c.category).filter(Boolean))].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
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
              <div className="mb-4 -mt-2 text-[11px] text-gray-500 space-y-1">
                {form.itemType === 'ELECTRONIC' && (
                  <p>ໄອທີ/ເອເລັກໂທຣນິກ: ຕ້ອງມີ S/N ທຸກໜ່ວຍກ່ອນປິດ POPR — ລະບົບສ້າງຊັບສິນ + Asset Tag ຕໍ່ໜ່ວຍ. ຖ້າຍັງບໍ່ມີ S/N ໃຫ້ບັນທຶກຮ່າງໄວ້ກ່ອນ.</p>
                )}
                {form.itemType === 'GENERAL' && (
                  <p>ອຸປະກອນທົ່ວໄປ (ຊັບສິນ ເຊັ່ນ ຕູ້/ໂຕະ/ເກົ້າອີ້): ມີ Asset Tag ຕໍ່ຊິ້ນ ບໍ່ນັບເປັນກ່ອງ, S/N ບໍ່ບັງຄັບ.</p>
                )}
                {form.itemType === 'CONSUMABLE' && (
                  <p>ວັດສະດຸສິ້ນເປືອງ (ປາກກາ/ເຈ້ຍ/ແຟ້ມ): ນັບເປັນກ່ອງ × ຕໍ່ກ່ອງ ເຂົ້າສະຕ໊ອກເປັນຈຳນວນ ບໍ່ມີ Asset Tag.</p>
                )}
                {form.itemType === 'GENERAL' && form.price !== '' && Number(form.price) > 0 && Number(form.price) < ASSET_PRICE_THRESHOLD && (
                  <p className="text-amber-600">
                    ລາຄາຕໍ່ໜ່ວຍຕ່ຳກວ່າ {fmtMoney(ASSET_PRICE_THRESHOLD)} ກີບ — ອາດເປັນຂອງສິ້ນເປືອງ, ຄວນພິຈາລະນາເລືອກປະເພດ "ວັດສະດຸສິ້ນເປືອງ".
                  </p>
                )}
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
                    ['ລາຍການ', f.itemName], ['ຈຳນວນ (ງວດນີ້)', f.quantity],
                    ['ງວດທີ', f.lotNo], ['ຈຳນວນສັ່ງທັງ PO', f.poTotalQuantity],
                    ['ໝວດໝູ່', f.category], ['ຫົວໜ່ວຍ', f.unit],
                    ['ຂໍ້ກຳນົດ', f.spec], ['ງົບທັງ PO (ກີບ)', f.budget],
                    ['ລາຄາຊື້/ໜ່ວຍ (ກີບ)', f.price],
                    ['ລວມງວດນີ້ (ກີບ)', f.price !== '' ? fmtMoney(Number(f.price) * (Number(f.quantity) || 0)) : ''],
                    ['ຜູ້ຂາຍ', f.vendor], ['ຕົງມາດຕະຖານ', f.vendorStandard ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ຮັບປະກັນ', f.warrantyAgreement ? 'ແມ່ນ' : 'ບໍ່'],
                    ['ຜູ້ສັ່ງຊື້', f.orderedBy || detail.createdBy], ['ເລກ PO', f.poNumber], ['ເລກໃບຮັບ', f.goodsReceiptNo],
                    ['ສະຖານະສັ່ງຊື້', (POPR_ORDER_STATUS[f.orderStatus] || {}).label],
                  ],
                  [
                    ['ວັນທີຮັບ', f.receivedDate], ['ສະພາບກ່ອງ', f.boxCondition],
                    ['ສະພາບອຸປະກອນ', f.equipmentCondition],
                    ['ຈຳນວນຮັບ (ສິ້ນເປືອງ)', f.itemType === 'CONSUMABLE' ? f.receivedQuantity : ''],
                    ['S/N ກົງ', f.snMatch ? 'ແມ່ນ' : 'ບໍ່'], ['Asset Tag', f.assetTag],
                    ['ຕໍ່ໜ່ວຍ (S/N · Tag)', (f.units || []).map((u, i) => `${i + 1}. ${u.serialNumber || '—'}${u.assetTag ? ` · ${u.assetTag}` : ''}`).join('\n')],
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
                          <span className="text-gray-700 text-right break-words whitespace-pre-line">{v === '' || v === undefined || v === null ? '—' : v}</span>
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