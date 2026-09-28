import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Loader2, MessageSquare, Paperclip, UserRound } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const TICKET_STEPS = [
  { key: 'OPEN', label: 'ແຈ້ງເຂົ້າມາ' },
  { key: 'ASSIGNED', label: 'ມອບໝາຍແລ້ວ' },
  { key: 'IN_PROGRESS', label: 'ກຳລັງແກ້ໄຂ' },
  { key: 'RESOLVED', label: 'ແກ້ໄຂແລ້ວ' },
  { key: 'CLOSED', label: 'ປິດແລ້ວ' },
];
const STATUS_STEP_INDEX = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  WAITING_ON_USER: 2,
  RESOLVED: 3,
  CLOSED: 4,
};
const STATUS_LABELS = {
  OPEN: 'ເປີດ (ລໍຖ້າຮັບ)',
  ASSIGNED: 'ມອບໝາຍແລ້ວ',
  IN_PROGRESS: 'ກຳລັງແກ້ໄຂ',
  WAITING_ON_USER: 'ລໍຖ້າຂໍ້ມູນຈາກຜູ້ໃຊ້',
  RESOLVED: 'ແກ້ໄຂແລ້ວ',
  CLOSED: 'ປິດແລ້ວ',
};

function unwrap(payload) {
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
}

function TicketProgressBar({ status }) {
  const currentIndex = STATUS_STEP_INDEX[status] ?? 0;
  const isWaiting = status === 'WAITING_ON_USER';
  return (
    <div className="flex items-start">
      {TICKET_STEPS.map((step, idx) => {
        const isDone = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isLast = idx === TICKET_STEPS.length - 1;
        return (
          <div key={step.key} className="flex flex-1 last:flex-none items-center">
            <div className="flex flex-col items-center text-center w-20">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDone
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                    ? isWaiting
                      ? 'bg-amber-100 text-amber-600 ring-4 ring-amber-100 animate-pulse'
                      : 'bg-blue-500 text-white ring-4 ring-blue-100'
                    : 'bg-gray-100 text-gray-300'
                  }`}
              >
                {isDone ? <Check size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <span className={`text-[11px] mt-1.5 leading-tight ${isCurrent ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                {step.label}
              </span>
              {isCurrent && isWaiting && (
                <span className="text-[10px] text-amber-600 font-medium mt-0.5">ລໍຖ້າຜູ້ໃຊ້</span>
              )}
            </div>
            {!isLast && <div className={`flex-1 h-0.5 mt-4 ${idx < currentIndex ? 'bg-emerald-500' : 'bg-gray-100'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

  useEffect(() => {
    let cancelled = false;
    window.scrollTo(0, 0);
    fetch(`http://localhost:3000/api/tickets/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((b) => {
            throw new Error(b?.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
          });
        }
        return res.json();
      })
      .then((b) => {
        if (!cancelled) setTicket(unwrap(b));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const userName = (u) => {
    if (!u) return 'ຍັງບໍ່ມີ';
    if (typeof u === 'object') {
      return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'ບໍ່ລະບຸຊື່';
    }
    return u;
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/issues')}
            className="p-2 rounded-xl hover:bg-gray-200 text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {ticket ? ticket.title : 'ລາຍລະອຽດປີ້'}
            </h1>
            <p className="text-xs text-gray-400">{ticket?.ticketNumber || id}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-gray-400 gap-2">
            <Loader2 size={16} className="animate-spin" />
            ກຳລັງໂຫຼດ...
          </div>
        ) : ticket ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <TicketProgressBar status={ticket.status} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ຄວາມສຳຄັນ</div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium uppercase ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>{ticket.priority}</span>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ສະຖານະ</div>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ຜູ້ແຈ້ງ</div>
                <div className="text-gray-700 flex items-center gap-1.5">
                  <UserRound size={14} className="text-gray-400" />
                  {userName(ticket.raisedBy)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ຜູ້ຮັບຜິດຊອບ</div>
                <div className="text-gray-700 flex items-center gap-1.5">
                  <UserRound size={14} className="text-gray-400" />
                  {userName(ticket.assignedAgent)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ວັນທີແຈ້ງ</div>
                <div className="text-gray-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  {formatDate(ticket.createdAt)}
                </div>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">ວັນທີແກ້ໄຂສຳເລັດ</div>
                  <div className="text-gray-700 flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-500" />
                    {formatDate(ticket.resolvedAt)}
                  </div>
                </div>
              )}
            </div>

            {(ticket.sla?.responseDueAt || ticket.sla?.resolutionDueAt) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {ticket.sla.responseDueAt && (
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">SLA ຕອບກັບພາຍໃນ</div>
                    <div className="text-gray-700">{formatDate(ticket.sla.responseDueAt)}</div>
                  </div>
                )}
                {ticket.sla.resolutionDueAt && (
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">SLA ແກ້ໄຂພາຍໃນ</div>
                    <div className="text-gray-700">{formatDate(ticket.sla.resolutionDueAt)}</div>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="text-xs text-gray-400 mb-1">ລາຍລະອຽດຈາກຜູ້ແຈ້ງ</div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">
                {ticket.description || 'ບໍ່ມີລາຍລະອຽດເພີ່ມຕື່ມ'}
              </p>
            </div>

            {ticket.attachments?.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1.5">ໄຟລ໌ແນບ ({ticket.attachments.length})</div>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={`http://localhost:3000${att.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 transition"
                    >
                      <Paperclip size={13} />
                      {att.filename || att.url.split('/').pop()}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate(`/issues/${id}/chat`)}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <MessageSquare size={16} />
              <span>ໄປໜ້າແຊັດກັບຜູ້ແຈ້ງບັນຫາ</span>
            </button>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}