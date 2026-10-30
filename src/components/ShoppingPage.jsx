import { useState, useMemo } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { imageSrc } from './CatalogImage';


export function QtyStepper({ value, onMinus, onPlus, onType }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button type="button" onClick={onMinus} className="w-8 h-8 text-gray-600 hover:bg-gray-100 text-base leading-none" aria-label="ຫຼຸດ">−</button>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onType(parseInt(e.target.value, 10) || 1)}
        className="w-12 h-8 text-center text-sm border-x border-gray-200 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" onClick={onPlus} className="w-8 h-8 text-gray-600 hover:bg-gray-100 text-base leading-none" aria-label="ເພີ່ມ">+</button>
    </div>
  );
}

export default function ShoppingPage({
  catalog = [],
  selection = [],
  onAdd,
  onSetQty,
  fixedQty,
  className = '',
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const activeCatalog = useMemo(
    () => (Array.isArray(catalog) ? catalog : []).filter((c) => c.isActive !== false),
    [catalog],
  );

  const categoryChips = useMemo(
    () => [...new Set(
      activeCatalog.flatMap((c) => String(c.category || '').split(',').map((t) => t.trim()).filter(Boolean)),
    )].sort(),
    [activeCatalog],
  );

  const q = search.trim().toLowerCase();
  const shown = activeCatalog.filter((c) => {
    if (category && !String(c.category || '').split(',').map((t) => t.trim()).includes(category)) return false;
    return !q || `${c.name} ${c.category || ''} ${c._id}`.toLowerCase().includes(q);
  });

  const qtyOf = (id) => {
    const found = selection.find((s) => s.catalogItemId === id);
    return found ? parseInt(found.quantity, 10) || 0 : 0;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                category === c
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
            const reserved = c.reservedQty ?? 0;
            const free = c.freeQty ?? Math.max(stock - reserved, 0);
            const stockState = stock <= 0
              ? { text: 'ສະຕ໊ອກໝົດ', cls: 'bg-red-100 text-red-700' }
              : free <= 0
                ? { text: 'ຖືກຈອງໝົດແລ້ວ', cls: 'bg-orange-100 text-orange-700' }
                : free <= (c.lowStockThreshold ?? 0)
                  ? { text: `ໃກ້ໝົດ — ວ່າງ ${free} ${c.unit || ''}`, cls: 'bg-amber-100 text-amber-700' }
                  : { text: `ວ່າງ ${free} ${c.unit || ''}`, cls: 'bg-emerald-100 text-emerald-700' };
            const qtyInCart = qtyOf(c._id);
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
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${stockState.cls}`}>
                    {stockState.text}
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
                    <div className="mt-1 text-xs text-gray-600" title="ໃນສະຕ໊ອກ = ທັງໝົດໃນຄັງ · ຈອງ = ຖືກຈອງໃຫ້ຄຳຂໍອື່ນແລ້ວ · ວ່າງ = ຍັງໃຫ້ໄດ້">
                      ໃນສະຕ໊ອກ: <b>{stock}</b> · ຈອງ: <b className={reserved > 0 ? 'text-orange-600' : ''}>{reserved}</b> · ວ່າງ: <b className={free <= 0 ? 'text-red-600' : 'text-emerald-600'}>{free}</b>
                    </div>
                    {fixedQty > 0 && free < fixedQty && (
                      <div className="mt-1 text-[11px] font-medium text-red-600">ວ່າງບໍ່ພໍ ({free}/{fixedQty}) — ເລືອກ ສັ່ງຊື້ ແທນໄດ້</div>
                    )}
                  </div>
                  <div className="mt-auto">
                    {qtyInCart > 0 ? (
                      fixedQty > 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-700">ຕ້ອງການ {fixedQty} ຊິ້ນ</span>
                          <button
                            type="button"
                            onClick={() => onSetQty?.(c._id, 0)}
                            className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100"
                          >
                            ເອົາອອກ
                          </button>
                        </div>
                      ) : (
                        <QtyStepper
                          value={qtyInCart}
                          onMinus={() => onSetQty?.(c._id, qtyInCart - 1)}
                          onPlus={() => onSetQty?.(c._id, qtyInCart + 1)}
                          onType={(n) => onSetQty?.(c._id, n)}
                        />
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdd?.(c)}
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
    </div>
  );
}

export function ShoppingPageModal({
  open,
  title = 'ເລືອກສິນຄ້າ',
  catalog,
  selection,
  onAdd,
  onSetQty,
  fixedQty,
  onClose,
  onConfirm,
  confirmLabel = 'ຢືນຢັນ',
}) {
  if (!open) return null;
  const totalQty = selection.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/60">
          <ShoppingPage catalog={catalog} selection={selection} onAdd={onAdd} onSetQty={onSetQty} fixedQty={fixedQty} />
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {selection.length === 0 ? (
              <span className="text-gray-400">ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າ</span>
            ) : (
              <>ເລືອກແລ້ວ <b className="text-gray-900">{selection.length}</b> ລາຍການ · ລວມ <b className="text-gray-900">{totalQty}</b> ຊິ້ນ</>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">ຍົກເລີກ</button>
            <button
              type="button"
              disabled={selection.length === 0}
              onClick={onConfirm}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
