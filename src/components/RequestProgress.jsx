import { Send, ShieldCheck, ShoppingCart, PackageCheck, Check, X } from 'lucide-react';

const ICONS = {
  request: Send,
  approve: ShieldCheck,
  purchase: ShoppingCart,
  receive: PackageCheck,
};

const LABELS = {
  request: { pending: 'ຍື່ນຄຳຂໍ', active: 'ຍື່ນຄຳຂໍ', done: 'ຍື່ນຄຳຂໍ' },
  approve: { pending: 'ອະນຸມັດ', active: 'ລໍຖ້າອະນຸມັດ', done: 'ອະນຸມັດແລ້ວ', failed: 'ຖືກປະຕິເສດ', cancelled: 'ຍົກເລີກແລ້ວ' },
  purchase: {
    pending: 'ສັ່ງຊື້ / ລໍສະຕ໊ອກ',
    active: 'ລໍຂອງເຂົ້າຄັງ',
    done: 'ຂອງເຂົ້າຄັງແລ້ວ',
    failed: 'ໃບສະເໜີຊື້ຖືກປະຕິເສດ/ຍົກເລີກ',
  },
  receive: { pending: 'ຮັບເຄື່ອງ', active: 'ລໍຖ້າຮັບເຄື່ອງ', done: 'ຮັບເຄື່ອງແລ້ວ' },
};

const CLOSED_STATUSES = ['CLOSED', 'FULFILLED'];
const STALLED_PURCHASE = ['REJECTED', 'CANCELLED'];

export const isRequestFinished = (req) => CLOSED_STATUSES.includes(req?.status);

// Hide the progress bar for finished, cancelled or rejected requests
export const shouldHideProgress = (req) => isRequestFinished(req) || ['CANCELLED', 'REJECTED'].includes(req?.status);

const circleCls = (state, key) => {
  if (state === 'done') return 'bg-emerald-500 text-white';
  if (state === 'failed') return 'bg-rose-500 text-white';
  if (state === 'cancelled') return 'bg-gray-400 text-white';
  if (state === 'active') return key === 'purchase' ? 'bg-violet-500 text-white' : 'bg-amber-500 text-white';
  return 'bg-gray-100 text-gray-400';
};

const labelCls = (state, key, ready) => {
  if (state === 'done') return 'text-gray-700';
  if (state === 'failed') return 'text-rose-600 font-semibold';
  if (state === 'cancelled') return 'text-gray-500 font-semibold';
  if (state === 'active') {
    if (key === 'purchase') return 'text-violet-600 font-semibold';
    return ready ? 'text-teal-600 font-semibold' : 'text-amber-600 font-semibold';
  }
  return 'text-gray-400';
};

const buildSteps = (req) => {
  const items = Array.isArray(req?.items) ? req.items : [];
  const purchaseItems = items.filter((it) => it.purchaseRequestId);
  const hasPurchase = purchaseItems.length > 0;
  const keys = hasPurchase ? ['request', 'approve', 'purchase', 'receive'] : ['request', 'approve', 'receive'];
  const waitKey = hasPurchase ? 'purchase' : 'receive';
  const purchaseStalled = purchaseItems.some((it) => STALLED_PURCHASE.includes(it.purchaseStatus));
  const arrived = purchaseItems.reduce((sum, it) => sum + (it.arrivedQty || 0), 0);
  const toBuy = purchaseItems.reduce((sum, it) => sum + (it.purchaseQty || 0), 0);
  const ready = !!req?.readyToCollectAt;

  let done = 1;
  let active = 'approve';
  let stopped = null;
  let stoppedState = 'failed';
  const override = {};

  if (isRequestFinished(req)) {
    done = keys.length;
    active = null;
  } else if (req?.status === 'REJECTED') {
    active = null;
    stopped = 'approve';
  } else if (req?.status === 'CANCELLED') {
    active = null;
    stopped = 'approve';
    stoppedState = 'cancelled';
  } else if (req?.status === 'PARTIALLY_RECEIVED') {
    done = keys.length - 1;
    active = 'receive';
    override.receive = 'ຮັບແລ້ວບາງສ່ວນ';
  } else if (req?.status === 'ORDERED' || (req?.status === 'APPROVED' && hasPurchase && !ready)) {
    done = keys.indexOf(waitKey);
    if (purchaseStalled) {
      active = null;
      stopped = waitKey;
    } else {
      active = waitKey;
      if (hasPurchase && toBuy > 0) override.purchase = `ລໍຂອງເຂົ້າຄັງ ${arrived}/${toBuy}`;
    }
  } else if (req?.status === 'APPROVED') {
    done = keys.indexOf('receive');
    active = 'receive';
    if (ready) override.receive = 'ພ້ອມມາຮັບ';
  }

  return keys.map((key, idx) => {
    let state = 'pending';
    if (key === stopped) state = stoppedState;
    else if (idx < done) state = 'done';
    else if (key === active) state = 'active';
    const label = override[key] && state === 'active' ? override[key] : LABELS[key][state] || LABELS[key].pending;
    return { key, state, label, ready: key === 'receive' && ready };
  });
};

export default function RequestProgress({ req }) {
  if (shouldHideProgress(req)) return null;
  const steps = buildSteps(req);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center min-w-[520px]">
        {steps.map((step, idx) => {
          const Icon = ICONS[step.key];
          const StateIcon = step.state === 'done' ? Check : step.state === 'failed' || step.state === 'cancelled' ? X : Icon;
          const isLast = idx === steps.length - 1;
          const lineDone = step.state === 'done';
          return (
            <div key={step.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${circleCls(step.state, step.key)}`}>
                  <StateIcon size={12} />
                </span>
                <span className={`text-xs whitespace-nowrap ${labelCls(step.state, step.key, step.ready)}`}>{step.label}</span>
              </div>
              {!isLast && <span className={`flex-1 h-px mx-3 min-w-[16px] ${lineDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
