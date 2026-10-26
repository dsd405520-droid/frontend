import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ShoppingCart,
  X,
  Search,
  ScanLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Printer,
  Paperclip,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import CameraScanner from '../components/CameraScanner';
import AssetTagPrintModal from '../components/AssetTagPrintModal';
import CsvExportButton from '../components/CsvExportButton';
import api from '../services/api';
import GoodsReceiptPrint from '../components/GoodsReceiptPrint';
import { API_BASE_URL, API_ORIGIN } from '../config';
import { getCurrentUser, hasPermission } from '../utils/permissions';

const unwrap = (body) => (body && body.data !== undefined ? body.data : body);
const today = () => new Date().toISOString().slice(0, 10);
const MODE_LABEL = {
  RESTOCK: { text: 'ເພີ່ມ', cls: 'bg-amber-100 text-amber-700' },
  NEW_ITEM: { text: 'ຊື້ໃໝ່', cls: 'bg-emerald-100 text-emerald-700' },
};
const TRACKING = {
  SERIAL: { text: 'ມີ Serial Number', cls: 'bg-blue-100 text-blue-700' },
  TAG: { text: 'ຕິດ Asset Tag (ບໍ່ມີ S/N)', cls: 'bg-violet-100 text-violet-700' },
  COUNT: { text: 'ນັບຈຳນວນ', cls: 'bg-gray-100 text-gray-600' },
};
const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-white';

const errText = (err, fallback) => {
  const m = err.response?.data?.msg ?? err.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || fallback;
};

const trackingOf = (item) => {
  if (!item) return null;
  if (item.itemType === 'CONSUMABLE') return 'COUNT';
  if (item.itemType === 'ASSET') return item.trackSerial === false ? 'TAG' : 'SERIAL';
  return null;
};

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** ຟອມຮັບເຄື່ອງ — ໃຊ້ຮ່ວມກັນທັງ "ເພີ່ມ" (RESTOCK) ແລະ "ຊື້" (NEW_ITEM) */
function ReceiveModal({ mode, catalog, rooms, initialCatalogItemId, pr, onClose, onSaved }) {
  const isNew = mode === 'NEW_ITEM';
  const currentUser = getCurrentUser();
  const [catalogItemId, setCatalogItemId] = useState(initialCatalogItemId || '');
  const prRemaining = pr ? Math.max(1, (pr.quantity || 0) - (pr.receivedQuantity || 0)) : 1;
  const [item, setItem] = useState(
    pr?.newItem
      ? { name: pr.newItem.name, category: pr.newItem.category, unit: pr.newItem.unit, type: pr.newItem.type }
      : { name: '', category: '', unit: '', type: 'DEVICE_SERIAL' },
  );
  const [exceptionReason, setExceptionReason] = useState('');
  const canException = hasPermission('supplies', 'approve');
  const [hasSerial, setHasSerial] = useState(false); // legacy item ທີ່ຍັງບໍ່ມີ itemType
  const [quantity, setQuantity] = useState(prRemaining);
  const [expectedQuantity, setExpectedQuantity] = useState('');
  const [countNote, setCountNote] = useState('');
  const [receivedDate, setReceivedDate] = useState(today());
  const [vendor, setVendor] = useState(pr?.vendor || '');
  const [unitPrice, setUnitPrice] = useState(pr?.estimatedUnitPrice != null ? String(pr.estimatedUnitPrice) : '');
  const [storageRoom, setStorageRoom] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null); // { url, name }
  const [uploading, setUploading] = useState(false);
  const [receiptPrintOpen, setReceiptPrintOpen] = useState(false);
  const [note, setNote] = useState('');
  const [serials, setSerials] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [scan, setScan] = useState(null); // { mode: 'single' | 'continuous', index? }
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(currentUser?.branchId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [scannedIds, setScannedIds] = useState(() => new Set());

  const selected = catalog.find((c) => c._id === catalogItemId);
  const tracking = isNew
    ? item.type === 'CONSUMABLE'
      ? 'COUNT'
      : item.type === 'DEVICE_TAG'
        ? 'TAG'
        : 'SERIAL'
    : trackingOf(selected) || (selected && hasSerial ? 'SERIAL' : selected ? 'COUNT' : null);
  const qty = Math.max(0, Math.min(1000, parseInt(quantity, 10) || 0));
  const expected = expectedQuantity === '' ? null : parseInt(expectedQuantity, 10);
  const mismatch = Number.isInteger(expected) && expected !== qty;
  const stockBefore = selected?.stockQty ?? 0;
  const stockAfter = stockBefore + qty;
  const priceNum = unitPrice === '' ? null : Number(unitPrice);
  const totalPrice = priceNum !== null && Number.isFinite(priceNum) ? priceNum * qty : null;

  const filledCount = Array.from({ length: qty }, (_, i) => (serials[i] || '').trim()).filter(Boolean).length;
  const dupSet = useMemo(() => {
    const counts = new Map();
    Array.from({ length: qty }, (_, i) => (serials[i] || '').trim().toLowerCase())
      .filter(Boolean)
      .forEach((sn) => counts.set(sn, (counts.get(sn) || 0) + 1));
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([sn]) => sn));
  }, [serials, qty]);
  const hasDuplicate = dupSet.size > 0;

  const sortedCatalog = useMemo(
    () =>
      [...catalog]
        .filter((c) => c.isActive !== false)
        .sort((a, b) => {
          const aLow = a.stockQty <= a.lowStockThreshold ? 0 : 1;
          const bLow = b.stockQty <= b.lowStockThreshold ? 0 : 1;
          return aLow - bLow;
        }),
    [catalog],
  );

  useEffect(() => {
    api
      .get('/branches')
      .then((res) => setBranches(unwrap(res.data) || []))
      .catch(() => setBranches([]));
  }, []);

  const setSerial = (i, v) =>
    setSerials((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const applySerialText = (text) => {
    const parsed = String(text || '')
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;
    setSerials(parsed);
    if (parsed.length !== qty) {
      if (window.confirm(`ປັບຈຳນວນເປັນ ${parsed.length}?`)) setQuantity(parsed.length);
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (!text?.trim()) return;
    e.preventDefault();
    setPasteText(text);
    applySerialText(text);
  };

  const handleScan = (text) => {
    const value = String(text || '').trim();
    if (!value) return;
    if (scan?.mode === 'single') {
      setSerial(scan.index, value);
      setScan(null);
      return;
    }
    setSerials((prev) => {
      const next = [...prev];
      let idx = -1;
      for (let i = 0; i < qty; i++) {
        if (!String(next[i] || '').trim()) {
          idx = i;
          break;
        }
      }
      if (idx === -1) idx = Math.max(0, Math.min(qty - 1, next.length));
      next[idx] = value;
      return next;
    });
  };

  const handleInvoiceFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError('ໄຟລ໌ໃຫຍ່ເກີນໄປ (ຈຳກັດ 10MB)');
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      if (!res.ok) throw new Error('upload');
      const body = await res.json();
      const info = body.data ?? body;
      setInvoiceFile({ url: info.url, name: info.originalName || file.name });
    } catch {
      setError('ອັບໂຫຼດໃບບິນບໍ່ສຳເລັດ (ຮອງຮັບ PDF / ຮູບ / Word ບໍ່ເກີນ 10MB)');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isNew && !catalogItemId) return setError('ກະລຸນາເລືອກລາຍການ');
    if (isNew && (!item.name.trim() || !item.category.trim() || !item.unit.trim()))
      return setError('ກະລຸນາໃສ່ຊື່, ໝວດໝູ່ ແລະ ໜ່ວຍນັບ');
    if (!Number.isInteger(Number(quantity)) || qty < 1)
      return setError('ຈຳນວນຕ້ອງເປັນຈຳນວນເຕັມ ແລະ ຢ່າງໜ້ອຍ 1');
    if (tracking === 'TAG' && qty > 500)
      return setError('ຮັບເຂົ້າລາຍການທີ່ຕິດ Asset Tag ໄດ້ສູງສຸດ 500 ຊິ້ນຕໍ່ຄັ້ງ');
    if (mismatch && countNote.trim().length < 3)
      return setError('ຈຳນວນບໍ່ກົງກັບໃບສົ່ງເຄື່ອງ ກະລຸນາໃສ່ໝາຍເຫດ');

    let serialNumbers;
    if (tracking === 'SERIAL') {
      serialNumbers = Array.from({ length: qty }, (_, i) => (serials[i] || '').trim()).filter(Boolean);
      const lower = serialNumbers.map((s) => s.toLowerCase());
      if (new Set(lower).size !== lower.length) return setError('ມີ Serial Number ຊ້ຳກັນໃນລາຍການທີ່ປ້ອນ');
    }

    if (unitPrice !== '' && (!Number.isFinite(priceNum) || priceNum < 0)) return setError('ລາຄາບໍ່ຖືກຕ້ອງ');
    if (priceNum > 0 && !invoiceNo.trim()) return setError('ເມື່ອໃສ່ລາຄາ ຕ້ອງໃສ່ເລກທີໃບບິນ/ໃບເກັບເງິນ');

    if (!pr && canException && exceptionReason.trim().length < 5)
      return setError('ຮັບເຄື່ອງໂດຍບໍ່ມີໃບສະເໜີ ຕ້ອງໃສ່ເຫດຜົນ (ຢ່າງໜ້ອຍ 5 ຕົວອັກສອນ)');

    const common = {
      purchaseRequestId: pr?._id,
      exceptionReason: !pr ? exceptionReason.trim() || undefined : undefined,
      quantity: qty,
      unitPrice: priceNum !== null ? priceNum : undefined,
      storageRoom: tracking !== 'COUNT' ? storageRoom.trim() || undefined : undefined,
      invoiceNo: invoiceNo.trim() || undefined,
      invoiceFileUrl: invoiceFile?.url,
      invoiceFileName: invoiceFile?.name,
      expectedQuantity: Number.isInteger(expected) ? expected : undefined,
      countNote: mismatch ? countNote.trim() : undefined,
      receivedDate: receivedDate || undefined,
      vendor: vendor.trim() || undefined,
      note: note.trim() || undefined,
      branchId: tracking !== 'COUNT' ? branchId || undefined : undefined,
      serialNumbers: serialNumbers && serialNumbers.length ? serialNumbers : undefined,
    };
    try {
      setSaving(true);
      const res = isNew
        ? await api.post('/goods-receipt/new-item', {
            item: {
              ...item,
              name: item.name.trim(),
              category: item.category.trim(),
              unit: item.unit.trim(),
            },
            ...common,
          })
        : await api.post('/goods-receipt/restock', { catalogItemId, ...common });
      setResult(unwrap(res.data));
      onSaved?.();
    } catch (err) {
      setError(errText(err, 'ບັນທຶກບໍ່ສຳເລັດ'));
    } finally {
      setSaving(false);
    }
  };

  const claimBaseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, '');
  const missingTags = result?.assets?.filter((a) => !scannedIds.has(a._id)) || [];

  if (result) {
    const created = result.assets || [];
    const range =
      created.length > 1
        ? `${created[0].assetTag} … ${created[created.length - 1].assetTag}`
        : created[0]?.assetTag || '—';
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800">ຮັບເຄື່ອງສຳເລັດ</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
              <CheckCircle2 size={16} /> ບັນທຶກການຮັບເຄື່ອງເຂົ້າສະຕັອກສຳເລັດ
            </div>
            {result.receiptNo && (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <span className="text-gray-500">ເລກທີໃບຮັບເຄື່ອງ</span>
                <span className="font-semibold text-gray-800">{result.receiptNo}</span>
              </div>
            )}
            {result.totalPrice != null && (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <span className="text-gray-500">ລາຄາລວມ</span>
                <span className="font-semibold text-gray-800">{Number(result.totalPrice).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
              <span className="text-gray-500">ສະຕັອກ</span>
              <span className="font-semibold text-gray-800">
                {result.stockBefore ?? 0} → {result.stockAfter ?? 0}
              </span>
            </div>
            {created.length > 0 && (
              <>
                <p className="text-xs text-gray-500">
                  Asset Tag {range} · ທັງໝົດ {created.length} ລາຍການ
                </p>
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="p-2 font-medium">Asset Tag</th>
                        <th className="p-2 font-medium">Serial Number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {created.map((a) => (
                        <tr key={a._id}>
                          <td className="p-2 font-mono text-gray-800">{a.assetTag}</td>
                          <td className="p-2 text-gray-500">{a.serialNumber || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {verifyOpen && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-800">
                    ສະແກນແລ້ວ {created.length - missingTags.length}/{created.length}
                  </span>
                  <button type="button" onClick={() => setVerifyOpen(false)} className="text-xs text-blue-600">
                    ປິດການສະແກນ
                  </button>
                </div>
                {missingTags.length > 0 ? (
                  <p className="text-xs text-blue-700">
                    ຍັງຂາດ: {missingTags.map((a) => a.assetTag).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700">ຄົບທຸກລາຍການ</p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-gray-100">
            {result._id && (
              <button
                type="button"
                onClick={() => setReceiptPrintOpen(true)}
                className="px-4 py-2 border border-emerald-200 text-emerald-700 rounded-xl text-sm hover:bg-emerald-50 flex items-center gap-2"
              >
                <Printer size={16} /> ພິມໃບຮັບເຄື່ອງ
              </button>
            )}
            {created.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setVerifyOpen(true)}
                  className="px-4 py-2 border border-blue-200 text-blue-600 rounded-xl text-sm hover:bg-blue-50"
                >
                  ສະແກນກວດຢືນຢັນ
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOpen(true)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Printer size={16} /> ພິມປ້າຍ QR ທັງຊຸດ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.assign(`/asset-registry?search=${encodeURIComponent(result.catalogItemId || '')}`);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
                >
                  ເບິ່ງໃນທະບຽນຊັບສິນ
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium"
            >
              ປິດ
            </button>
          </div>
        </div>

        {receiptPrintOpen && <GoodsReceiptPrint receiptId={result._id} onClose={() => setReceiptPrintOpen(false)} />}
        {printOpen && (
          <AssetTagPrintModal assets={created} claimBaseUrl={claimBaseUrl} onClose={() => setPrintOpen(false)} />
        )}
        {verifyOpen && (
          <CameraScanner
            title="ສະແກນກວດຢືນຢັນ"
            hint="ສະແກນ QR ຂອງຊັບສິນທີ່ຫາກໍ່ສ້າງ"
            continuous
            onScan={(text) => {
              const raw = String(text || '').trim();
              const idMatch = raw.match(/\/assets\/([A-Za-z0-9_-]+)/);
              const hit = created.find(
                (a) => a._id === (idMatch?.[1] || raw) || a.assetTag.toLowerCase() === raw.toLowerCase(),
              );
              if (hit) setScannedIds((prev) => new Set(prev).add(hit._id));
            }}
            onClose={() => setVerifyOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {isNew ? 'ຊື້ເຄື່ອງເຂົ້າສະຕັອກ (ລາຍການໃໝ່)' : 'ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກ'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{error}</div>
          )}

          {pr ? (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl">
              ຮັບເຄື່ອງຕາມໃບສະເໜີ <b>{pr.prNo}</b> — ຂໍ {pr.quantity}, ຮັບແລ້ວ {pr.receivedQuantity || 0}, ເຫຼືອ {prRemaining}
            </div>
          ) : canException ? (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700">
                ບໍ່ມີໃບສະເໜີ — ຂໍ້ຍົກເວັ້ນສຳລັບຜູ້ມີສິດພິເສດ ຕ້ອງໃສ່ເຫດຜົນ (ຈະຖືກບັນທຶກໃນ audit)
              </p>
              <textarea
                rows={2}
                className={inputCls}
                placeholder="ເຫດຜົນ ເຊັ່ນ ຊື້ດ່ວນ / ຂອງບໍລິຈາກ"
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
              />
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl">
              ການຮັບເຄື່ອງຕ້ອງອ້າງອີງໃບສະເໜີຊື້ທີ່ອະນຸມັດແລ້ວ — ໃຫ້ກົດ "ຮັບເຄື່ອງ" ຈາກໜ້າໃບສະເໜີຊື້
            </div>
          )}

          {isNew ? (
            <fieldset disabled={!!pr} className="space-y-4">
              <Field label="ຊື່ລາຍການ" required>
                <input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ໝວດໝູ່" required>
                  <input
                    className={inputCls}
                    list="gr-categories"
                    value={item.category}
                    onChange={(e) => setItem({ ...item, category: e.target.value })}
                  />
                  <datalist id="gr-categories">
                    {[...new Set(catalog.map((c) => c.category).filter(Boolean))].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="ໜ່ວຍນັບ" required>
                  <input
                    className={inputCls}
                    placeholder="ເຊັ່ນ ອັນ, ກ່ອງ"
                    value={item.unit}
                    onChange={(e) => setItem({ ...item, unit: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="ວິທີຕິດຕາມ" required>
                <select className={inputCls} value={item.type} onChange={(e) => setItem({ ...item, type: e.target.value })}>
                  <option value="DEVICE_SERIAL">ມີ Serial Number</option>
                  <option value="DEVICE_TAG">ຕິດ Asset Tag (ບໍ່ມີ S/N)</option>
                  <option value="CONSUMABLE">ນັບຈຳນວນ (ສິ້ນເປືອງ)</option>
                </select>
              </Field>
            </fieldset>
          ) : (
            <>
              <Field label="ລາຍການ" required>
                <select className={inputCls} value={catalogItemId} disabled={!!pr} onChange={(e) => setCatalogItemId(e.target.value)}>
                  <option value="">— ເລືອກລາຍການ —</option>
                  {sortedCatalog.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c._id} — {c.name} (ສະຕັອກ {c.stockQty ?? 0})
                      {c.stockQty <= c.lowStockThreshold ? ' · ໃກ້ໝົດ' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {selected && !selected.itemType && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={hasSerial} onChange={(e) => setHasSerial(e.target.checked)} />
                  ລາຍການນີ້ເປັນອຸປະກອນທີ່ມີ Serial Number
                </label>
              )}
              {tracking && (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${TRACKING[tracking].cls}`}>
                  {TRACKING[tracking].text}
                </span>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="ຈຳນວນຕາມໃບສົ່ງເຄື່ອງ (ທາງເລືອກ)">
              <input
                type="number"
                min="1"
                max="1000"
                className={inputCls}
                value={expectedQuantity}
                onChange={(e) => setExpectedQuantity(e.target.value)}
              />
            </Field>
            <Field label="ຈຳນວນນັບໄດ້ຈິງ" required>
              <input
                type="number"
                min="1"
                max="1000"
                className={inputCls}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
          </div>
          {mismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl">
              {expected > qty ? `ຂາດ ${expected - qty}` : `ເກີນ ${qty - expected}`}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>ສະຕັອກ {stockBefore} → {stockAfter}</span>
            <span>{receivedDate ? new Date(receivedDate).toLocaleDateString() : ''}</span>
          </div>
          <Field label="ວັນທີຮັບ">
            <input type="date" className={inputCls} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </Field>
          {tracking !== 'COUNT' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="ສາຂາ">
                <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {!branchId && <option value="">— ເລືອກສາຂາ —</option>}
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ຫ້ອງເກັບ">
                <input
                  className={inputCls}
                  list="gr-rooms"
                  placeholder="ເຊັ່ນ ຫ້ອງ 201"
                  value={storageRoom}
                  onChange={(e) => setStorageRoom(e.target.value)}
                />
                <datalist id="gr-rooms">
                  {(rooms || []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
            </div>
          )}
          <Field label="ຜູ້ຂາຍ / ຜູ້ສະໜອງ">
            <input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ລາຄາຕໍ່ໜ່ວຍ">
              <input
                type="number"
                min="0"
                step="any"
                className={inputCls}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Field>
            <Field label="ລາຄາລວມ (ຄຳນວນອັດຕະໂນມັດ)">
              <input className={`${inputCls} bg-gray-50`} readOnly value={totalPrice !== null ? totalPrice.toLocaleString() : ''} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ເລກທີໃບບິນ / ໃບເກັບເງິນ" required={priceNum > 0}>
              <input className={inputCls} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
            <Field label="ແນບໃບບິນ (PDF / ຮູບ)">
              {invoiceFile ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-xl text-xs text-emerald-700">
                  <span className="truncate">{invoiceFile.name}</span>
                  <button type="button" onClick={() => setInvoiceFile(null)} className="text-emerald-700 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 cursor-pointer hover:bg-gray-50">
                  <Paperclip size={14} /> {uploading ? 'ກຳລັງອັບໂຫຼດ...' : 'ເລືອກໄຟລ໌'}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx" className="hidden" onChange={handleInvoiceFile} disabled={uploading} />
                </label>
              )}
            </Field>
          </div>
          <Field label="ໝາຍເຫດ">
            <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {mismatch && (
            <Field label="ໝາຍເຫດການນັບ (ຈຳເປັນ)" required>
              <textarea rows={2} className={inputCls} value={countNote} onChange={(e) => setCountNote(e.target.value)} />
            </Field>
          )}

          {tracking === 'SERIAL' && qty > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Serial Number ({qty} ໜ່ວຍ) <span className="text-gray-400 font-normal">— ທາງເລືອກ, ຕື່ມພາຍຫຼັງໃນທະບຽນຊັບສິນໄດ້</span>
              </p>
              <textarea
                rows={2}
                className={inputCls}
                placeholder="ວາງຫຼາຍ S/N (ບັນທັດລະອັນ)"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onPaste={handlePaste}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applySerialText(pasteText)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                >
                  ນຳໃຊ້ S/N
                </button>
                <button
                  type="button"
                  onClick={() => setScan({ mode: 'continuous' })}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                >
                  <ScanLine size={14} /> ສະແກນຕໍ່ເນື່ອງ ({filledCount}/{qty})
                </button>
              </div>
              {hasDuplicate && (
                <p className="text-xs text-red-600">ມີ Serial Number ຊ້ຳກັນ — ກະລຸນາແກ້ໄຂກ່ອນບັນທຶກ</p>
              )}
              {Array.from({ length: qty }, (_, i) => {
                const value = serials[i] || '';
                const isDup = value.trim() && dupSet.has(value.trim().toLowerCase());
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-8 text-xs text-gray-400 text-right">{i + 1}.</span>
                    <input
                      className={`${inputCls} ${isDup ? 'border-red-400 bg-red-50 text-red-700' : ''}`}
                      placeholder="ພິມ ຫຼື ສະແກນ S/N"
                      value={value}
                      onChange={(e) => setSerial(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const next = e.target.closest('div')?.nextElementSibling?.querySelector('input');
                          next?.focus();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setScan({ mode: 'single', index: i })}
                      title="ສະແກນ"
                      className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
                    >
                      <ScanLine size={16} />
                    </button>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400">ຖ້າບໍ່ໃສ່ S/N ລະບົບກໍຈະສ້າງຊັບສິນ + Asset Tag ໃຫ້ຄືກັນ; ຕື່ມ S/N ພາຍຫຼັງໄດ້</p>
            </div>
          )}

          {tracking === 'TAG' && qty > 0 && (
            <div className="p-3 bg-violet-50 border border-violet-200 text-violet-700 text-sm rounded-xl">
              ລະບົບຈະສ້າງ {qty} ຊັບສິນ ແລະ Asset Tag ອັດຕະໂນມັດ
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 text-white rounded-xl text-sm font-medium shadow-sm disabled:opacity-50 ${
              isNew ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
          </button>
        </div>
      </form>

      {scan && (
        <CameraScanner
          title={scan.mode === 'continuous' ? `ສະແກນ S/N (${filledCount}/${qty})` : 'ສະແກນ Serial Number'}
          continuous={scan.mode === 'continuous'}
          onScan={handleScan}
          onClose={() => setScan(null)}
        />
      )}
    </div>
  );
}

export default function GoodsReceipt() {
  const canManage = hasPermission('supplies', 'manage');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [modal, setModal] = useState(null); // { mode, initialCatalogItemId }
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [printId, setPrintId] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (modeFilter) params.mode = modeFilter;
      const res = await api.get('/goods-receipt', { params });
      const list = unwrap(res.data);
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(errText(err, 'ບໍ່ສາມາດໂຫຼດປະຫວັດການຮັບເຄື່ອງໄດ້'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await api.get('/supply-catalog');
      const list = unwrap(res.data);
      setCatalog(Array.isArray(list) ? list : []);
    } catch {
      setCatalog([]);
    }
  };

  useEffect(() => {
    if (!canManage) return undefined;
    const t = setTimeout(fetchRows, 250); // debounce ການຄົ້ນຫາ
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, modeFilter, canManage]);

  useEffect(() => {
    if (!canManage) return;
    fetchCatalog();
    api
      .get('/branches')
      .then((res) => setBranches(unwrap(res.data) || []))
      .catch(() => setBranches([]));
  }, [canManage]);

  useEffect(() => {
    const restock = searchParams.get('restock');
    const isNew = searchParams.get('new');
    const prId = searchParams.get('pr');
    if (!restock && !isNew && !prId) return;
    navigate('/goods-receipt', { replace: true });
    if (prId) {
      api
        .get(`/purchase-requests/${prId}`)
        .then((res) => {
          const pr = unwrap(res.data);
          setModal({
            mode: pr.catalogItemId ? 'RESTOCK' : 'NEW_ITEM',
            initialCatalogItemId: pr.catalogItemId || undefined,
            pr,
          });
        })
        .catch((err) => setLoadError(errText(err, 'ໂຫຼດໃບສະເໜີບໍ່ສຳເລັດ')));
      return;
    }
    setModal(restock ? { mode: 'RESTOCK', initialCatalogItemId: restock } : { mode: 'NEW_ITEM' });
  }, [searchParams, navigate]);

  const handleSaved = () => {
    fetchRows();
    fetchCatalog();
    setSuccess('ບັນທຶກການຮັບເຄື່ອງສຳເລັດ');
    setTimeout(() => setSuccess(''), 5000);
  };

  const personName = (u) =>
    u && typeof u === 'object'
      ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || '—'
      : '—';

  const branchName = (id) => branches.find((b) => b._id === id)?.name || id || '—';

  const rooms = useMemo(() => [...new Set(rows.map((r) => r.storageRoom).filter(Boolean))], [rows]);

  const total = useMemo(() => rows.reduce((s, r) => s + (r.quantity || 0), 0), [rows]);

  if (!canManage) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-sm text-gray-500">ທ່ານບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້ (ຕ້ອງມີສິດ supplies:manage)</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຮັບເຄື່ອງເຂົ້າຄັງ</h1>
            <p className="text-sm text-gray-500">ບັນທຶກເຄື່ອງທີ່ຊື້/ຮັບເຂົ້າສະຕັອກ — ຄຳຂໍເບີກເຄື່ອງໃຊ້ຂັ້ນຕອນເດີມ</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ mode: 'RESTOCK' })}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} /> <span>ເພີ່ມເຄື່ອງເຂົ້າສະຕັອກ</span>
            </button>
            <button
              onClick={() => setModal({ mode: 'NEW_ITEM' })}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm"
            >
              <ShoppingCart size={18} /> <span>ຊື້ເຄື່ອງເຂົ້າສະຕັອກ</span>
            </button>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-start">
              {rows.length} ຄັ້ງ · ລວມ {total} ຊິ້ນ
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ ລາຍການ / ຜູ້ຂາຍ / S/N..."
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-full sm:w-64"
                />
              </div>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">ທັງໝົດ</option>
                <option value="RESTOCK">ເພີ່ມ</option>
                <option value="NEW_ITEM">ຊື້</option>
              </select>
              <CsvExportButton
                data={rows}
                filename="goods-receipts.csv"
                label="Export CSV"
                permitted={hasPermission('supplies', 'read')}
                columns={[
                  { key: 'receiptNo', label: 'receiptNo' },
                  { key: 'receivedDate', label: 'date' },
                  { key: 'unitPrice', label: 'unitPrice' },
                  { key: 'totalPrice', label: 'totalPrice' },
                  { key: 'invoiceNo', label: 'invoiceNo' },
                  { key: 'storageRoom', label: 'storageRoom' },
                  { key: 'itemName', label: 'item' },
                  { key: 'quantity', label: 'quantity' },
                  { key: 'mode', label: 'mode' },
                  { key: 'vendor', label: 'vendor' },
                  { key: 'note', label: 'note' },
                  { key: 'countNote', label: 'countNote' },
                  { key: 'expectedQuantity', label: 'expectedQuantity' },
                  { key: 'branchId', label: 'branchId' },
                  { key: 'serialNumbers', label: 'serialNumbers' },
                  { key: 'assetTags', label: 'assetTags' },
                ]}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">ວັນທີ</th>
                  <th className="p-4 font-medium">ລາຍການ</th>
                  <th className="p-4 font-medium">ຈຳນວນ</th>
                  <th className="p-4 font-medium">ປະເພດ</th>
                  <th className="p-4 font-medium">ລາຄາລວມ</th>
                  <th className="p-4 font-medium">ບັນທຶກໂດຍ</th>
                  <th className="p-4 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {loading ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan="7" className="py-12 text-center text-red-500 px-4">⚠️ {loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400">ຍັງບໍ່ມີປະຫວັດການຮັບເຄື່ອງ</td></tr>
                ) : (
                  rows.map((r) => {
                    const m = MODE_LABEL[r.mode] || MODE_LABEL.RESTOCK;
                    const open = expandedId === r._id;
                    return (
                      <Fragment key={r._id}>
                        <tr
                          onClick={() => setExpandedId(open ? '' : r._id)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1">
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {r.receiptNo && <span className="font-mono text-xs text-gray-500 mr-1">{r.receiptNo}</span>}
                              {r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : '—'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-gray-800">{r.itemName}</div>
                            <div className="text-xs text-gray-400">
                              {r.catalogItemId}
                              {r.purchaseRequestNo ? ` · ${r.purchaseRequestNo}` : r.exceptionReason ? ' · ບໍ່ມີໃບສະເໜີ' : ''}
                              {r.vendor ? ` · ${r.vendor}` : ''}
                              {r.serialNumbers?.length ? ` · S/N: ${r.serialNumbers.slice(0, 3).join(', ')}${r.serialNumbers.length > 3 ? '…' : ''}` : ''}
                            </div>
                          </td>
                          <td className="p-4">{r.quantity}{r.unit ? ` ${r.unit}` : ''}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.cls}`}>{m.text}</span>
                          </td>
                          <td className="p-4">{r.totalPrice != null ? Number(r.totalPrice).toLocaleString() : '—'}</td>
                          <td className="p-4">{personName(r.createdBy)}</td>
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintId(r._id);
                              }}
                              title="ພິມໃບຮັບເຄື່ອງ"
                              className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                            >
                              <Printer size={14} />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-gray-50/60">
                            <td colSpan="7" className="px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>ສະຕັອກ: <b>{r.stockBefore ?? '—'} → {r.stockAfter ?? '—'}</b></div>
                                <div>ສາຂາ: <b>{branchName(r.branchId)}</b></div>
                                <div>ຄາດວ່າ / ນັບໄດ້: <b>{r.expectedQuantity ?? '—'} / {r.quantity}</b></div>
                                <div>ຜູ້ຂາຍ: <b>{r.vendor || '—'}</b></div>
                                <div>ຫ້ອງເກັບ: <b>{r.storageRoom || '—'}</b></div>
                                <div>ໃບສະເໜີ: <b>{r.purchaseRequestNo || '—'}</b></div>
                                {r.exceptionReason && <div className="sm:col-span-2 text-amber-700">ຂໍ້ຍົກເວັ້ນ (ບໍ່ມີໃບສະເໜີ): <b>{r.exceptionReason}</b></div>}
                                <div>ລາຄາ/ໜ່ວຍ: <b>{r.unitPrice != null ? Number(r.unitPrice).toLocaleString() : '—'}</b></div>
                                <div>
                                  ໃບບິນ: <b>{r.invoiceNo || '—'}</b>
                                  {r.invoiceFileUrl && (
                                    <a
                                      href={`${API_ORIGIN}${r.invoiceFileUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="ml-2 text-blue-600 underline"
                                    >
                                      ເປີດໄຟລ໌
                                    </a>
                                  )}
                                </div>
                                <div className="sm:col-span-2">ໝາຍເຫດ: <b>{r.note || '—'}</b></div>
                                {r.countNote && <div className="sm:col-span-2">ໝາຍເຫດການນັບ: <b>{r.countNote}</b></div>}
                                {r.serialNumbers?.length > 0 && (
                                  <div className="sm:col-span-2">S/N: <b>{r.serialNumbers.join(', ')}</b></div>
                                )}
                                {r.assetTags?.length > 0 && (
                                  <div className="sm:col-span-2">Asset Tags: <b>{r.assetTags.join(', ')}</b></div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {printId && <GoodsReceiptPrint receiptId={printId} onClose={() => setPrintId('')} />}
      {modal && (
        <ReceiveModal
          mode={modal.mode}
          catalog={catalog}
          rooms={rooms}
          initialCatalogItemId={modal.initialCatalogItemId}
          pr={modal.pr}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </MainLayout>
  );
}
