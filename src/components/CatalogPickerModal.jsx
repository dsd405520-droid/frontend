import { useMemo, useState } from 'react';
import { Check, Package, Search, X } from 'lucide-react';
import { imageSrc } from './CatalogImage';

const tagsOf = (c) => String(c.category || '').split(',').map((t) => t.trim()).filter(Boolean);

/**
 * Popup ເລືອກລາຍການຈາກ Catalog ແບບ card grid (ຫນ້າຕາດຽວກັບຕອນສ້າງຄຳຂໍເບີກ) — ເລືອກໄດ້ 1 ລາຍການ.
 * onSelect(item) ຖືກເອີ້ນເມື່ອກົດເລືອກ ແລ້ວປິດເອງ.
 */
export default function CatalogPickerModal({ catalog, selectedId, onSelect, onClose, title = 'ເລືອກລາຍການ' }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const active = useMemo(() => (Array.isArray(catalog) ? catalog : []).filter((c) => c.isActive !== false), [catalog]);
  const chips = useMemo(() => [...new Set(active.flatMap(tagsOf))].sort(), [active]);
  const q = search.trim().toLowerCase();
  const shown = active.filter((c) => {
    if (category && !tagsOf(c).includes(category)) return false;
    return !q || `${c.name} ${c.category || ''} ${c._id}`.toLowerCase().includes(q);
  });

  const pick = (c) => {
    onSelect(c);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="ປິດ">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50/60">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່, ລະຫັດ ຫຼື ໝວດໝູ່..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {chips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['', ...chips].map((c) => (
                <button
                  key={c || '__all'}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                    category === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {c || 'ທັງໝົດ'}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {active.length === 0 ? 'ຍັງບໍ່ມີລາຍການໃນ Catalog' : 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {shown.map((c) => {
                const stock = c.stockQty ?? 0;
                const low = stock > 0 && stock <= (c.lowStockThreshold ?? 0);
                const isSel = c._id === selectedId;
                return (
                  <div
                    key={c._id}
                    className={`flex flex-col bg-white rounded-xl border overflow-hidden transition ${
                      isSel ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200 hover:shadow-sm'
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
                        {stock <= 0 ? 'ສະຕ໊ອກໝົດ' : `ເຫຼືອ ${stock} ${c.unit || ''}${low ? ' · ໃກ້ໝົດ' : ''}`}
                      </span>
                      {isSel && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug" title={c.name}>{c.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{c._id}{c.category ? ` · ${c.category}` : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className={`mt-auto w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isSel ? 'bg-amber-100 text-amber-700' : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {isSel ? <><Check size={14} /> ເລືອກຢູ່</> : 'ເລືອກ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">ຍົກເລີກ</button>
        </div>
      </div>
    </div>
  );
}
