import { useState } from 'react';
import api from '../services/api';
import { CatalogThumb } from './CatalogImage';
import { ShoppingPageModal } from './ShoppingPage';
import PurchaseRequestModal from './PurchaseRequestModal';

const ACTIONS = [
  { value: 'AVAILABLE', label: 'ມີຂອງ (ຈອງ)', on: 'bg-teal-600 text-white border-teal-600', off: 'text-teal-700 border-teal-200 hover:bg-teal-50' },
  { value: 'ORDER', label: 'ສັ່ງຊື້', on: 'bg-violet-600 text-white border-violet-600', off: 'text-violet-700 border-violet-200 hover:bg-violet-50' },
  { value: 'REJECT', label: 'ປະຕິເສດ', on: 'bg-rose-600 text-white border-rose-600', off: 'text-rose-600 border-rose-200 hover:bg-rose-50' },
];

export default function WarehouseLineReview({ req, catalog = [], onDone }) {
  const items = Array.isArray(req.items) ? req.items : [];
  const [rows, setRows] = useState(() =>
    items.map((it) => ({
      catalogItemId: it.catalogItemId || '',
      action: '',
      note: '',
      orderChoice: '',
      purchaseRequestId: '',
      purchaseRequestNo: '',
    })),
  );
  const [pickerIndex, setPickerIndex] = useState(null);
  const [pickedId, setPickedId] = useState('');
  const [prIndex, setPrIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const catById = (id) => catalog.find((c) => c._id === id);
  const patchRow = (i, patch) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const rowReady = (r) => {
    if (r.action === 'AVAILABLE') return !!r.catalogItemId;
    if (r.action === 'ORDER') return r.orderChoice === 'skip' || (r.orderChoice === 'create' && !!r.purchaseRequestId);
    if (r.action === 'REJECT') return !!r.note.trim();
    return false;
  };
  const undecided = rows.filter((r) => !rowReady(r)).length;

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const lines = rows.map((r, index) => ({
        index,
        action: r.action,
        ...(r.catalogItemId ? { catalogItemId: r.catalogItemId } : {}),
        ...(r.action === 'ORDER' && r.purchaseRequestId ? { purchaseRequestId: r.purchaseRequestId } : {}),
        ...(r.note.trim() ? { note: r.note.trim() } : {}),
      }));
      await api.patch(`/supply-requests/${req._id}/review-lines`, { lines });
      await onDone?.();
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'ບັນທຶກການກວດບໍ່ສຳເລັດ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
      <div className="text-sm font-semibold text-amber-800">ກວດແຕ່ລະລາຍການ (ຝ່າຍສາງ)</div>

      {items.map((it, i) => {
        const r = rows[i];
        const cat = catById(r.catalogItemId);
        const inStock = cat?.stockQty ?? 0;
        const reservedQty = cat?.reservedQty ?? 0;
        const stock = cat?.freeQty ?? inStock;
        const short = cat && (it.quantity || 0) > stock;
        return (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{it.name} <span className="text-gray-400 font-normal">× {it.quantity}</span></div>
                <div className="text-xs text-gray-500">ເຫດຜົນ: {it.reason || '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {cat ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                  <CatalogThumb url={cat.imageUrl} name={cat.name} size={28} />
                  <div className="text-xs">
                    <div className="font-medium text-gray-800">{cat.name}</div>
                    <div className={short ? 'text-red-600' : 'text-gray-500'}>
                      ໃນສະຕ໊ອກ {inStock} · ຈອງ {reservedQty} · ວ່າງ {stock} {cat.unit || ''}{short ? ' — ບໍ່ພໍ' : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-400">ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າຈາກ Catalog</span>
              )}
              <button
                type="button"
                onClick={() => { setPickedId(r.catalogItemId); setPickerIndex(i); }}
                className="px-3 py-1 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {cat ? 'ປ່ຽນສິນຄ້າ' : 'ເລືອກຈາກ Catalog'}
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {ACTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => patchRow(i, { action: a.value })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${r.action === a.value ? a.on : a.off}`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {r.action === 'AVAILABLE' && !r.catalogItemId && (
              <div className="text-xs text-red-600">ກະລຸນາເລືອກສິນຄ້າຈາກ Catalog ກ່ອນ</div>
            )}

            {r.action === 'ORDER' && (
              <div className="space-y-2 text-xs">
                <div className="text-gray-600">ຕ້ອງການສ້າງໃບສະເໜີຊື້ໃຫ້ລາຍການນີ້ບໍ?</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={!r.catalogItemId}
                    onClick={() => { patchRow(i, { orderChoice: 'create' }); setPrIndex(i); }}
                    className={`px-3 py-1 rounded-lg font-semibold border ${r.orderChoice === 'create' ? 'bg-violet-600 text-white border-violet-600' : 'border-violet-200 text-violet-700 hover:bg-violet-50'} disabled:opacity-40`}
                  >
                    ສ້າງໃບສະເໜີຊື້
                  </button>
                  <button
                    type="button"
                    onClick={() => patchRow(i, { orderChoice: 'skip', purchaseRequestId: '', purchaseRequestNo: '' })}
                    className={`px-3 py-1 rounded-lg font-semibold border ${r.orderChoice === 'skip' ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    ບໍ່ສ້າງ (ສັ່ງຊື້ແລ້ວ/ຈະສັ່ງເອງ)
                  </button>
                </div>
                {!r.catalogItemId && <div className="text-gray-400">ຕ້ອງເລືອກສິນຄ້າຈາກ Catalog ກ່ອນຈຶ່ງສ້າງໃບສະເໜີຊື້ໄດ້</div>}
                {r.orderChoice === 'create' && (
                  r.purchaseRequestId ? (
                    <div className="text-emerald-700 font-medium">✓ ສ້າງໃບສະເໜີຊື້ {r.purchaseRequestNo} ແລ້ວ — ຈະຜູກກັບລາຍການນີ້</div>
                  ) : (
                    <button type="button" onClick={() => setPrIndex(i)} className="text-violet-700 underline">ເປີດຟອມໃບສະເໜີຊື້</button>
                  )
                )}
              </div>
            )}

            {(r.action === 'REJECT' || r.action === 'ORDER' || r.action === 'AVAILABLE') && (
              <input
                type="text"
                value={r.note}
                onChange={(e) => patchRow(i, { note: e.target.value })}
                placeholder={r.action === 'REJECT' ? 'ເຫດຜົນທີ່ປະຕິເສດ (ຈຳເປັນ)' : 'ໝາຍເຫດເຖິງຜູ້ຂໍ (ບໍ່ບັງຄັບ)'}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
              />
            )}
          </div>
        );
      })}

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {undecided > 0 ? `ຍັງເຫຼືອ ${undecided} ລາຍການທີ່ຍັງບໍ່ໄດ້ຕັດສິນ` : 'ຕັດສິນຄົບທຸກລາຍການແລ້ວ'}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving || undecided > 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການກວດ ແລະ ແຈ້ງຜູ້ຂໍ'}
        </button>
      </div>

      <ShoppingPageModal
        open={pickerIndex !== null}
        title={pickerIndex !== null ? `ເລືອກສິນຄ້າ — ${items[pickerIndex]?.name || ''}` : ''}
        catalog={catalog}
        selection={pickedId ? [{ catalogItemId: pickedId, quantity: items[pickerIndex]?.quantity || 1 }] : []}
        fixedQty={items[pickerIndex]?.quantity || 1}
        onAdd={(c) => setPickedId(c._id)}
        onSetQty={(id, n) => { if (n <= 0) setPickedId(''); }}
        onClose={() => setPickerIndex(null)}
        onConfirm={() => {
          patchRow(pickerIndex, { catalogItemId: pickedId, purchaseRequestId: '', purchaseRequestNo: '' });
          setPickerIndex(null);
        }}
        confirmLabel="ເລືອກສິນຄ້ານີ້"
      />

      {prIndex !== null && (
        <PurchaseRequestModal
          catalog={catalog}
          initialCatalogItemId={rows[prIndex].catalogItemId}
          initialQuantity={Math.max((items[prIndex].quantity || 1) - (catById(rows[prIndex].catalogItemId)?.freeQty ?? catById(rows[prIndex].catalogItemId)?.stockQty ?? 0), 1)}
          initialReason={`ສຳລັບຄຳຂໍເບີກ ${req._id}: ${items[prIndex].name}${items[prIndex].reason ? ` (${items[prIndex].reason})` : ''}`}
          onClose={() => setPrIndex(null)}
          onSaved={(pr) => {
            if (pr?._id) patchRow(prIndex, { orderChoice: 'create', purchaseRequestId: pr._id, purchaseRequestNo: pr.prNo });
            setPrIndex(null);
          }}
        />
      )}
    </div>
  );
}
