import { Send, ShieldCheck, ShoppingCart, PackageCheck } from 'lucide-react';

const STEP_META = {
  request: { icon: Send, label: 'ຍື່ນຄຳຂໍ' },
  approve: { icon: ShieldCheck, label: 'ອະນຸມັດ' },
  purchase: { icon: ShoppingCart, label: 'ສັ່ງຊື້ເພີ່ມ (ສະຕ໊ອກບໍ່ພໍ)' },
  receive: { icon: PackageCheck, label: 'ຮັບເຄື່ອງ' },
};

const TONES = {
  ok: { caption: 'text-emerald-700', shortBar: '' },
  partial: { caption: 'text-amber-700', shortBar: 'bg-amber-400' },
  none: { caption: 'text-red-600', shortBar: 'bg-red-400' },
};

const stepCircleCls = (key, isCurrent) => {
  if (isCurrent) return 'bg-amber-500 text-white ring-2 ring-amber-100';
  if (key === 'purchase') return 'bg-violet-100 text-violet-600';
  return 'bg-gray-100 text-gray-400';
};

export default function CatalogCardProgress({ qty, stock }) {
  const wanted = Math.max(parseInt(qty, 10) || 0, 0);
  const available = Math.max(Number(stock) || 0, 0);
  if (wanted <= 0) return null;

  const fromStock = Math.min(wanted, available);
  const shortage = wanted - fromStock;
  const needsPurchase = shortage > 0;
  const tone = !needsPurchase ? TONES.ok : available <= 0 ? TONES.none : TONES.partial;
  const steps = needsPurchase ? ['request', 'approve', 'purchase', 'receive'] : ['request', 'approve', 'receive'];

  const caption = !needsPurchase
    ? `ພຽງພໍ — ເບີກຈາກສະຕ໊ອກ ${wanted}`
    : available <= 0
      ? `ສະຕ໊ອກໝົດ — ຕ້ອງຊື້ ${shortage}`
      : `ສະຕ໊ອກ ${fromStock} + ຊື້ເພີ່ມ ${shortage}`;

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center">
        {steps.map((key, idx) => {
          const { icon: Icon, label } = STEP_META[key];
          const isLast = idx === steps.length - 1;
          return (
            <div key={key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              <span
                title={label}
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${stepCircleCls(key, idx === 0)}`}
              >
                <Icon size={11} />
              </span>
              {!isLast && <span className="flex-1 h-px bg-gray-200 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${(fromStock / wanted) * 100}%` }} />
        {needsPurchase && <div className={`h-full ${tone.shortBar}`} style={{ width: `${(shortage / wanted) * 100}%` }} />}
      </div>

      <div className={`text-[10px] font-medium leading-tight ${tone.caption}`}>{caption}</div>
    </div>
  );
}
