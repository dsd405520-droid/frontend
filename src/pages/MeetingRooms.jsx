import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Plus, DoorClosed, Clock, MapPin, Edit3, Trash2, Search, X, Layers, Users, AlertTriangle, ChevronRight, QrCode, FileSpreadsheet, FileDown } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import { getSocket } from '../utils/socket';
import { useBranch } from '../contexts/BranchContext';
import { API_BASE_URL } from '../config';

// ===== ເສັ້ນຂັ້ນຕອນຂອງການຈອງ: ຮ້ອງຂໍຫ້ອງ → ລໍຖ້າແກ້ໄຂ → ລໍຖ້າອະນຸມັດ → ຈອງສຳເລັດ =====
// ບໍ່ສະແດງເມື່ອ: ຍົກເລີກ / ຖືກປະຕິເສດ / ກຳລັງໃຊ້ງານ (check-in ຫຼື ຢູ່ໃນຊ່ວງເວລາ) / ໃຊ້ງານແລ້ວ (ຈົບ ຫຼື check-out)
const BOOKING_PROGRESS_STEPS = [
  { key: 'requested', label: 'ຮ້ອງຂໍຫ້ອງ' },
  { key: 'editing', label: 'ລໍຖ້າແກ້ໄຂ' },
  { key: 'approval', label: 'ລໍຖ້າແອັດມິນອະນຸມັດ' },
  { key: 'booked', label: 'ຈອງສຳເລັດ' },
];

function getBookingProgress(b) {
  if (!b) return null;
  if (b.status === 'CANCELLED' || b.status === 'REJECTED') return null;
  if (b.checkedInAt || b.checkedOutAt) return null;
  const now = Date.now();
  const start = b.startAt ? new Date(b.startAt).getTime() : null;
  const end = b.endAt ? new Date(b.endAt).getTime() : null;
  if (end !== null && end <= now) return null; // ໃຊ້ງານແລ້ວ
  if (start !== null && start <= now) return null; // ກຳລັງໃຊ້ງານ

  const needsEdit = !!b.changeRequestedAt;
  const awaitingApproval = b.status === 'PENDING' || (b.pendingStartAt && b.pendingEndAt);
  // current = index ຂອງຂັ້ນຕອນປັດຈຸບັນ
  const current = needsEdit ? 1 : awaitingApproval ? 2 : 3;
  return { current, needsEdit };
}

function BookingProgress({ booking }) {
  const progress = getBookingProgress(booking);
  if (!progress) return null;
  const { current, needsEdit } = progress;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100" aria-label="ຂັ້ນຕອນການຈອງ">
      <div className="flex items-start">
        {BOOKING_PROGRESS_STEPS.map((step, i) => {
          const isBooked = step.key === 'booked';
          const skipped = step.key === 'editing' && !needsEdit && current > 1;
          const done = !skipped && (i < current || (isBooked && current === 3));
          const active = i === current && !(isBooked && current === 3);
          const alert = active && step.key === 'editing';

          let circle = 'bg-gray-100 text-gray-400 border border-gray-200';
          let text = 'text-gray-400';
          let content = i + 1;
          if (skipped) {
            circle = 'bg-gray-50 text-gray-300 border border-dashed border-gray-300';
            text = 'text-gray-300';
            content = '–';
          } else if (done) {
            circle = 'bg-emerald-500 text-white border border-emerald-500';
            text = 'text-emerald-700';
            content = '✓';
          } else if (alert) {
            circle = 'bg-red-500 text-white border border-red-500 ring-4 ring-red-100 animate-pulse';
            text = 'text-red-600 font-semibold';
            content = '!';
          } else if (active) {
            circle = 'bg-violet-500 text-white border border-violet-500 ring-4 ring-violet-100 animate-pulse';
            text = 'text-violet-700 font-semibold';
          }

          const lineDone = i < current && !(skipped);
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative min-w-0">
              {i > 0 && (
                <div
                  className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${i <= current ? (skipped ? 'bg-gray-200' : 'bg-emerald-400') : 'bg-gray-200'}`}
                />
              )}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${circle}`}>
                {content}
              </div>
              <span className={`mt-1.5 text-[11px] leading-tight text-center px-0.5 ${text}`}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MeetingRooms() {
  const { selectedBranchId, branches } = useBranch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canApproveBookings = hasPermission('rooms', 'approve');
  const canManageRooms = hasPermission('rooms', 'manage');
  const canUpdateRooms = hasPermission('rooms', 'update');
  const canImportBookings = hasPermission('rooms', 'import');
  const canCreateBooking = hasPermission('rooms', 'create');

  const canSeeAdminTab = canApproveBookings || canManageRooms;

  const [activeTab, setActiveTab] = useState('rooms');
  // ການຄົ້ນຫາ / ກັ່ນຕອງ / ຮຽງລຳດັບ ຂອງແຖບ "ການຈອງຂອງຂ້ອຍ" (ຄ່າເລີ່ມຕົ້ນ: ຮຽງຕາມວັນທີສ້າງ ໃໝ່ → ເກົ່າ)
  const [myQuery, setMyQuery] = useState('');
  const [myStatusFilter, setMyStatusFilter] = useState('all');
  const [myRoomFilter, setMyRoomFilter] = useState('all');
  const [mySort, setMySort] = useState('created_desc');
  const [adminSubTab, setAdminSubTab] = useState(canApproveBookings ? 'requests' : 'status');

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [floorFilter, setFloorFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [isFloorOpen, setIsFloorOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const floorRef = useRef(null);
  const locationRef = useRef(null);

  const [capMin, setCapMin] = useState('');
  const [capMax, setCapMax] = useState('');
  const [isCapOpen, setIsCapOpen] = useState(false);
  const capRef = useRef(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomSubmitting, setRoomSubmitting] = useState(false);
  const [roomFormError, setRoomFormError] = useState('');
  const [roomForm, setRoomForm] = useState({
    name: '',
    branchId: '',
    floor: '',
    location: '',
    capacity: 10,
    amenities: '',
  });

  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [statusRoomId, setStatusRoomId] = useState(null);
  const [selectedMaintId, setSelectedMaintId] = useState(null);
  const [suggestMode, setSuggestMode] = useState(false);
  const [flexChoice, setFlexChoice] = useState('');
  const [confirmBookingOpen, setConfirmBookingOpen] = useState(false);
  const [suggestDraft, setSuggestDraft] = useState({});
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [calendarViewMode, setCalendarViewMode] = useState('week');
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(new Date());

  const [myBookings, setMyBookings] = useState([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [untilDate, setUntilDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState({ type: '', text: '' });

  const [pickStart, setPickStart] = useState(null);

  const [isAvailOpen, setIsAvailOpen] = useState(false);
  const [availDate, setAvailDate] = useState('');
  const [availRange, setAvailRange] = useState({ start: 9 * 60, end: 10 * 60 });
  const [availFrom, setAvailFrom] = useState('');
  const [availTo, setAvailTo] = useState('');
  const [availRooms, setAvailRooms] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState('');

  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [currentBookingToReschedule, setCurrentBookingToReschedule] = useState(null);
  const [newStartAt, setNewStartAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');
  const [reschedulePickStart, setReschedulePickStart] = useState(null);
  const [rescheduleRoomId, setRescheduleRoomId] = useState('');

  const [utilizationData, setUtilizationData] = useState([]);
  const [loadingUtilization, setLoadingUtilization] = useState(false);
  const [utilFrom, setUtilFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [utilTo, setUtilTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusUpdatingRoomId, setStatusUpdatingRoomId] = useState(null);

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingApprovalsError, setPendingApprovalsError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const [adminWeek, setAdminWeek] = useState(new Date());
  const [adminConfirmed, setAdminConfirmed] = useState([]);
  const [adminRoomId, setAdminRoomId] = useState('');
  const [adminRoomQuery, setAdminRoomQuery] = useState('');
  const [adminRoomOpen, setAdminRoomOpen] = useState(false);
  const adminRoomRef = useRef(null);
  const [adminSelectedId, setAdminSelectedId] = useState(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [bookingToChange, setBookingToChange] = useState(null);
  const [changeType, setChangeType] = useState('EITHER');
  const [changeMessage, setChangeMessage] = useState('');
  const [changeSuggestions, setChangeSuggestions] = useState({ loading: false, error: '', rooms: [] });
  const [changePickedRoomId, setChangePickedRoomId] = useState(null);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState('');

  const [detailBooking, setDetailBooking] = useState(null);

  const [bookingNote, setBookingNote] = useState(null);

  const [maintenanceWindows, setMaintenanceWindows] = useState([]);
  const [affectedBookings, setAffectedBookings] = useState([]);
  const [maintenanceDialog, setMaintenanceDialog] = useState(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [scheduleForm, setScheduleForm] = useState({ start: '', end: '', reason: '' });
  const [scheduleImpact, setScheduleImpact] = useState([]);
  const [maintPickStart, setMaintPickStart] = useState(null);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

  const [, setNowTick] = useState(0);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const roomsReqSeq = useRef(0);
  const calendarReqSeq = useRef(0);
  const myBookingsReqSeq = useRef(0);

  const fetchRooms = (silent = false, branchId = selectedBranchId) => {
    const seq = ++roomsReqSeq.current;
    if (!silent) setLoading(true);
    setError(null);
    const branchParam = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    fetch(`${API_BASE_URL}/rooms${branchParam}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງປະຊຸມໄດ້');
        return res.json();
      })
      .then(data => {
        if (seq !== roomsReqSeq.current) return;
        const roomList = Array.isArray(data) ? data : data.data || [];
        setRooms(roomList);
        setLoading(false);
      })
      .catch((err) => {
        if (seq !== roomsReqSeq.current) return;
        setError(err.message || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງປະຊຸມໄດ້');
        setLoading(false);
      });
  };

  const getWeekRange = (anchor) => {
    const day = anchor.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    return { from: monday, to: friday };
  };

  const getDayRange = (anchor) => {
    const from = new Date(anchor);
    from.setHours(0, 0, 0, 0);
    const to = new Date(anchor);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  };

  const fetchCalendarBookings = () => {

    const { from, to } = calendarViewMode === 'day'
      ? getDayRange(calendarAnchorDate)
      : getWeekRange(calendarAnchorDate);

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const seq = ++calendarReqSeq.current;
    fetch(`${API_BASE_URL}/room-bookings?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (seq !== calendarReqSeq.current) return;
        const bookingsList = Array.isArray(data) ? data : data.data || [];
        setCalendarBookings(bookingsList);
      })
      .catch(() => {

        if (seq !== calendarReqSeq.current) return;
      });
  };

  const fetchMyBookings = (silent = false) => {
    const seq = ++myBookingsReqSeq.current;
    if (!silent) setLoadingMyBookings(true);
    fetch(`${API_BASE_URL}/room-bookings/my`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (seq !== myBookingsReqSeq.current) return;
        setMyBookings(Array.isArray(data) ? data : data.data || []);
        setLoadingMyBookings(false);
      })
      .catch(() => {
        if (seq === myBookingsReqSeq.current) setLoadingMyBookings(false);
      });
  };

  // ການຈອງທີ່ຖືກຂໍໃຫ້ແກ້ໄຂ (ປ່ຽນເວລາ/ຫ້ອງ) ແລະ ຍັງບໍ່ໄດ້ແກ້ — ຈະຖືກດັນຂຶ້ນເທິງສຸດ ແລະ ມີກອບແດງ
  const bookingNeedsChange = (b) => (
    !!b.changeRequestedAt &&
    b.status !== 'CANCELLED' &&
    b.status !== 'REJECTED' &&
    !isBookingPast(b)
  );

  const myBookingRoomName = (b) => b.room?.name || b.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ';

  // ວັນທີສ້າງການຈອງ (createdAt → ເຫດການ CREATED ໃນປະຫວັດ → ເວລາເລີ່ມ)
  const myBookingCreatedMs = (b) => {
    const created = b.createdAt || (b.history || []).find(h => h.action === 'CREATED')?.at || b.startAt;
    const t = created ? new Date(created).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };

  const getVisibleMyBookings = () => {
    const q = myQuery.trim().toLowerCase();
    const list = myBookings.filter((b) => {
      if (myRoomFilter !== 'all' && myBookingRoomName(b) !== myRoomFilter) return false;

      if (myStatusFilter === 'needs_change' && !bookingNeedsChange(b)) return false;
      if (myStatusFilter === 'upcoming' && !((b.status === 'PENDING' || b.status === 'CONFIRMED') && !isBookingPast(b))) return false;
      if (myStatusFilter === 'past' && !(isBookingPast(b) && b.status !== 'CANCELLED' && b.status !== 'REJECTED')) return false;
      if (['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].includes(myStatusFilter) && b.status !== myStatusFilter) return false;

      if (q) {
        const hay = [
          b.title,
          myBookingRoomName(b),
          bookingStatusInfo(b.status).label,
          b.rejectionReason,
          b.description,
          b.startAt ? new Date(b.startAt).toLocaleString() : '',
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const cmp = {
      created_desc: (x, y) => myBookingCreatedMs(y) - myBookingCreatedMs(x),
      created_asc: (x, y) => myBookingCreatedMs(x) - myBookingCreatedMs(y),
      start_desc: (x, y) => new Date(y.startAt).getTime() - new Date(x.startAt).getTime(),
      start_asc: (x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime(),
      room_asc: (x, y) => myBookingRoomName(x).localeCompare(myBookingRoomName(y)) || myBookingCreatedMs(y) - myBookingCreatedMs(x),
    }[mySort] || ((x, y) => myBookingCreatedMs(y) - myBookingCreatedMs(x));

    // ການຈອງທີ່ຕ້ອງແກ້ໄຂ ຍັງຖືກດັນຂຶ້ນເທິງສຸດສະເໝີ
    return [...list].sort((x, y) => (Number(bookingNeedsChange(y)) - Number(bookingNeedsChange(x))) || cmp(x, y));
  };

  const myFiltersActive = !!myQuery.trim() || myStatusFilter !== 'all' || myRoomFilter !== 'all' || mySort !== 'created_desc';
  const resetMyFilters = () => {
    setMyQuery('');
    setMyStatusFilter('all');
    setMyRoomFilter('all');
    setMySort('created_desc');
  };

  // ເປີດ popup ເລື່ອນເວລາ / ປ່ຽນຫ້ອງ ຂອງການຈອງ (ໃຊ້ທັງຈາກປຸ່ມ ແລະ ຈາກການກົດ notification)
  const openRescheduleModal = (b) => {
    if (isBookingPast(b)) {
      alert('ປະຊຸມນີ້ຈົບແລ້ວ ບໍ່ສາມາດເລື່ອນເວລາໄດ້');
      return;
    }
    setCurrentBookingToReschedule(b);

    // ຖ້າຜູ້ອະນຸມັດຂໍໃຫ້ແກ້ໄຂ — ບໍ່ ຕື່ມເວລາເດີມ (ເພາະຊົ່ວກັນ) ໃຫ້ເລືອກໃໝ່
    const askedToChange = !!b.changeRequestedAt;
    const hasSug = askedToChange && b.changeSuggestedStartAt && b.changeSuggestedEndAt;
    const prefillStartAt = hasSug ? b.changeSuggestedStartAt : (askedToChange ? null : (b.pendingStartAt || b.startAt));
    const prefillEndAt = hasSug ? b.changeSuggestedEndAt : (askedToChange ? null : (b.pendingEndAt || b.endAt));
    setNewStartAt(prefillStartAt ? toDateTimeLocalValue(new Date(prefillStartAt)) : '');
    setNewEndAt(prefillEndAt ? toDateTimeLocalValue(new Date(prefillEndAt)) : '');
    setRescheduleRoomId(String(b.pendingRoomId?._id || b.pendingRoomId || bookingRoomId(b)));
    setReschedulePickStart(null);

    if (hasSug) setCalendarAnchorDate(new Date(b.changeSuggestedStartAt));
    else if (b.startAt) setCalendarAnchorDate(new Date(b.startAt));
    setRescheduleModalOpen(true);
  };

  const fetchUtilization = (silent = false) => {
    if (!silent) setLoadingUtilization(true);
    const from = new Date(utilFrom + 'T00:00:00').toISOString();
    const to = new Date(utilTo + 'T23:59:59').toISOString();
    const params = new URLSearchParams({ from, to });

    fetch(`${API_BASE_URL}/rooms/utilization?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setUtilizationData(Array.isArray(data) ? data : data.data || []);
        setLoadingUtilization(false);
      })
      .catch(() => setLoadingUtilization(false));
  };

  const fetchPendingApprovals = (silent = false) => {
    if (!silent) setLoadingPending(true);
    setPendingApprovalsError('');
    fetch(`${API_BASE_URL}/room-bookings/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (res.status === 403) {
          throw new Error('ບໍ່ມີສິດ (rooms:approve) — ບັນຊີນີ້ຍັງບໍ່ໄດ້ຮັບອະນຸຍາດໃຫ້ອະນຸມັດການຈອງ');
        }
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || `ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        setPendingApprovals(Array.isArray(data) ? data : data.data || []);
        setLoadingPending(false);
      })
      .catch((err) => {
        setPendingApprovals([]);
        setPendingApprovalsError(err.message);
        setLoadingPending(false);
      });
  };

  const fetchMaintenance = () => {
    const from = new Date();
    from.setDate(from.getDate() - 60);
    const params = new URLSearchParams({ from: from.toISOString() });
    fetch(`${API_BASE_URL}/rooms/maintenance?${params.toString()}`, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setMaintenanceWindows(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  };

  const fetchAffected = () => {
    if (!canUpdateRooms) return;
    fetch(`${API_BASE_URL}/rooms/maintenance/affected`, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setAffectedBookings(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  };

  useEffect(() => {

    fetchRooms();
    fetchMaintenance();
    fetchAffected();

  }, [selectedBranchId]);

  // ກົດ notification → ?tab=my-bookings&reschedule=<id> : ໄປແຖບ "ການຈອງຂອງຂ້ອຍ" ແລະ ເປີດ popup ປ່ຽນເວລາ/ຫ້ອງ
  useEffect(() => {
    const tab = searchParams.get('tab');
    const rescheduleId = searchParams.get('reschedule');
    if (tab !== 'my-bookings' && !rescheduleId) return undefined;

    setActiveTab('my-bookings');
    let cancelled = false;
    if (rescheduleId) {
      fetch(`${API_BASE_URL}/room-bookings/my`, {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : data.data || [];
          setMyBookings(list);
          const target = list.find(x => String(x._id) === String(rescheduleId));
          if (target && target.status !== 'CANCELLED' && target.status !== 'REJECTED') {
            openRescheduleModal(target);
          } else {
            alert('ບໍ່ພົບການຈອງນີ້ ຫຼື ການຈອງຖືກຍົກເລີກແລ້ວ');
          }
        })
        .catch(() => {});
    }
    navigate('/meeting-rooms', { replace: true });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('tab'), searchParams.get('reschedule')]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {

      setCalendarViewMode('week');
      setIsModalOpen(true);
    }

  }, [searchParams.get('create')]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (adminRoomRef.current && !adminRoomRef.current.contains(e.target)) {
        setAdminRoomOpen(false);
      }
      if (floorRef.current && !floorRef.current.contains(e.target)) {
        setIsFloorOpen(false);
      }
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        setIsLocationOpen(false);
      }
      if (capRef.current && !capRef.current.contains(e.target)) {
        setIsCapOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === 'my-bookings') {

      fetchMyBookings();
    }

  }, [activeTab]);

  useEffect(() => {
    fetchCalendarBookings();

  }, [calendarViewMode, calendarAnchorDate]);

  useEffect(() => {
    if (isModalOpen) {
      setFlexChoice('');
      setConfirmBookingOpen(false);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!changeModalOpen || !bookingToChange || ['TIME', 'NONE'].includes(flexOf(bookingToChange))) {
      setChangeSuggestions({ loading: false, error: '', rooms: [] });
      return undefined;
    }
    let cancelled = false;
    setChangeSuggestions({ loading: true, error: '', rooms: [] });
    const currentId = String(bookingRoomId(bookingToChange));
    const currentRoom = rooms.find((r) => String(r.roomId || r._id) === currentId) || null;
    const minCapacity = Number(
      (typeof bookingToChange.roomId === 'object' && bookingToChange.roomId?.capacity)
      || currentRoom?.capacity
      || 0,
    );
    const branchOf = (r) => String(r?.branchId?._id || r?.branchId || '');
    const currentBranch = branchOf(typeof bookingToChange.roomId === 'object' ? bookingToChange.roomId : null) || branchOf(currentRoom);
    const params = new URLSearchParams({
      from: new Date(bookingToChange.startAt).toISOString(),
      to: new Date(bookingToChange.endAt).toISOString(),
    });
    if (currentBranch) params.set('branchId', currentBranch);
    fetch(`${API_BASE_URL}/rooms/available?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json().then(body => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || body?.message || 'ບໍ່ສາມາດຄົ້ນຫາຫ້ອງວ່າງໄດ້');
        const list = (Array.isArray(body) ? body : body.data || [])
          .filter((r) => String(r.roomId || r._id) !== currentId)
          .filter((r) => Number(r.capacity) >= minCapacity)
          .sort((a, b) => Number(a.capacity) - Number(b.capacity)
            || String(a.name || '').localeCompare(String(b.name || '')));
        if (!cancelled) setChangeSuggestions({ loading: false, error: '', rooms: list });
      })
      .catch((err) => {
        if (!cancelled) setChangeSuggestions({ loading: false, error: err.message || 'ບໍ່ສາມາດຄົ້ນຫາຫ້ອງວ່າງໄດ້', rooms: [] });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeModalOpen, bookingToChange]);

  useEffect(() => {
    if (activeTab !== 'admin' || !canApproveBookings) return;
    const { from, to } = getWeekRange(adminWeek);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    fetch(`${API_BASE_URL}/room-bookings?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setAdminConfirmed(Array.isArray(data) ? data : data.data || []))
      .catch(() => setAdminConfirmed([]));

  }, [activeTab, adminWeek, pendingApprovals]);

  const refreshFromServer = () => {
    fetchRooms(true);
    fetchMaintenance();
    fetchAffected();
    fetchCalendarBookings();
    fetchMyBookings(true);
    if (activeTabRef.current === 'admin') {
      if (canApproveBookings) fetchPendingApprovals(true);
      if (canManageRooms) fetchUtilization(true);
    }
  };
  const refreshRef = useRef(refreshFromServer);
  refreshRef.current = refreshFromServer;

  useEffect(() => {

    let debounceTimer = null;
    const run = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refreshRef.current(), 150);
    };
    const socket = getSocket();
    if (socket) {
      socket.on('room-bookings:changed', run);
      socket.on('room:changed', run);
      socket.on('connect', run);
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, 15000);
    const tick = setInterval(() => setNowTick((n) => n + 1), 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    window.addEventListener('focus', onVisible);

    return () => {
      if (socket) {
        socket.off('room-bookings:changed', run);
        socket.off('room:changed', run);
        socket.off('connect', run);
      }
      clearTimeout(debounceTimer);
      clearInterval(timer);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', onVisible);
    };

  }, [selectedBranchId]);

  const reviewBooking = (id, action, body) => {
    setReviewingId(id);
    return fetch(`${API_BASE_URL}/room-bookings/${id}/${action}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ດຳເນີນການບໍ່ສຳເລັດ');
        }
        fetchPendingApprovals();
        fetchRooms();
        fetchCalendarBookings();
        fetchMyBookings();
        return true;
      })
      .finally(() => setReviewingId(null));
  };

  const openRejectModal = (booking) => {
    setBookingToReject(booking);
    setRejectReason(buildRejectSuggestion(booking));
    setRejectError('');
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setBookingToReject(null);
    setRejectReason('');
    setRejectError('');
  };

  const buildChangeSuggestion = (b, type, suggestedRoom) => {
    if (!b) return '';
    const roomName = b.roomId?.name || 'ຫ້ອງທີ່ຈອງ';
    const clash = blockedBy(b)[0] || conflictWith(b)[0];
    const what = clash?.title ? `"${clash.title}"` : 'ການຈອງອື່ນ';
    // ໃຊ້ເວລາຂອງການຈອງທີ່ຊົ່ວກັນ (clash) ບໍ່ແມ່ນເວລາຂອງຄຳຮ້ອງນີ້ເອງ
    const clashSlot = clash
      ? `${fmtTime(clash.startAt)}–${fmtTime(clash.endAt)}`
      : `${fmtTime(b.startAt)}–${fmtTime(b.endAt)}`;
    const mySlot = `${fmtTime(b.startAt)}–${fmtTime(b.endAt)}`;
    const reason = `ຫ້ອງ${roomName} ມີ${what} ໃຊ້ເວລາ ${clashSlot} ຊົ່ວກັບການຈອງຂອງທ່ານ (${mySlot})`;
    if (type === 'TIME') return `${reason} ກະລຸນາເລື່ອນເວລາໄປຊ່ວງອື່ນ`;
    const hint = suggestedRoom
      ? ` — ແນະນຳ: ຫ້ອງ ${suggestedRoom.name} (ຄວາມຈຸ ${suggestedRoom.capacity} ຄົນ) ວ່າງໃນເວລາ ${mySlot}`
      : '';
    if (type === 'ROOM') return `${reason} ກະລຸນາຍົກເລີກແລ້ວຈອງຫ້ອງອື່ນ${hint}`;
    return `${reason} ກະລຸນາເລື່ອນເວລາ ຫຼື ຍົກເລີກແລ້ວຈອງຫ້ອງອື່ນ${hint}`;
  };

  const openChangeModal = (booking) => {
    const f = flexOf(booking);
    const initType = f === 'BOTH' ? 'EITHER' : f;
    setBookingToChange(booking);
    setChangeType(initType);
    setChangePickedRoomId(null);
    setChangeMessage(buildChangeSuggestion(booking, initType));
    setChangeError('');
    setChangeModalOpen(true);
  };

  const closeChangeModal = () => {
    setChangeModalOpen(false);
    setBookingToChange(null);
    setChangePickedRoomId(null);
    setChangeMessage('');
    setChangeError('');
  };

  const submitChangeRequest = async () => {
    if (!bookingToChange) return;
    if (changeMessage.trim().length < 3) {
      setChangeError('ກະລຸນາໃສ່ຂໍ້ຄວາມຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ');
      return;
    }
    setChangeSubmitting(true);
    setChangeError('');
    try {
      await reviewBooking(bookingToChange._id, 'request-change', {
        type: changeType,
        message: changeMessage.trim(),
        ...(changeType !== 'TIME' && changePickedRoomId ? { suggestedRoomId: changePickedRoomId } : {}),
        ...(changeType !== 'ROOM' && bookingToChange.changeRequestedAt && bookingToChange.changeSuggestedStartAt && bookingToChange.changeSuggestedEndAt
          ? { suggestedStartAt: bookingToChange.changeSuggestedStartAt, suggestedEndAt: bookingToChange.changeSuggestedEndAt }
          : {}),
      });
      closeChangeModal();
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setChangeSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (!bookingToReject) return;
    if (rejectReason.trim().length < 3) {
      setRejectError('ກະລຸນາລະບຸເຫດຜົນການປະຕິເສດຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ');
      return;
    }
    setRejectSubmitting(true);
    setRejectError('');
    try {
      await reviewBooking(bookingToReject._id, 'reject', { reason: rejectReason.trim() });
      closeRejectModal();
    } catch (err) {
      setRejectError(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const applyRoomStatus = (room, nextStatus) => {
    const roomId = room.roomId || room._id;
    setStatusUpdatingRoomId(roomId);

    return fetch(`${API_BASE_URL}/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus }),
    })
      .then(res => {
        if (!res.ok) throw new Error('ອັບເດດສະຖານະຫ້ອງບໍ່ສຳເລັດ');
        return res.json();
      })
      .then(() => {
        fetchRooms();
        fetchAffected();
        fetchCalendarBookings();
      })
      .catch(err => alert(err.message))
      .finally(() => setStatusUpdatingRoomId(null));
  };

  const toggleRoomStatus = async (room) => {
    if (room.status === 'MAINTENANCE') {
      applyRoomStatus(room, 'AVAILABLE');
      return;
    }
    const roomId = room.roomId || room._id;
    setStatusUpdatingRoomId(roomId);
    let affected = [];
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/maintenance-impact`, {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        affected = Array.isArray(data) ? data : data.data || [];
      }
    } catch (err) {
      affected = [];
    }
    setStatusUpdatingRoomId(null);
    if (affected.length === 0) {
      applyRoomStatus(room, 'MAINTENANCE');
      return;
    }
    setMaintenanceError('');
    setMaintenanceDialog({ type: 'close', room, bookings: affected });
  };

  const cancelAffected = async (ids) => {
    setMaintenanceBusy(true);
    setMaintenanceError('');
    try {
      const res = await fetch(`${API_BASE_URL}/room-bookings/maintenance-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids, reason: 'ຫ້ອງປິດບຳລຸງ' }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ຍົກເລີກການຈອງບໍ່ສຳເລັດ');
      }
      fetchAffected();
      fetchCalendarBookings();
      fetchMyBookings(true);
      if (canApproveBookings) fetchPendingApprovals(true);
      return true;
    } catch (err) {
      setMaintenanceError(err.message);
      return false;
    } finally {
      setMaintenanceBusy(false);
    }
  };

  // ແຈ້ງຜູ້ຈອງໃຫ້ປ່ຽນເວລາ / ປ່ຽນຫ້ອງ / ທັງສອງ (ຕາມທີ່ຜູ້ຈອງຕອບຕອນຈອງ) ແທນການຍົກເລີກ
  const requestChangeAffected = async (ids) => {
    setMaintenanceBusy(true);
    setMaintenanceError('');
    try {
      const res = await fetch(`${API_BASE_URL}/room-bookings/maintenance-request-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids, reason: 'ຫ້ອງປິດບຳລຸງ' }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ສົ່ງຄຳຂໍໃຫ້ປ່ຽນບໍ່ສຳເລັດ');
      }
      fetchAffected();
      fetchCalendarBookings();
      fetchMyBookings(true);
      if (canApproveBookings) fetchPendingApprovals(true);
      return true;
    } catch (err) {
      setMaintenanceError(err.message);
      return false;
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const confirmCloseRoom = async (cancelAll, notifyChange = false) => {
    const { room, bookings } = maintenanceDialog;
    if (cancelAll) {
      const ok = await cancelAffected(bookings.map(b => b._id));
      if (!ok) return;
    } else if (notifyChange) {
      const ok = await requestChangeAffected(bookings.map(b => b._id));
      if (!ok) return;
    }
    setMaintenanceDialog(null);
    applyRoomStatus(room, 'MAINTENANCE');
  };

  const roundedNow = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
    return d;
  };

  const openScheduleDialog = (room, win = null) => {
    const now = roundedNow();
    if (win) {
      const ws = new Date(win.startAt);
      setScheduleForm({
        start: toDateTimeLocalValue(ws),
        end: toDateTimeLocalValue(new Date(win.endAt)),
        reason: win.reason || '',
      });
      setCalendarAnchorDate(ws > now ? ws : now);
    } else {
      setScheduleForm({ start: '', end: '', reason: '' });
      setCalendarAnchorDate(now);
    }
    setScheduleImpact([]);
    setMaintenanceError('');
    setMaintPickStart(null);
    setCalendarViewMode('week');
    setMaintenanceDialog({ type: 'schedule', room, editing: win });
  };

  const saveMaintenanceWindow = async () => {
    const { room, editing } = maintenanceDialog;
    const roomId = room.roomId || room._id;
    const s = new Date(scheduleForm.start);
    const e = new Date(scheduleForm.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      setMaintenanceError('ກະລຸນາເລືອກວັນ ແລະ ເວລາເລີ່ມ / ສິ້ນສຸດ');
      return;
    }
    if (e <= s) {
      setMaintenanceError('ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ');
      return;
    }
    if (e.getTime() <= Date.now()) {
      setMaintenanceError('ເວລາສິ້ນສຸດຜ່ານໄປແລ້ວ');
      return;
    }
    setMaintenanceBusy(true);
    setMaintenanceError('');
    try {
      const res = await fetch(
        editing
          ? `${API_BASE_URL}/rooms/maintenance/${editing._id}`
          : `${API_BASE_URL}/rooms/${roomId}/maintenance`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            startAt: s.toISOString(),
            endAt: e.toISOString(),
            reason: editing ? scheduleForm.reason.trim() : (scheduleForm.reason.trim() || undefined),
          }),
        },
      );
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ບັນທຶກການປິດບຳລຸງບໍ່ສຳເລັດ');
      }
      const hadImpact = scheduleImpact.length > 0;
      fetchMaintenance();
      fetchAffected();
      fetchRooms(true);
      fetchCalendarBookings();
      setMaintenanceDialog(hadImpact ? { type: 'review', room } : null);
    } catch (err) {
      setMaintenanceError(err.message);
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const removeMaintenanceWindow = async (w) => {
    if (!window.confirm('ຍົກເລີກການກຳນົດປິດບຳລຸງຊ່ວງເວລານີ້ບໍ?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/maintenance/${w._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || 'ຍົກເລີກບໍ່ສຳເລັດ');
      }
      fetchMaintenance();
      fetchAffected();
      fetchRooms(true);
      fetchCalendarBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (maintenanceDialog?.type !== 'schedule') {
      setScheduleImpact([]);
      return undefined;
    }
    const s = new Date(scheduleForm.start);
    const e = new Date(scheduleForm.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
      setScheduleImpact([]);
      return undefined;
    }
    const roomId = maintenanceDialog.room.roomId || maintenanceDialog.room._id;
    const from = s > new Date() ? s : new Date();
    const params = new URLSearchParams({ from: from.toISOString(), to: e.toISOString() });
    let stale = false;
    fetch(`${API_BASE_URL}/rooms/${roomId}/maintenance-impact?${params.toString()}`, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (!stale) setScheduleImpact(Array.isArray(data) ? data : []); })
      .catch(() => { if (!stale) setScheduleImpact([]); });
    return () => { stale = true; };
  }, [maintenanceDialog?.type, maintenanceDialog?.room, scheduleForm.start, scheduleForm.end]);

  const WORK_START_HOUR = 8;
  const WORK_END_HOUR = 17;

  const isOutsideWorkingHours = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const hour = d.getHours();
    const minutes = d.getMinutes();

    if (hour < WORK_START_HOUR) return true;
    if (hour > WORK_END_HOUR) return true;
    if (hour === WORK_END_HOUR && minutes > 0) return true;
    return false;
  };

  const AVAIL_START_MIN = 8 * 60;
  const AVAIL_END_MIN = 17 * 60;
  const AVAIL_STEP = 30;
  const AVAIL_HOUR_LABELS = Array.from({ length: (AVAIL_END_MIN - AVAIL_START_MIN) / 60 + 1 }, (_, i) => 8 + i);

  const availDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const availMinAllowed = () => {
    if (!availDate) return AVAIL_START_MIN;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (availDate < todayKey) return AVAIL_END_MIN;
    if (availDate > todayKey) return AVAIL_START_MIN;
    return Math.max(AVAIL_START_MIN, Math.ceil((now.getHours() * 60 + now.getMinutes()) / AVAIL_STEP) * AVAIL_STEP);
  };

  const handleAvailSlider = (which, value) => {
    const v = Number(value);
    setAvailRange(prev => {
      if (which === 'start') {
        const start = Math.min(Math.max(v, availMinAllowed()), prev.end - AVAIL_STEP);
        return { ...prev, start: Math.min(start, AVAIL_END_MIN - AVAIL_STEP) };
      }
      return { ...prev, end: Math.max(v, prev.start + AVAIL_STEP) };
    });
  };

  useEffect(() => {
    if (!isAvailOpen || !availDate) return undefined;
    const allowed = availMinAllowed();
    if (allowed >= AVAIL_END_MIN) {
      setAvailRooms(null); setAvailFrom(''); setAvailTo('');
      setAvailError('ວັນທີນີ້ຜ່ານໄປແລ້ວ ກະລຸນາເລືອກວັນທີອື່ນ');
      return undefined;
    }
    const start = Math.max(availRange.start, allowed);
    const end = Math.max(availRange.end, start + AVAIL_STEP);
    const t = setTimeout(() => {
      const fromVal = `${availDate}T${fmtMin(start)}`;
      const toVal = `${availDate}T${fmtMin(end)}`;
      setAvailFrom(fromVal);
      setAvailTo(toVal);
      searchAvailable(fromVal, toVal);
    }, 400);
    return () => clearTimeout(t);

  }, [availDate, availRange.start, availRange.end, isAvailOpen]);

  const clearAvailFilter = () => {
    setAvailDate('');
    setAvailFrom('');
    setAvailTo('');
    setAvailRooms(null);
    setAvailError('');
  };

  const searchAvailable = (fromVal, toVal) => {
    setAvailLoading(true);
    setAvailError('');
    const params = new URLSearchParams({
      from: new Date(fromVal).toISOString(),
      to: new Date(toVal).toISOString(),
    });
    if (selectedBranchId) params.set('branchId', selectedBranchId);
    fetch(`${API_BASE_URL}/rooms/available?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json().then(body => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.msg || body?.message || 'ບໍ່ສາມາດຄົ້ນຫາຫ້ອງວ່າງໄດ້');
        setAvailRooms(Array.isArray(body) ? body : body.data || []);
      })
      .catch(err => { setAvailError(err.message || 'ບໍ່ສາມາດຄົ້ນຫາຫ້ອງວ່າງໄດ້'); setAvailRooms(null); })
      .finally(() => setAvailLoading(false));
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();

    if (!startAt || !endAt) {
      setBookingMessage({ type: 'error', text: 'ກະລຸນາເລືອກເວລາໂດຍກົດຈຸດເລີ່ມ ແລະ ຈຸດສິ້ນສຸດໃນຕາຕະລາງ' });
      return;
    }

    if (new Date(startAt).getTime() < new Date().getTime()) {
      setBookingMessage({ type: 'error', text: 'ເວລາເລີ່ມຕົ້ນໄດ້ຜ່ານໄປແລ້ວ ກະລຸນາເລືອກເວລາໃໝ່' });
      return;
    }

    if (new Date(startAt) >= new Date(endAt)) {
      setBookingMessage({ type: 'error', text: 'ເວລາເລີ່ມຕົ້ນຕ້ອງກ່ອນເວລາສິ້ນສຸດສະເໝີ' });
      return;
    }

    if (isOutsideWorkingHours(startAt) || isOutsideWorkingHours(endAt)) {
      setBookingMessage({
        type: 'error',
        text: `ກະລຸນາເລືອກເວລາຢູ່ໃນຊ່ວງເວລາທຳການ 08:00 - 17:00 ເທົ່ານັ້ນ (ກວດເບິ່ງວ່າເລືອກ AM/PM ຖືກຕ້ອງແລ້ວບໍ່)`,
      });
      return;
    }

    if (!flexChoice) {
      setBookingMessage({ type: 'error', text: 'ກະລຸນາເລືອກຄຳຕອບ: ຖ້າເວລາທີ່ຂໍຈອງຊົ່ວກັບຄຳຮ້ອງອື່ນ ທ່ານສາມາດປ່ຽນຫຍັງໄດ້?' });
      return;
    }

    setBookingMessage({ type: '', text: '' });
    setConfirmBookingOpen(true);
  };

  const flexValue = () => flexChoice;
  const flexOf = (b) => (b && b.changeFlexibility) || 'BOTH';
  const flexLabel = (f) => (f === 'NONE' ? 'ບໍ່ສາມາດປ່ຽນໄດ້ (None)' : f === 'TIME' ? 'ປ່ຽນໄດ້ສະເພາະເວລາ' : f === 'ROOM' ? 'ປ່ຽນໄດ້ສະເພາະຫ້ອງ' : 'ປ່ຽນໄດ້ທັງເວລາ ແລະ ຫ້ອງ');
  const canMoveTime = (b) => ['TIME', 'BOTH'].includes(flexOf(b));

  const performBookingSubmit = () => {
    setSubmitting(true);
    setBookingMessage({ type: '', text: '' });

    const payload = {
      roomId: selectedRoom,
      title: meetingTitle,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      changeFlexibility: flexValue(),
    };

    if (isRecurring && untilDate) {
      payload.recurrence = {
        frequency: frequency,
        until: new Date(untilDate).toISOString()
      };
    }

    fetch(`${API_BASE_URL}/room-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'ເກີດຂໍ້ຜິດພາດໃນການຈອງ');
        return result;
      })
      .then(() => {
        setSubmitting(false);
        setConfirmBookingOpen(false);
        setBookingMessage({ type: 'success', text: 'ສົ່ງຄຳຮ້ອງຂໍຈອງຫ້ອງປະຊຸມແລ້ວ — ລໍຖ້າຜູ້ມີສິດອະນຸມັດ' });

        const bookedRoom = rooms.find(r => (r.roomId || r._id) === payload.roomId);
        if (bookedRoom) {
          setSelectedRoomIds(prev => {
            const id = bookedRoom.roomId || bookedRoom._id;
            return prev.includes(id) ? prev : [...prev, id];
          });
        }
        fetchCalendarBookings();

        if (activeTab === 'my-bookings') {
          fetchMyBookings();
        }

        setTimeout(() => {
          setIsModalOpen(false);
          setBookingMessage({ type: '', text: '' });
          setSelectedRoom('');
          setMeetingTitle('');
          setStartAt('');
          setEndAt('');
          setIsRecurring(false);
          setFrequency('weekly');
          setUntilDate('');
        }, 1200);
      })
      .catch(err => {
        setSubmitting(false);
        setConfirmBookingOpen(false);
        setBookingMessage({ type: 'error', text: err.message });
      });
  };

  const [reportBusy, setReportBusy] = useState('');
  const [reportError, setReportError] = useState('');
  const downloadMeetingReport = async (booking, kind) => {
    const id = booking._id;
    setReportBusy(kind);
    setReportError('');
    try {
      const res = await fetch(`${API_BASE_URL}/room-bookings/${id}/invite/attendance.${kind}`, {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const m = j.msg ?? j.message;
        throw new Error((Array.isArray(m) ? m.join(', ') : m) || 'ດາວໂຫຼດລາຍງານບໍ່ສຳເລັດ');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `meeting-summary-${id}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportBusy('');
    }
  };

  const handleCancelBooking = (id) => {
    if (!window.confirm('ທ່ານຕ້ອງການຍົກເລີກການຈອງນີ້ແທ້ບໍ?')) return;

    fetch(`${API_BASE_URL}/room-bookings/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ບໍ່ສາມາດຍົກເລີກການຈອງໄດ້');
        }
        fetchMyBookings();
        fetchCalendarBookings();
      })
      .catch(err => alert(err.message));
  };

  const handleCancelSeries = (seriesId) => {
    if (!window.confirm('ການຈອງນີ້ແມ່ນສ່ວນໜຶ່ງຂອງການຈອງແບບຊ້ຳ — ຕ້ອງການຍົກເລີກທັງໝົດທຸກຄັ້ງໃນຊຸດນີ້ແທ້ບໍ?')) return;

    fetch(`${API_BASE_URL}/room-bookings/series/${seriesId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.message || 'ບໍ່ສາມາດຍົກເລີກຊຸດການຈອງໄດ້');
        }
        fetchMyBookings();
        fetchCalendarBookings();
      })
      .catch(err => alert(err.message));
  };

  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    if (!currentBookingToReschedule) return;

    if (new Date(newStartAt) >= new Date(newEndAt)) {
      alert('ເວລາເລີ່ມຕົ້ນໃໝ່ຕ້ອງກ່ອນເວລາສິ້ນສຸດໃໝ່');
      return;
    }

    const payload = {
      startAt: new Date(newStartAt).toISOString(),
      endAt: new Date(newEndAt).toISOString(),
      ...(rescheduleRoomId && rescheduleRoomId !== String(bookingRoomId(currentBookingToReschedule))
        ? { roomId: rescheduleRoomId }
        : {}),
    };

    fetch(`${API_BASE_URL}/room-bookings/${currentBookingToReschedule._id}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'ບໍ່ສາມາດເລື່ອນເວລາໄດ້');
        return result;
      })
      .then((result) => {
        setRescheduleModalOpen(false);
        setCurrentBookingToReschedule(null);
        setReschedulePickStart(null);
        fetchMyBookings();
        fetchCalendarBookings();

        const needsRescheduleApproval = !!result?.pendingStartAt || result?.status === 'PENDING';
        alert(needsRescheduleApproval
          ? 'ສົ່ງຄຳຮ້ອງປ່ຽນເວລາ/ຫ້ອງແລ້ວ — ລໍຖ້າຜູ້ມີສິດອະນຸມັດ'
          : 'ເລື່ອນເວລາຈອງສຳເລັດແລ້ວ!');
      })
      .catch(err => alert(err.message));
  };

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ];
  const SLOT_MINUTES = 30;

  const hourHeaderSlots = timeSlots.filter(t => t.endsWith(':00'));
  const SLOT_COLS = timeSlots.length + 1;

  const slotPos = (d) => {
    const m = d.getHours() * 60 + d.getMinutes();
    if (m <= 480) return 0;
    if (m <= 720) return (m - 480) / SLOT_MINUTES;
    if (m < 780) return 8;
    return Math.min(16, 8 + (m - 780) / SLOT_MINUTES);
  };
  const weekDays = [
    { key: 'mon', label: 'ຈັນ', dayIndex: 1 },
    { key: 'tue', label: 'ອັງຄານ', dayIndex: 2 },
    { key: 'wed', label: 'ພຸດ', dayIndex: 3 },
    { key: 'thu', label: 'ພະຫັດ', dayIndex: 4 },
    { key: 'fri', label: 'ສຸກ', dayIndex: 5 },
  ];

  const bookingStatusInfo = (status) => {
    switch (status) {
      case 'PENDING': return { label: 'ລໍຖ້າອະນຸມັດ', className: 'bg-amber-100 text-amber-700' };
      case 'CONFIRMED': return { label: 'ອະນຸມັດແລ້ວ', className: 'bg-green-100 text-green-700' };
      case 'REJECTED': return { label: 'ຖືກປະຕິເສດ', className: 'bg-red-100 text-red-700' };
      case 'CANCELLED': return { label: 'ຍົກເລີກແລ້ວ', className: 'bg-gray-100 text-gray-600' };
      default: return { label: status || 'ອະນຸມັດແລ້ວ', className: 'bg-green-100 text-green-700' };
    }
  };

  const isBookingPast = (b) => {
    if (!b?.endAt) return false;
    if (b.checkedOutAt) return true;
    return new Date(b.endAt).getTime() <= new Date().getTime();
  };

  const bookingHistoryInfo = (action) => {
    switch (action) {
      case 'CREATED': return { label: 'ສ້າງການຈອງ', dot: 'bg-gray-400' };
      case 'APPROVED': return { label: 'ອະນຸມັດການຈອງ', dot: 'bg-green-500' };
      case 'REJECTED': return { label: 'ປະຕິເສດການຈອງ', dot: 'bg-red-500' };
      case 'RESCHEDULE_REQUESTED': return { label: 'ຂໍເລື່ອນເວລາ', dot: 'bg-sky-500' };
      case 'REQUEST_UPDATED': return { label: 'ແກ້ໄຂຄຳຮ້ອງຈອງ', dot: 'bg-sky-400' };
      case 'RESCHEDULE_APPROVED': return { label: 'ອະນຸມັດການເລື່ອນເວລາ', dot: 'bg-green-500' };
      case 'RESCHEDULE_REJECTED': return { label: 'ປະຕິເສດການເລື່ອນເວລາ', dot: 'bg-red-500' };
      case 'CANCELLED': return { label: 'ຍົກເລີກການຈອງ', dot: 'bg-gray-500' };
      case 'NO_SHOW': return { label: 'ຍົກເລີກອັດຕະໂນມັດ (ບໍ່ check-in)', dot: 'bg-orange-500' };
      case 'CHECKED_IN': return { label: 'Check-in ເຂົ້າຫ້ອງ', dot: 'bg-emerald-500' };
      case 'CHECKED_OUT': return { label: 'Check-out ອອກຈາກຫ້ອງ', dot: 'bg-gray-400' };
      default: return { label: action || 'ປ່ຽນແປງ', dot: 'bg-gray-400' };
    }
  };

  const buildBookingTimeline = (b) => {
    const actorName = (a) => {
      if (!a || typeof a !== 'object') return '';
      return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || '';
    };
    const entries = Array.isArray(b?.history) ? b.history.map((e) => ({ ...e })) : [];
    if (entries.length === 0) {
      if (b?.createdAt) {
        entries.push({ action: 'CREATED', toStartAt: b.startAt, toEndAt: b.endAt, at: b.createdAt });
      }
      if (b?.pendingStartAt && b?.pendingEndAt) {
        entries.push({
          action: 'RESCHEDULE_REQUESTED',
          fromStartAt: b.startAt,
          fromEndAt: b.endAt,
          toStartAt: b.pendingStartAt,
          toEndAt: b.pendingEndAt,
          at: b.pendingRequestedAt || b.updatedAt,
        });
      } else if (b?.rescheduleRejectionReason) {
        entries.push({
          action: 'RESCHEDULE_REJECTED',
          fromStartAt: b.startAt,
          fromEndAt: b.endAt,
          note: b.rescheduleRejectionReason,
          at: b.updatedAt,
        });
      }
      if (b?.status === 'REJECTED' && b?.rejectionReason) {
        entries.push({ action: 'REJECTED', note: b.rejectionReason, at: b.reviewedAt || b.updatedAt });
      }
      if (b?.status === 'CANCELLED') {
        entries.push({ action: 'CANCELLED', note: b.rejectionReason, at: b.reviewedAt || b.updatedAt });
      }
      if (b?.checkedInAt) entries.push({ action: 'CHECKED_IN', at: b.checkedInAt });
      if (b?.checkedOutAt) entries.push({ action: 'CHECKED_OUT', at: b.checkedOutAt });
    }
    entries.sort((x, y) => new Date(x.at || 0).getTime() - new Date(y.at || 0).getTime());

    const stillPending = !!b?.pendingStartAt;
    return entries.map((e, idx) => ({
      ...e,
      actor: actorName(e.actorId),
      isPending:
        stillPending &&
        idx === entries.length - 1 &&
        (e.action === 'RESCHEDULE_REQUESTED' || e.action === 'REQUEST_UPDATED'),
    }));
  };

  const detailTimeline = detailBooking ? buildBookingTimeline(detailBooking) : [];

  const roomStatusLabel = (status) => {
    switch (status) {
      case 'BOOKED': return 'ກຳລັງໃຊ້ງານ';
      case 'MAINTENANCE': return 'ປິດບຳລຸງ';
      case 'AVAILABLE':
      default: return 'ວ່າງ';
    }
  };

  const UNASSIGNED_FLOOR = 'ບໍ່ລະບຸຊັ້ນ';

  const splitRoomLocation = (room) => {
    const explicitFloor = String(room.floor || '').trim();
    const parts = String(room.location || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (explicitFloor) {

      const floorIsRepeated = parts.length > 1 && parts[0].toLowerCase() === explicitFloor.toLowerCase();
      return {
        floor: explicitFloor,
        spot: (floorIsRepeated ? parts.slice(1) : parts).join(', '),
      };
    }

    return {
      floor: parts[0] || UNASSIGNED_FLOOR,
      spot: parts.slice(1).join(', '),
    };
  };

  const roomFloor = (room) => splitRoomLocation(room).floor;
  const roomSpot = (room) => splitRoomLocation(room).spot;

  const roomBookerLabel = (booker) => {
    if (!booker) return 'ຜູ້ໃຊ້ອື່ນ';
    const name = [booker.firstName, booker.lastName].filter(Boolean).join(' ').trim();
    return name || booker.email || 'ຜູ້ໃຊ້ອື່ນ';
  };

  const spotsForFloors = (floorList) => {
    const source = floorList.length > 0
      ? rooms.filter((room) => floorList.includes(roomFloor(room)))
      : rooms;
    return new Set(source.map(roomSpot).filter(Boolean));
  };

  const availableFloors = [...new Set(rooms.map(roomFloor).filter(Boolean))].sort();
  const availableLocations = [...spotsForFloors(floorFilter)].sort();
  const capActive = capMin !== '' || capMax !== '';
  const activeLocationFilterCount = floorFilter.length + locationFilter.length + (capActive ? 1 : 0);
  const capLabel = !capActive
    ? 'ຄວາມຈຸ'
    : (capMin !== '' && capMax !== '')
      ? `${capMin}–${capMax} ຄົນ`
      : capMin !== '' ? `≥ ${capMin} ຄົນ` : `≤ ${capMax} ຄົນ`;
  const CAP_PRESETS = [
    { label: '1–5', min: '1', max: '5' },
    { label: '6–10', min: '6', max: '10' },
    { label: '11–20', min: '11', max: '20' },
    { label: '20+', min: '20', max: '' },
  ];

  const openCreateRoomModal = () => {
    setRoomForm({
      name: '',
      branchId: selectedBranchId || '',
      floor: '',
      location: '',
      capacity: 10,
      amenities: '',
    });
    setRoomFormError('');
    setIsRoomModalOpen(true);
  };

  const handleRoomInputChange = (e) => {
    const { name, value } = e.target;
    setRoomForm((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? Number(value) : value,
    }));
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomForm.branchId) {
      setRoomFormError('ກະລຸນາເລືອກສາຂາກ່ອນສາຂາທີ່ຈະສ້າງຫ້ອງ');
      return;
    }
    if (!Number.isInteger(roomForm.capacity) || roomForm.capacity < 1) {
      setRoomFormError('ຄວາມຈຸຕ້ອງເປັນຈຳນວນທີ່ເປັນຈຳນວນລົບ ແລະ ຕ້ອງແກນ 1 ຂຶ້ນໄປ');
      return;
    }

    setRoomSubmitting(true);
    setRoomFormError('');
    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId: roomForm.branchId,
          name: roomForm.name,
          floor: roomForm.floor || undefined,
          location: roomForm.location || undefined,
          capacity: roomForm.capacity,
          amenities: roomForm.amenities
            ? roomForm.amenities.split(/[;,]+/).map((a) => a.trim()).filter(Boolean)
            : undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || 'ເພີ່ມຫ້ອງບໍ່ສຳເລັດ');
      setIsRoomModalOpen(false);
      fetchRooms();
    } catch (err) {
      setRoomFormError(err.message || 'ເພີ່ມຫ້ອງບໍ່ສຳເລັດ');
    } finally {
      setRoomSubmitting(false);
    }
  };

  const toggleFloorFilter = (floor) => {
    const next = floorFilter.includes(floor)
      ? floorFilter.filter((f) => f !== floor)
      : [...floorFilter, floor];
    setFloorFilter(next);

    const validSpots = spotsForFloors(next);
    setLocationFilter((prev) => prev.filter((s) => validSpots.has(s)));
  };

  const toggleLocationFilter = (spot) => {
    setLocationFilter((prev) => (prev.includes(spot) ? prev.filter((s) => s !== spot) : [...prev, spot]));
  };

  const clearLocationFilters = () => {
    setFloorFilter([]);
    setLocationFilter([]);
    setCapMin('');
    setCapMax('');
  };

  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q
      || [room.name, String(room.roomId || room._id || ''), room.location, room.floor]
        .filter((f) => typeof f === 'string' && f)
        .some((f) => f.toLowerCase().includes(q));
    const matchesFloor = floorFilter.length === 0 || floorFilter.includes(roomFloor(room));
    const matchesLocation = locationFilter.length === 0 || locationFilter.includes(roomSpot(room));
    const roomCap = Number(room.capacity);
    const matchesCapacity = (capMin === '' || roomCap >= Number(capMin))
      && (capMax === '' || roomCap <= Number(capMax));
    const matchesAvailability = !availRooms
      || availRooms.some((ar) => String(ar.roomId || ar._id) === String(room.roomId || room._id));
    return matchesSearch && matchesFloor && matchesLocation && matchesCapacity && matchesAvailability;
  });

  const calendarRooms = selectedRoomIds.length === 0
    ? filteredRooms
    : filteredRooms.filter((room) => selectedRoomIds.includes(room.roomId || room._id));

  const toggleCalendarRoom = (room) => {
    const id = room.roomId || room._id;
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const bookingRoomId = (b) => (
    typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId
  );

  const selectPendingRequest = (b) => {
    setAdminSelectedId(b._id);
    setAdminRoomId(String(bookingRoomId(b)));
    setAdminWeek(new Date(b.startAt));
  };

  const conflictWith = (b) => b.conflictWith || [];
  const blockedBy = (b) => b.blockedBy || [];

  const pendingBlockedCount = pendingApprovals.filter((b) => blockedBy(b).length > 0).length;
  const pendingConflictCount = pendingApprovals.filter((b) => conflictWith(b).length > 0).length;

  const conflictDetailText = (b) => {
    const who = (o) => o.bookedBy?.firstName || o.bookedBy?.email || 'ບໍ່ລະບຸຜູ້ຈອງ';
    return [
      ...blockedBy(b).map((o) => `"${o.title || 'ບໍ່ມີຫົວຂໍ້'}" ຢູ່ໃນເວລາທີ່ CONFIRMED ແລ້ວ (${fmtTime(o.startAt)}–${fmtTime(o.endAt)})`),
      ...conflictWith(b).map((o) => `"${o.title || 'ບໍ່ມີຫົວຂໍ້'}" ຂອງ ${who(o)} (${fmtTime(o.startAt)}–${fmtTime(o.endAt)})`),
    ].join('  •  ');
  };

  const roomForBooking = (b) => {
    const id = String(bookingRoomId(b));
    return rooms.find((r) => String(r.roomId || r._id) === id) || null;
  };
  const bookingRoomLabel = (b) => {
    const id = String(bookingRoomId(b));
    const room = roomForBooking(b);
    if (room) return `${room.name} (${id})`;
    return id || 'ບໍ່ລະບຸຫ້ອງ';
  };

  const showBookingNote = (e, booking) => {
    const r = e.currentTarget.getBoundingClientRect();
    setBookingNote({
      booking,
      rect: { left: r.left, top: r.top, bottom: r.bottom },
    });
  };
  const hideBookingNote = () => setBookingNote(null);

  const bookingNoteStyle = (rect) => {
    const width = 256;
    const margin = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    let left = rect.left;
    if (left + width + margin > vw) left = vw - width - margin;
    if (left < margin) left = margin;

    if (rect.top < 220) return { left, top: rect.bottom + margin };
    return { left, top: rect.top - margin, transform: 'translateY(-100%)' };
  };

  const fmtTime = (d) => {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const buildRejectSuggestion = (b) => {
    if (!b) return '';
    const slot = `${fmtTime(b.startAt)}–${fmtTime(b.endAt)}`;
    const roomName = b.roomId?.name || 'ຫ້ອງທີ່ຈອງ';

    if (blockedBy(b).length > 0) {
      const clash = blockedBy(b)[0];
      const what = clash.title ? `"${clash.title}"` : 'ການຈອງອື່ນ';
      return `ຫ້ອງ${roomName} ມີ${what} ຈອງໄວ້ແລ້ວໃນເວລາ ${slot} ຈຶ່ງບໍ່ສາມາຖອະນຸມັດ ກະລຸນາເລື່ອນເວລາ ຫຼື ເລືອກຫ້ອງອື່ນ`;
    }

    if (conflictWith(b).length > 0) {
      const n = conflictWith(b).length;
      return `ຫ້ອງ${roomName} ມີຄຳຮ້ອງອື່ນ ${n} ລາຍການໃຊ້ເວລາ ${slot} ຊົ່ວກັນ ຈຶ່ງບໍ່ສາມາຖອະນຸມັດ ກະລຸນາເລື່ອນເວລາ ຫຼື ເລືອກຫ້ອງອື່ນ`;
    }

    return '';
  };

  const computeLanes = (items) => {
    const sorted = items
      .map((item, i) => ({ i, start: item.start.getTime(), end: item.end.getTime() }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnds = [];
    const assigned = new Array(items.length);
    for (const s of sorted) {
      let placed = -1;
      for (let l = 0; l < laneEnds.length; l++) {
        if (laneEnds[l] <= s.start) { placed = l; break; }
      }
      if (placed === -1) {
        placed = laneEnds.length;
        laneEnds.push(s.end);
      } else {
        laneEnds[placed] = s.end;
      }
      assigned[s.i] = placed;
    }
    return assigned;
  };

  const MAINT_HATCH = 'repeating-linear-gradient(45deg, rgba(249,115,22,0.2) 0, rgba(249,115,22,0.2) 4px, transparent 4px, transparent 8px)';
  const FAR_FUTURE_MS = 10 * 365 * 24 * 60 * 60000;

  const allMaintenanceWindows = () => {
    const now = new Date();
    const closedNow = rooms
      .filter(r => r.status === 'MAINTENANCE')
      .map(r => ({
        _id: `closed-${String(r.roomId || r._id)}`,
        roomId: String(r.roomId || r._id),
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + FAR_FUTURE_MS).toISOString(),
        reason: '',
        instant: true,
      }));
    return [...maintenanceWindows, ...closedNow];
  };

  const maintenanceSegments = (rangeFrom, rangeTo) => {
    const out = [];
    allMaintenanceWindows().forEach(w => {
      const ws = new Date(w.startAt);
      const we = new Date(w.endAt);
      const day = new Date(Math.max(ws.getTime(), rangeFrom.getTime()));
      day.setHours(0, 0, 0, 0);
      while (day <= rangeTo && day < we) {
        const dayStart = new Date(day);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        const segStart = ws > dayStart ? ws : dayStart;
        const segEnd = we < dayEnd ? we : dayEnd;
        if (segEnd > segStart) {
          out.push({
            _id: `${w._id}@${dayStart.getTime()}`,
            windowId: String(w._id),
            isMaintenance: true,
            status: 'CONFIRMED',
            roomId: w.roomId,
            title: 'Maintenance',
            startAt: segStart.toISOString(),
            endAt: segEnd.toISOString(),
            reason: w.reason,
            windowStartAt: w.startAt,
            windowEndAt: w.endAt,
            instant: !!w.instant,
          });
        }
        day.setDate(day.getDate() + 1);
      }
    });
    return out;
  };

  const calendarWeekRange = getWeekRange(calendarAnchorDate);
  const calendarItems = [
    ...calendarBookings,
    ...maintenanceSegments(calendarWeekRange.from, calendarWeekRange.to),
  ];

  const renderCalendarPanel = (shownRooms, { selectedCount, onShowAll }) => {
    if (shownRooms.length === 0) return null;
    const shownIds = new Set(shownRooms.map(r => String(r.roomId || r._id)));
    const isIn = (b) => shownIds.has(String(bookingRoomId(b)));
    const dayViewBookings = calendarItems
      .filter(b => isIn(b) && new Date(b.startAt).getDay() === calendarAnchorDate.getDay())
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)
        || bookingRoomLabel(a).localeCompare(bookingRoomLabel(b)));
    const dayViewLaneOf = computeLanes(dayViewBookings.map(b => ({
      start: new Date(b.startAt),
      end: new Date(b.endAt),
    })));
    const dayViewMaxLanes = dayViewBookings.length ? (Math.max(...dayViewLaneOf) + 1) : 1;
    const boxClass = (b) => {
      if (!b.isMaintenance) return 'bg-amber-50 border border-amber-200 text-amber-800 font-medium';
      return selectedMaintId && b.windowId === selectedMaintId
        ? 'bg-orange-300 border-2 border-orange-600 text-orange-950 font-bold ring-2 ring-orange-400/60 shadow-md cursor-pointer'
        : 'bg-orange-100 border border-orange-400 text-orange-800 font-semibold cursor-pointer hover:bg-orange-200';
    };
    const onBoxClick = (b) => {
      if (!b.isMaintenance) return;
      setSelectedMaintId(prev => (prev === b.windowId ? null : b.windowId));
    };
    return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="font-bold text-gray-800 text-base">
                    {calendarViewMode === 'day' ? 'ປະຕິທິນລາຍວັນ' : 'ປະຕິທິນອາທິດ'} —{' '}
                    {selectedCount === 0
                      ? `${shownRooms.length} ຫ້ອງ (ທັງໝົດ)`
                      : shownRooms.map(r => r.name).join(', ')}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">

                    {selectedCount > 0 && (
                      <button
                        onClick={onShowAll}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ສະແດງທຸກຫ້ອງ
                      </button>
                    )}

                    <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-medium">
                      <button
                        onClick={() => setCalendarViewMode('week')}
                        className={`px-3 py-1.5 ${calendarViewMode === 'week' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        ອາທິດ
                      </button>
                      <button
                        onClick={() => setCalendarViewMode('day')}
                        className={`px-3 py-1.5 border-l border-gray-200 ${calendarViewMode === 'day' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        ວັນ
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const next = new Date(calendarAnchorDate);
                          next.setDate(next.getDate() - (calendarViewMode === 'day' ? 1 : 7));
                          setCalendarAnchorDate(next);
                        }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => setCalendarAnchorDate(new Date())}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        {calendarViewMode === 'day' ? 'ມື້ນີ້' : 'ອາທິດນີ້'}
                      </button>
                      <button
                        onClick={() => {
                          const next = new Date(calendarAnchorDate);
                          next.setDate(next.getDate() + (calendarViewMode === 'day' ? 1 : 7));
                          setCalendarAnchorDate(next);
                        }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {calendarViewMode === 'week' ? (
                    <>
                      <div className="min-w-[1100px] border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 text-center py-2.5" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                        <div>ວັນ / ເວລາ</div>
                        {hourHeaderSlots.map(time => (
                          <div key={time} className="text-left pl-1 border-l border-gray-300" style={{ gridColumn: 'span 2' }}>{time}</div>
                        ))}
                      </div>

                      <div className="divide-y divide-gray-100">
                        {weekDays.map(day => {
                          const dayDate = new Date(getWeekRange(calendarAnchorDate).from);
                          dayDate.setDate(dayDate.getDate() + (day.dayIndex - 1));

                          const dayBookings = calendarItems
                            .filter(b => isIn(b) && new Date(b.startAt).getDay() === day.dayIndex)
                            .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)
                              || bookingRoomLabel(a).localeCompare(bookingRoomLabel(b)));

                          const laneOf = computeLanes(dayBookings.map(b => ({
                            start: new Date(b.startAt),
                            end: new Date(b.endAt),
                          })));
                          const maxLanes = dayBookings.length ? (Math.max(...laneOf) + 1) : 0;
                          const rowHeight = Math.max(56, 4 + maxLanes * 26 + 4);

                          return (
                            <div key={day.key} className="min-w-[1100px] relative" style={{ height: rowHeight }}>

                              <div className="absolute inset-0 text-xs text-gray-500" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                                <div className="text-center font-medium text-gray-400 border-r border-gray-300 py-1 flex flex-col items-center justify-center gap-0.5">
                                  <span>{day.label}</span>
                                  <span className="text-[10px] font-normal text-gray-400">
                                    {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {timeSlots.map(time => (
                                  <div key={time} className={`border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'}`} />
                                ))}
                              </div>

                              {dayBookings.map((booking, idx) => {
                                const startPos = slotPos(new Date(booking.startAt));
                                const span = slotPos(new Date(booking.endAt)) - startPos;
                                if (span <= 0) return null;
                                return (
                                  <div
                                    key={booking._id || idx}
                                    className={`absolute px-1.5 rounded text-[10px] truncate z-10 flex items-center ${boxClass(booking)}`}
                                    style={{
                                      left: `calc(${(1 + startPos) * (100 / SLOT_COLS)}% + 2px)`,
                                      width: `calc(${span * (100 / SLOT_COLS)}% - 4px)`,
                                      top: 4 + laneOf[idx] * 26,
                                      height: 22,
                                      lineHeight: '20px',
                                      ...(booking.isMaintenance ? { backgroundImage: MAINT_HATCH } : {}),
                                    }}
                                    onClick={() => onBoxClick(booking)}
                                    onMouseEnter={(e) => showBookingNote(e, booking)}
                                    onMouseLeave={hideBookingNote}
                                  >
                                    {booking.isMaintenance ? `🔧 ${bookingRoomLabel(booking)} · Maintenance` : `${bookingRoomLabel(booking)} · ${booking.title || 'ບໍ່ມີຫົວຂໍ້'}`}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>

                      <div className="min-w-[300px] grid grid-cols-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 text-center py-2.5">
                        <div>ເວລາ</div>
                        <div>{calendarAnchorDate.toLocaleDateString('lo-LA', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                      </div>

                      <div className="relative">
                        <div>
                          {timeSlots.map(time => (
                            <div key={time} className={`min-w-[300px] grid grid-cols-2 text-xs text-gray-500 h-[30px] border-b ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'}`}>
                              <div className="text-center font-medium text-gray-400 border-r border-gray-100 py-1.5">
                                {time.endsWith(':00') ? time : ''}
                              </div>
                              <div className="border-r border-gray-100" />
                            </div>
                          ))}
                        </div>

                        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none">
                          {dayViewBookings.map((booking, idx) => {
                            const startPos = slotPos(new Date(booking.startAt));
                            const span = slotPos(new Date(booking.endAt)) - startPos;
                            if (span <= 0) return null;
                            const lane = dayViewLaneOf[idx];
                            return (
                              <div
                                key={booking._id || idx}
                                className={`absolute px-1.5 rounded text-[10px] truncate pointer-events-auto flex items-center ${boxClass(booking)}`}
                                style={{
                                  top: startPos * 30 + 2,
                                  height: Math.max(span * 30 - 4, 14),
                                  left: `calc(${lane} * ${100 / dayViewMaxLanes}% + 4px)`,
                                  width: `calc(${100 / dayViewMaxLanes}% - 8px)`,
                                  ...(booking.isMaintenance ? { backgroundImage: MAINT_HATCH } : {}),
                                }}
                                onClick={() => onBoxClick(booking)}
                                onMouseEnter={(e) => showBookingNote(e, booking)}
                                onMouseLeave={hideBookingNote}
                              >
                                {booking.isMaintenance ? `🔧 ${bookingRoomLabel(booking)} · Maintenance` : `${bookingRoomLabel(booking)} · ${booking.title || 'ບໍ່ມີຫົວຂໍ້'}`}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
    );
  };

  const toDateTimeLocalValue = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getSlotDateTime = (dayIndex, time) => {
    const base = new Date(getWeekRange(calendarAnchorDate).from);
    base.setDate(base.getDate() + (dayIndex - 1));
    const [h, m] = time.split(':').map(Number);
    base.setHours(h, m, 0, 0);
    return base;
  };

  const NOW_BUFFER_MIN = 15;
  const getEarliestStart = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return new Date(d.getTime() + NOW_BUFFER_MIN * 60000);
  };

  const isSlotInPast = (dayIndex, time) => {
    const slotEnd = addMinutes(getSlotDateTime(dayIndex, time), SLOT_MINUTES);
    return slotEnd.getTime() <= getEarliestStart().getTime();
  };

  const isSlotPartiallyPast = (dayIndex, time) => {
    const slotStart = getSlotDateTime(dayIndex, time);
    return slotStart.getTime() < getEarliestStart().getTime() && !isSlotInPast(dayIndex, time);
  };

  const isRangeOccupiedForRoom = (roomId, rangeStart, rangeEnd, excludeBookingId = null) => (
    calendarItems.some(b => {
      if (excludeBookingId && b._id === excludeBookingId) return false;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return false;
      return new Date(b.startAt) < rangeEnd && new Date(b.endAt) > rangeStart;
    })
  );

  const addMinutes = (d, mins) => new Date(d.getTime() + mins * 60000);

  const getSlotFreeIntervals = (roomId, dayIndex, time, excludeBookingId = null, ignorePast = false) => {
    const slotStart = getSlotDateTime(dayIndex, time);
    const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
    const blockers = calendarItems
      .filter(b => {
        if (excludeBookingId && b._id === excludeBookingId) return false;
        const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
        if (String(bRoomId) !== String(roomId)) return false;
        return new Date(b.startAt) < slotEnd && new Date(b.endAt) > slotStart;
      })
      .map(b => ({ start: new Date(b.startAt), end: new Date(b.endAt), kind: 'booking' }));
    if (!ignorePast) {
      const earliest = getEarliestStart();
      if (earliest > slotStart) blockers.push({ start: new Date(0), end: earliest, kind: 'now' });
    }
    blockers.sort((a, b) => a.start - b.start);

    const intervals = [];
    let cursor = slotStart;
    let cursorKind = 'slot';
    for (const bl of blockers) {
      if (bl.start > cursor) {
        intervals.push({ start: cursor, end: bl.start < slotEnd ? bl.start : slotEnd, kind: cursorKind });
      }
      if (bl.end > cursor) { cursor = bl.end; cursorKind = bl.kind; }
      if (cursor >= slotEnd) break;
    }
    if (cursor < slotEnd) intervals.push({ start: cursor, end: slotEnd, kind: cursorKind });
    return intervals.filter(iv => iv.end > iv.start);
  };

  const getSlotAutoStart = (roomId, dayIndex, time, excludeBookingId = null) => {
    const intervals = getSlotFreeIntervals(roomId, dayIndex, time, excludeBookingId);
    if (!intervals.length) return null;
    const iv = intervals[0];
    if (iv.kind === 'booking') {
      const q = 15 * 60000;
      const rounded = new Date(Math.ceil(iv.start.getTime() / q) * q);
      if (rounded < iv.end) return rounded;
    }
    return iv.start;
  };

  const getSlotAutoEnd = (roomId, dayIndex, time, rangeStart, excludeBookingId = null) => {
    const slotStart = getSlotDateTime(dayIndex, time);
    const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
    let end = slotEnd;
    calendarItems.forEach(b => {
      if (excludeBookingId && b._id === excludeBookingId) return;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return;
      const bs = new Date(b.startAt);
      const be = new Date(b.endAt);
      if (bs >= slotStart && bs >= rangeStart && bs < end && be > rangeStart) end = bs;
    });
    return end;
  };

  const isSlotOccupiedForRoom = (roomId, dayIndex, time, excludeBookingId = null) => (
    getSlotFreeIntervals(roomId, dayIndex, time, excludeBookingId, true).length === 0
  );

  const isSlotMaintenance = (roomId, dayIndex, time) => {
    const slotStart = getSlotDateTime(dayIndex, time);
    const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
    return calendarItems.some(b => (
      b.isMaintenance
      && String(bookingRoomId(b)) === String(roomId)
      && new Date(b.startAt) < slotEnd
      && new Date(b.endAt) > slotStart
    ));
  };

  const isSlotOccupied = (dayIndex, time) => isSlotOccupiedForRoom(selectedRoom, dayIndex, time);

  const isSlotInSelectedRange = (dayIndex, time, startVal = startAt, endVal = endAt) => {
    if (!startVal || !endVal) return false;

    const slotStart = getSlotDateTime(dayIndex, time);
    const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
    return slotStart < new Date(endVal) && slotEnd > new Date(startVal);
  };

  const handlePickerClick = (dayIndex, time) => {
    if (!canCreateBooking) {
      setBookingMessage({ type: 'error', text: 'ທ່ານບໍ່ມີສິດຈອງຫ້ອງ' });
      return;
    }

    if (isSlotInPast(dayIndex, time)) {
      setBookingMessage({ type: 'error', text: 'ເວລານີ້ຜ່ານໄປແລ້ວ ກະລຸນາເລືອກເວລາທີ່ຍັງບໍ່ທັນຜ່ານໄປ' });
      setPickStart(null);
      setStartAt('');
      setEndAt('');
      return;
    }

    if (pickStart && isSlotInPast(pickStart.dayIndex, pickStart.time)) {
      setBookingMessage({ type: 'error', text: 'ຈຸດເລີ່ມຕົ້ນທີ່ເລືອກໄວ້ຜ່ານໄປແລ້ວ ກະລຸນາເລືອກໃໝ່' });
      setPickStart(null);
      setStartAt('');
      setEndAt('');
      return;
    }

    if (isSlotOccupied(dayIndex, time)) return;

    if (!pickStart || pickStart.dayIndex !== dayIndex) {
      const autoStart = getSlotAutoStart(selectedRoom, dayIndex, time);
      if (!autoStart) return;
      setPickStart({ dayIndex, time, startDate: autoStart });
      setStartAt('');
      setEndAt('');
      return;
    }

    const startIdx = timeSlots.indexOf(pickStart.time);
    const clickedIdx = timeSlots.indexOf(time);

    let rangeStart;
    let rangeEnd;
    if (clickedIdx < startIdx) {
      rangeStart = getSlotAutoStart(selectedRoom, dayIndex, time);
      if (!rangeStart) return;
      rangeEnd = getSlotAutoEnd(selectedRoom, dayIndex, pickStart.time, rangeStart);
    } else {
      rangeStart = pickStart.startDate || getSlotDateTime(dayIndex, pickStart.time);
      rangeEnd = getSlotAutoEnd(selectedRoom, dayIndex, time, rangeStart);
    }

    if (rangeEnd <= rangeStart || isRangeOccupiedForRoom(selectedRoom, rangeStart, rangeEnd)) {
      alert('ຊ່ວງເວລານີ້ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ ກະລຸນາເລືອກໃໝ່');
      setPickStart(null);
      return;
    }

    setStartAt(toDateTimeLocalValue(rangeStart));
    setEndAt(toDateTimeLocalValue(rangeEnd));
    setPickStart(null);
  };

  const shiftAnchorWeek = (delta) => {
    setCalendarAnchorDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
    setPickStart(null);
    setReschedulePickStart(null);
  };

  const handleReschedulePickerClick = (dayIndex, time) => {
    const booking = currentBookingToReschedule;
    if (!booking) return;

    const roomId = String(rescheduleRoomId || bookingRoomId(booking));
    const excludeId = booking._id;

    if (isSlotInPast(dayIndex, time)) {
      alert('ເວລານີ້ຜ່ານໄປແລ້ວ ກະລຸນາເລືອກເວລາທີ່ຍັງບໍ່ທັນຜ່ານໄປ');
      setReschedulePickStart(null);
      setNewStartAt('');
      setNewEndAt('');
      return;
    }

    if (reschedulePickStart && isSlotInPast(reschedulePickStart.dayIndex, reschedulePickStart.time)) {
      setReschedulePickStart(null);
      setNewStartAt('');
      setNewEndAt('');
      return;
    }

    if (isSlotOccupiedForRoom(roomId, dayIndex, time, excludeId)) return;

    if (!reschedulePickStart || reschedulePickStart.dayIndex !== dayIndex) {
      const autoStart = getSlotAutoStart(roomId, dayIndex, time, excludeId);
      if (!autoStart) return;
      setReschedulePickStart({ dayIndex, time, startDate: autoStart });
      setNewStartAt('');
      setNewEndAt('');
      return;
    }

    const startIdx = timeSlots.indexOf(reschedulePickStart.time);
    const clickedIdx = timeSlots.indexOf(time);

    let rangeStart;
    let rangeEnd;
    if (clickedIdx < startIdx) {
      rangeStart = getSlotAutoStart(roomId, dayIndex, time, excludeId);
      if (!rangeStart) return;
      rangeEnd = getSlotAutoEnd(roomId, dayIndex, reschedulePickStart.time, rangeStart, excludeId);
    } else {
      rangeStart = reschedulePickStart.startDate || getSlotDateTime(dayIndex, reschedulePickStart.time);
      rangeEnd = getSlotAutoEnd(roomId, dayIndex, time, rangeStart, excludeId);
    }

    if (rangeEnd <= rangeStart || isRangeOccupiedForRoom(roomId, rangeStart, rangeEnd, excludeId)) {
      alert('ຊ່ວງເວລານີ້ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ ກະລຸນາເລືອກໃໝ່');
      setReschedulePickStart(null);
      return;
    }

    setNewStartAt(toDateTimeLocalValue(rangeStart));
    setNewEndAt(toDateTimeLocalValue(rangeEnd));
    setReschedulePickStart(null);
  };

  const [manual, setManual] = useState({ day: '', start: '', end: '' });
  const [manualError, setManualError] = useState('');
  const manualSkipSync = useRef(false);

  useEffect(() => {
    if (!isModalOpen) return;
    if (manualSkipSync.current) { manualSkipSync.current = false; return; }
    if (startAt && endAt) setManual({ day: startAt.slice(0, 10), start: startAt.slice(11, 16), end: endAt.slice(11, 16) });
    else setManual({ day: '', start: '', end: '' });
    setManualError('');

  }, [startAt, endAt, isModalOpen]);
  useEffect(() => {
    if (!rescheduleModalOpen) return;
    if (manualSkipSync.current) { manualSkipSync.current = false; return; }
    if (newStartAt && newEndAt) setManual({ day: newStartAt.slice(0, 10), start: newStartAt.slice(11, 16), end: newEndAt.slice(11, 16) });
    else setManual({ day: '', start: '', end: '' });
    setManualError('');

  }, [newStartAt, newEndAt, rescheduleModalOpen]);

  const findConflictForRoom = (roomId, rangeStart, rangeEnd, excludeBookingId = null) => (
    calendarItems.find(b => {
      if (excludeBookingId && b._id === excludeBookingId) return false;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return false;
      return new Date(b.startAt) < rangeEnd && new Date(b.endAt) > rangeStart;
    }) || null
  );

  const fmtHM = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const fmtDT = (d) => {
    const x = new Date(d);
    return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')} ${fmtHM(x)}`;
  };
  const sameLocalDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const timelineBarStyle = (startD, endD) => {
    const sp = slotPos(startD);
    const ep = slotPos(endD);
    return {
      left: `calc(${(1 + sp) * (100 / SLOT_COLS)}% + 1px)`,
      width: `calc(${Math.max(0, ep - sp) * (100 / SLOT_COLS)}% - 2px)`,
    };
  };

  // ---------- ແນະນຳເວລາ (Suggest time) — ຝັ່ງຜູ້ອະນຸມັດ ----------
  const SUGGEST_STEP_MIN = 5;
  const DAY_OPEN_MIN = 8 * 60;
  const DAY_CLOSE_MIN = 17 * 60;
  const minsOfDate = (d) => d.getHours() * 60 + d.getMinutes();
  const slotUToMinutes = (u) => (u < 8 ? 480 + u * SLOT_MINUTES : 780 + (u - 8) * SLOT_MINUTES);
  const dateAtMinutes = (dayDate, mins) => {
    const d = new Date(dayDate);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(Math.round(mins));
    return d;
  };
  const toDateInputValue = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtShortDate = (d) => new Date(d).toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
  const durationMinutes = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

  const startSuggest = (all) => {
    const list = all.filter((b) => canMoveTime(b));
    if (list.length === 0) {
      alert('ຜູ້ຈອງບໍ່ຍອມປ່ຽນເວລາ (ປ່ຽນສະເພາະຫ້ອງ ຫຼື ບໍ່ປ່ຽນເລີຍ) — ບໍ່ສາມາດແນະນຳເວລາໃໝ່ໄດ້');
      return;
    }
    const draft = {};
    list.forEach((b) => {
      const st = new Date(b.startAt);
      const en = new Date(b.endAt);
      draft[b._id] = { start: st, end: en, origStart: st, origEnd: en };
    });
    setSuggestDraft(draft);
    setSuggestError('');
    setSuggestMode(true);
  };
  const cancelSuggest = () => {
    setSuggestMode(false);
    setSuggestDraft({});
    setSuggestError('');
  };
  const resetSuggest = () => {
    setSuggestDraft((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, d]) => { next[id] = { ...d, start: d.origStart, end: d.origEnd }; });
      return next;
    });
    setSuggestError('');
  };
  const isSuggestMoved = (d) => d && d.start.getTime() !== d.origStart.getTime();

  // ປ້ອນເວລາເອງ: ກຳນົດວັນ + ເວລາເລີ່ມ — ເວລາສິ້ນສຸດຄຳນວນໃຫ້ເທົ່າໄລຍະເວລາເດີມສະເໝີ
  const setSuggestFromInputs = (id, dateStr, timeStr) => {
    if (!dateStr || !timeStr) return;
    const [y, m, dd] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const start = new Date(y, m - 1, dd, hh, mm, 0, 0);
    if (Number.isNaN(start.getTime())) return;
    setSuggestDraft((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const durMs = cur.origEnd.getTime() - cur.origStart.getTime();
      return { ...prev, [id]: { ...cur, start, end: new Date(start.getTime() + durMs) } };
    });
    setSuggestError('');
  };

  const getSuggestIssues = (id, roomId, roomConfirmedList) => {
    const d = suggestDraft[id];
    if (!d || !isSuggestMoved(d)) return [];
    const out = [];
    const sMin = minsOfDate(d.start);
    const eMin = minsOfDate(d.end);
    const crossesOrig = minsOfDate(d.origStart) < 720 && minsOfDate(d.origEnd) > 720;
    if (!sameLocalDay(d.start, d.end) || sMin < DAY_OPEN_MIN || eMin > DAY_CLOSE_MIN) {
      out.push('ເວລານອກຊ່ວງ 08:00–17:00');
    } else if (!crossesOrig && sMin < 720 && eMin > 720) {
      out.push('ເວລາຄາບເກ່ຍຊ່ວງພັກທ່ຽງ (12:00–13:00)');
    }
    if (d.start.getTime() <= Date.now()) out.push('ເວລານີ້ຜ່ານໄປແລ້ວ');
    const hit = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;
    if (roomConfirmedList.some((o) => hit(new Date(o.startAt), new Date(o.endAt), d.start, d.end))) {
      out.push('ຊົ່ວກັບການຈອງທີ່ອະນຸມັດແລ້ວ');
    }
    if (maintenanceSegments(new Date(d.start), new Date(d.end))
      .some((sg) => String(sg.roomId) === String(roomId) && hit(new Date(sg.startAt), new Date(sg.endAt), d.start, d.end))) {
      out.push('ຊົ່ວກັບຊ່ວງປິດບຳລຸງ');
    }
    if (Object.entries(suggestDraft).some(([oid, od]) => oid !== id && hit(od.start, od.end, d.start, d.end))) {
      out.push('ຊົ່ວກັບເວລາແນະນຳຂອງຄຳຮ້ອງອື່ນ');
    }
    if (pendingApprovals.some((o) => !suggestDraft[o._id] && String(bookingRoomId(o)) === String(roomId)
      && hit(new Date(o.startAt), new Date(o.endAt), d.start, d.end))) {
      out.push('ຊົ່ວກັບຄຳຮ້ອງອື່ນທີ່ຍັງລໍຖ້າ (ບໍ່ໄດ້ຢູ່ໃນການແນະນຳ — ເຊັ່ນ ຜູ້ຈອງບໍ່ຍອມປ່ຽນເວລາ)');
    }
    return out;
  };

  const beginSuggestDrag = (e, b, weekStartDate) => {
    const cur = suggestDraft[b._id];
    if (!suggestMode || !cur) return;
    e.preventDefault();
    e.stopPropagation();
    const row = e.currentTarget.closest('[data-admin-day]');
    if (!row) return;
    const rect0 = row.getBoundingClientRect();
    const uPointer0 = ((e.clientX - rect0.left) / rect0.width) * SLOT_COLS - 1;
    const grabU = uPointer0 - slotPos(cur.start);
    const durMs = cur.origEnd.getTime() - cur.origStart.getTime();
    const durMin = Math.round(durMs / 60000);
    const crossesOrig = minsOfDate(cur.origStart) < 720 && minsOfDate(cur.origEnd) > 720;
    const id = b._id;

    const move = (ev) => {
      const rows = Array.from(document.querySelectorAll('[data-admin-day]'));
      const hitRow = rows.find((r) => {
        const rr = r.getBoundingClientRect();
        return ev.clientY >= rr.top && ev.clientY <= rr.bottom;
      }) || row;
      const rr = hitRow.getBoundingClientRect();
      const dayIndex = Number(hitRow.getAttribute('data-admin-day'));
      const u = ((ev.clientX - rr.left) / rr.width) * SLOT_COLS - 1 - grabU;
      let mins = slotUToMinutes(Math.max(0, Math.min(16, u)));
      mins = Math.round(mins / SUGGEST_STEP_MIN) * SUGGEST_STEP_MIN;
      mins = Math.max(DAY_OPEN_MIN, Math.min(mins, DAY_CLOSE_MIN - durMin));
      if (!crossesOrig && mins < 720 && mins + durMin > 720) return;
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + (dayIndex - 1));
      const start = dateAtMinutes(dayDate, mins);
      const end = new Date(start.getTime() + durMs);
      setSuggestDraft((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], start, end } } : prev));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const buildTimeSuggestionMessage = (b, d) => {
    const roomName = b.roomId?.name || 'ຫ້ອງທີ່ຈອງ';
    return `ຜູ້ອະນຸມັດແນະນຳໃຫ້ຍ້າຍເວລາຈອງຫ້ອງ${roomName} ເປັນ ${fmtShortDate(d.start)} ${fmtHM(d.start)}–${fmtHM(d.end)} (ໄລຍະເວລາເທົ່າເດີມ ${durationMinutes(d.start, d.end)} ນາທີ) ເພື່ອບໍ່ໃຫ້ຊົ່ວກັບຄຳຮ້ອງອື່ນ`;
  };

  const sendSuggestions = async (roomId, roomConfirmedList) => {
    const moved = Object.entries(suggestDraft).filter(([, d]) => isSuggestMoved(d));
    if (moved.length === 0) {
      setSuggestError('ກະລຸນາລາກແຖບ ຫຼື ປ້ອນເວລາໃໝ່ຢ່າງໜ້ອຍ 1 ຄຳຮ້ອງ');
      return;
    }
    if (moved.some(([id]) => getSuggestIssues(id, roomId, roomConfirmedList).length > 0)) {
      setSuggestError('ມີເວລາແນະນຳທີ່ບໍ່ຖືກຕ້ອງ — ກະລຸນາແກ້ກ່ອນສົ່ງ');
      return;
    }
    setSuggestSending(true);
    setSuggestError('');
    const failures = [];
    for (const [id, d] of moved) {
      const b = pendingApprovals.find((x) => x._id === id);
      if (!b) continue;
      const keepRoom = b.changeRequestedAt && b.changeSuggestedRoomId ? String(b.changeSuggestedRoomId) : '';
      try {
        await reviewBooking(id, 'request-change', {
          type: keepRoom ? 'EITHER' : 'TIME',
          message: buildTimeSuggestionMessage(b, d),
          suggestedStartAt: d.start.toISOString(),
          suggestedEndAt: d.end.toISOString(),
          ...(keepRoom ? { suggestedRoomId: keepRoom } : {}),
        });
      } catch (err) {
        failures.push(`${b.title || id}: ${err.message}`);
      }
    }
    setSuggestSending(false);
    if (failures.length > 0) setSuggestError(`ສົ່ງບໍ່ສຳເລັດ — ${failures.join(' | ')}`);
    else cancelSuggest();
  };

  const openSuggestFromChange = () => {
    const b = bookingToChange;
    if (!b) return;
    const roomId = String(bookingRoomId(b));
    const sameRoom = pendingApprovals.filter((x) => String(bookingRoomId(x)) === roomId
      && (blockedBy(x).length > 0 || conflictWith(x).length > 0));
    const list = sameRoom.some((x) => x._id === b._id) ? sameRoom : [...sameRoom, b];
    closeChangeModal();
    setAdminSubTab('requests');
    setAdminRoomId(roomId);
    setAdminSelectedId(b._id);
    setAdminWeek(new Date(b.startAt));
    startSuggest(list);
  };

  const applyManualTime = (next, { roomId, excludeId, hasValue, onChange }) => {
    setManual(next);
    const clearSelection = () => {
      if (hasValue) { manualSkipSync.current = true; onChange('', ''); }
    };
    const { day, start, end } = next;

    if (day) {
      const dayDate = new Date(`${day}T00:00`);
      if (!Number.isNaN(dayDate.getTime()) && getWeekRange(dayDate).from.getTime() !== getWeekRange(calendarAnchorDate).from.getTime()) {
        setCalendarAnchorDate(dayDate);
      }
    }

    if (!day || !start || !end) { setManualError(''); clearSelection(); return; }

    const s = new Date(`${day}T${start}`);
    const e = new Date(`${day}T${end}`);
    const fail = (msg) => { setManualError(msg); clearSelection(); };

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return fail('ເວລາບໍ່ຖືກຕ້ອງ');
    if (s.getDay() === 0 || s.getDay() === 6) return fail('ຕາຕະລາງຮອງຮັບສະເພາະວັນຈັນ – ວັນສຸກ');
    if (e <= s) return fail('ເວລາສິ້ນສຸດຕ້ອງຫຼັງເວລາເລີ່ມ');
    if (s.getTime() <= Date.now()) return fail('ເວລາເລີ່ມຜ່ານໄປແລ້ວ ກະລຸນາເລືອກເວລາທີ່ຍັງບໍ່ທັນຜ່ານໄປ');
    if (s.getTime() < getEarliestStart().getTime()) return fail(`ກະລຸນາເລືອກເວລາເລີ່ມຫຼັງ ${fmtHM(getEarliestStart())} ຂຶ້ນໄປ (ໃຫ້ admin ມີເວລາອະນຸມັດ)`);
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = e.getHours() * 60 + e.getMinutes();
    if (sMin < WORK_START_HOUR * 60 || eMin > WORK_END_HOUR * 60) return fail('ກະລຸນາເລືອກເວລາໃນຊ່ວງເວລາທຳການ 08:00 – 17:00');
    if ((sMin >= 720 && sMin < 780) || (eMin > 720 && eMin <= 780)) return fail('ຊ່ວງ 12:00 – 13:00 ແມ່ນເວລາພັກທ່ຽງ');
    const clash = findConflictForRoom(roomId, s, e, excludeId);
    if (clash) {
      if (clash.isMaintenance) {
        return fail(`ຫ້ອງປິດບຳລຸງໃນຊ່ວງເວລານີ້ (${fmtHM(new Date(clash.startAt))} – ${fmtHM(new Date(clash.endAt))}) ກະລຸນາປ່ຽນເວລາ`);
      }
      return fail(`ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ (${fmtHM(new Date(clash.startAt))} – ${fmtHM(new Date(clash.endAt))}) ກະລຸນາປ່ຽນເວລາ`);
    }

    setManualError('');
    onChange(`${day}T${start}`, `${day}T${end}`);
  };

  const scrubLive = useRef({ manual: { day: '', start: '', end: '' }, apply: null, ctx: null });
  const MIN_PX_PER_MINUTE = 3;

  const minuteToDate = (base, m) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(m / 60), m % 60, 0, 0);

  const handleBarDragStart = (e, which, { roomId, excludeId, startVal, endVal, onChange }) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handleEl = e.currentTarget;
    const track = handleEl.closest('[data-timeline]');
    if (!track || !startVal || !endVal) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    try { handleEl.setPointerCapture(e.pointerId); } catch (_) {  }

    const s0 = new Date(startVal);
    const e0 = new Date(endVal);
    const toMin = (d) => d.getHours() * 60 + d.getMinutes();
    let curS = toMin(s0);
    let curE = toMin(e0);

    let lowerStart = AVAIL_START_MIN;
    let upperEnd = AVAIL_END_MIN;
    const earliest = getEarliestStart();
    if (sameLocalDay(earliest, s0)) lowerStart = Math.max(lowerStart, toMin(earliest));
    calendarItems.forEach(b => {
      if (excludeId && b._id === excludeId) return;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return;
      const bs = new Date(b.startAt);
      const be = new Date(b.endAt);
      if (!sameLocalDay(bs, s0) && !sameLocalDay(be, s0)) return;
      if (be <= s0) lowerStart = Math.max(lowerStart, sameLocalDay(be, s0) ? toMin(be) : AVAIL_START_MIN);
      if (bs >= e0) upperEnd = Math.min(upperEnd, sameLocalDay(bs, s0) ? toMin(bs) : AVAIL_END_MIN);
    });

    const pxPerMin = (rect.width / SLOT_COLS) / SLOT_MINUTES;
    const step = pxPerMin < MIN_PX_PER_MINUTE ? 5 : 1;
    const isEnd = which === 'end';

    const minFromX = (clientX) => {
      let u = ((clientX - rect.left) / rect.width) * SLOT_COLS - 1;
      u = Math.max(0, Math.min(16, u));

      return (u < 8 || (isEnd && u === 8)) ? 480 + u * SLOT_MINUTES : 780 + (u - 8) * SLOT_MINUTES;
    };

    const onMove = (ev) => {
      let m = Math.round(minFromX(ev.clientX) / step) * step;
      if (isEnd) m = Math.max(curS + 1, Math.min(upperEnd, m));
      else m = Math.min(curE - 1, Math.max(lowerStart, m));
      if (m < AVAIL_START_MIN) m = AVAIL_START_MIN;
      if (m > AVAIL_END_MIN) m = AVAIL_END_MIN;

      if (!isEnd && m >= 720 && m < 780) m = 780;
      if (isEnd && m > 720 && m < 780) m = m < 750 ? 720 : 780;
      if (isEnd ? m <= curS : m >= curE) return;
      if (isEnd) { if (m === curE) return; curE = m; } else { if (m === curS) return; curS = m; }
      onChange(toDateTimeLocalValue(minuteToDate(s0, curS)), toDateTimeLocalValue(minuteToDate(s0, curE)));
    };
    const onUp = () => {
      handleEl.removeEventListener('pointermove', onMove);
      handleEl.removeEventListener('pointerup', onUp);
      handleEl.removeEventListener('pointercancel', onUp);
      try { handleEl.releasePointerCapture(e.pointerId); } catch (_) {  }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    handleEl.addEventListener('pointermove', onMove);
    handleEl.addEventListener('pointerup', onUp);
    handleEl.addEventListener('pointercancel', onUp);
  };

  const handleRowDragCreate = (e, dayDate, { roomId, excludeId, onChange }) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!roomId || !onChange) return;
    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    if (rect.width <= 0) return;

    const pxPerMin = (rect.width / SLOT_COLS) / SLOT_MINUTES;
    const step = pxPerMin < MIN_PX_PER_MINUTE ? 5 : 1;
    const uOf = (clientX) => ((clientX - rect.left) / rect.width) * SLOT_COLS - 1;
    const minOf = (clientX, asEnd) => {
      const u = Math.max(0, Math.min(16, uOf(clientX)));
      return (u < 8 || (asEnd && u === 8)) ? 480 + u * SLOT_MINUTES : 780 + (u - 8) * SLOT_MINUTES;
    };
    if (uOf(e.clientX) < 0 || uOf(e.clientX) > 16) return;

    const toMin = (d) => d.getHours() * 60 + d.getMinutes();
    let anchor = Math.round(minOf(e.clientX, false) / step) * step;
    if (anchor >= 720 && anchor < 780) return;
    if (anchor >= AVAIL_END_MIN) return;

    let lower = AVAIL_START_MIN;
    let upper = AVAIL_END_MIN;
    const earliest = getEarliestStart();
    const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0);
    if (earliest >= new Date(dayStart.getTime() + 86400000)) return;
    if (sameLocalDay(earliest, dayDate)) lower = Math.max(lower, toMin(earliest));
    let blocked = false;
    calendarItems.forEach(b => {
      if (excludeId && b._id === excludeId) return;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return;
      const bs = new Date(b.startAt);
      const be = new Date(b.endAt);
      if (!sameLocalDay(bs, dayDate) && !sameLocalDay(be, dayDate)) return;
      const bsm = sameLocalDay(bs, dayDate) ? toMin(bs) : 0;
      const bem = sameLocalDay(be, dayDate) ? toMin(be) : 24 * 60;
      if (bsm <= anchor && anchor < bem) blocked = true;
      else if (bem <= anchor) lower = Math.max(lower, bem);
      else if (bsm >= anchor) upper = Math.min(upper, bsm);
    });
    if (blocked) return;
    if (anchor < lower) {
      if (lower - anchor >= SLOT_MINUTES) return;
      anchor = lower;
    }
    if (anchor >= upper) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let lastKey = '';

    const emit = (sMin, eMin) => {
      const key = `${sMin}-${eMin}`;
      if (key === lastKey) return;
      lastKey = key;
      if (eMin <= sMin) { onChange('', ''); return; }
      onChange(toDateTimeLocalValue(minuteToDate(dayDate, sMin)), toDateTimeLocalValue(minuteToDate(dayDate, eMin)));
    };

    const onMove = (ev) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        dragging = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
      }
      const right = ev.clientX >= startX;
      let m = Math.round(minOf(ev.clientX, right) / step) * step;
      if (right) {
        m = Math.max(anchor, Math.min(upper, m));
        if (m > 720 && m < 780) m = m < 750 ? 720 : 780;
        emit(anchor, m);
      } else {
        m = Math.min(anchor, Math.max(lower, m));
        if (m >= 720 && m < 780) m = 780;
        emit(m, anchor);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (dragging) {

        const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const manualTimeError = (day, start, end, roomId, excludeId) => {
    const s = new Date(`${day}T${start}`);
    const e = new Date(`${day}T${end}`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'invalid';
    if (s.getDay() === 0 || s.getDay() === 6) return 'weekend';
    if (e <= s) return 'order';
    if (s.getTime() < getEarliestStart().getTime()) return 'past';
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = e.getHours() * 60 + e.getMinutes();
    if (sMin < WORK_START_HOUR * 60 || eMin > WORK_END_HOUR * 60) return 'hours';
    if ((sMin >= 720 && sMin < 780) || (eMin > 720 && eMin <= 780)) return 'lunch';
    if (findConflictForRoom(roomId, s, e, excludeId)) return 'clash';
    return null;
  };

  const handleTimeScrubStart = (e, which) => {
    if (e.button !== undefined && e.button !== 0) return;
    const input = e.currentTarget;
    const startY = e.clientY;
    const PX_PER_TICK = 6;
    let lastY = startY;
    let lastT = performance.now();
    let acc = 0;
    let scrubbing = false;
    let val = null;

    const toM = (str) => { const [h, m] = (str || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

    const onMove = (ev) => {
      if (!scrubbing) {
        if (Math.abs(ev.clientY - startY) < 4) return;
        scrubbing = true;
        input.blur();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        const cur = scrubLive.current.manual || {};
        val = toM(cur[which]);
        if (val === null) {
          const other = toM(which === 'start' ? cur.end : cur.start);
          val = which === 'start' ? Math.max(AVAIL_START_MIN, toM(fmtHM(getEarliestStart())) || AVAIL_START_MIN) : (other !== null ? other + 30 : 9 * 60);
        }
        lastY = startY;
        lastT = performance.now() - 16;
      }
      const now = performance.now();
      const dy = ev.clientY - lastY;
      lastY = ev.clientY;
      lastT = now;
      acc += -dy;
      const ticks = Math.trunc(acc / PX_PER_TICK);
      if (!ticks) return;
      acc -= ticks * PX_PER_TICK;
      const live = scrubLive.current;
      const cur = live.manual || {};
      const ctx = live.ctx || {};
      const other = toM(which === 'start' ? cur.end : cur.start);

      const okAt = (m) => {
        if (m < AVAIL_START_MIN || m > AVAIL_END_MIN) return false;
        if (other !== null && (which === 'start' ? m >= other : m <= other)) return false;
        if (!cur.day || other === null) return true;
        const sStr = which === 'start' ? fmtMin(m) : cur.start;
        const eStr = which === 'start' ? cur.end : fmtMin(m);
        return !manualTimeError(cur.day, sStr, eStr, ctx.roomId, ctx.excludeId);
      };
      const currentValid = okAt(val);
      const dir = ticks > 0 ? 1 : -1;
      let moved = false;
      for (let i = 0; i < Math.abs(ticks); i += 1) {
        const cand = val + dir;

        if (currentValid && !okAt(cand)) { acc = 0; break; }
        if (cand < AVAIL_START_MIN || cand > AVAIL_END_MIN) { acc = 0; break; }
        val = cand;
        moved = true;
      }
      if (!moved) return;
      if (live.apply) live.apply({ ...cur, [which]: fmtMin(val) }, live.ctx);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (scrubbing) {

        const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const renderSlotPicker = ({ pickStart, startVal, endVal, onSlotClick, isOccupied, originalStartVal = null, originalEndVal = null, conflictRanges = [], roomId = '', excludeId = null, onManualChange = null }) => {
    scrubLive.current = {
      manual,
      apply: applyManualTime,
      ctx: { roomId, excludeId, hasValue: !!(startVal || endVal), onChange: onManualChange },
    };
    return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          ເລືອກເວລາ — ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດ ຫຼື ກົດຄ້າງແລ້ວລາກ
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftAnchorWeek(-1)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => shiftAnchorWeek(1)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 text-center py-1.5" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
            <div>ວັນ / ເວລາ</div>
            {hourHeaderSlots.map(time => (
              <div key={time} className="text-left pl-1 border-l border-gray-300" style={{ gridColumn: 'span 2' }}>{time}</div>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {weekDays
              .map(day => {
                const dayDate = new Date(getWeekRange(calendarAnchorDate).from);
                dayDate.setDate(dayDate.getDate() + (day.dayIndex - 1));
                return { ...day, dayDate };
              })
              .filter(day => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return day.dayDate >= today;
              })
              .map(day => {
                const dayDate = day.dayDate;
                return (
                  <div
                    key={day.key}
                    className="min-w-[1000px] relative select-none"
                    onPointerDown={onManualChange ? (ev) => handleRowDragCreate(ev, dayDate, { roomId, excludeId, onChange: onManualChange }) : undefined}
                  >
                  <div className="items-stretch" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                    <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-300 py-2 flex flex-col items-center justify-center gap-0.5">
                      <span>{day.label}</span>
                      <span className="text-[10px] font-normal text-gray-300">
                        {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {timeSlots.map(time => {
                      const occupied = isOccupied(day.dayIndex, time);
                      const isMaint = !!roomId && isSlotMaintenance(roomId, day.dayIndex, time);
                      const isPast = isSlotInPast(day.dayIndex, time);
                      const isChosenStart = pickStart && pickStart.dayIndex === day.dayIndex && pickStart.time === time;
                      const isDisabled = isPast || occupied;
                      const isPartialPast = !isPast && isSlotPartiallyPast(day.dayIndex, time);
                      const isInRange = isSlotInSelectedRange(day.dayIndex, time, startVal, endVal);
                      const isInOriginalRange = isSlotInSelectedRange(day.dayIndex, time, originalStartVal, originalEndVal);
                      const originalConflict = isInOriginalRange && conflictRanges.some(c => (
                        isSlotInSelectedRange(day.dayIndex, time, c.startAt, c.endAt)
                      ));
                      return (
                        <button
                          type="button"
                          key={time}
                          disabled={isDisabled}
                          onClick={() => onSlotClick(day.dayIndex, time)}
                          className={`h-9 border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'} text-[10px] transition ${isPast
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                            : isMaint
                              ? 'bg-orange-100 text-orange-500 cursor-not-allowed'
                            : isDisabled
                              ? 'bg-red-50 text-red-300 cursor-not-allowed'
                              : occupied
                                ? 'bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer'
                                : isChosenStart
                                  ? 'bg-amber-500 text-white font-semibold'
                                  : isInRange
                                    ? 'bg-amber-100 text-amber-700 font-semibold border-amber-200'
                                    : isInOriginalRange
                                      ? (originalConflict
                                        ? 'bg-red-100 text-red-600 ring-1 ring-inset ring-red-400 hover:bg-red-200 cursor-pointer'
                                        : 'bg-sky-50 text-sky-500 ring-1 ring-inset ring-sky-200 hover:bg-sky-100 cursor-pointer')
                                      : 'bg-white hover:bg-amber-50 text-gray-300'
                          }`}
                          title={isPast
                            ? 'ເວລາຜ່ານໄປແລ້ວ'
                            : isMaint
                              ? 'ຫ້ອງປິດບຳລຸງ (Maintenance)'
                            : isDisabled
                              ? 'ບໍ່ວ່າງ'
                              : occupied
                                ? 'ບໍ່ວ່າງ'
                                : isInOriginalRange && !isInRange
                                  ? (originalConflict ? `${time} — ຊ່ວງທີ່ຊົ່ວກັບການຈອງອື່ນ (ຕ້ອງປ່ຽນ)` : `${time} — ເວລາເດີມຂອງການຈອງ`)
                                  : isPartialPast
                                    ? `${time} — ຜ່ານໄປບາງສ່ວນ ຈະເລີ່ມທີ່ ${fmtHM(getEarliestStart())}`
                                    : time}
                        >
                          {isPast ? '' : occupied ? (isMaint ? '🔧' : '✕') : isChosenStart ? '●' : isInRange ? '●' : isInOriginalRange ? (originalConflict ? '⚠' : '○') : ''}
                        </button>
                      );
                    })}
                  </div>

                  <div className="absolute inset-0 pointer-events-none" data-timeline="1">
                    {roomId && calendarItems
                      .filter(b => {
                        if (excludeId && b._id === excludeId) return false;
                        const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
                        return String(bRoomId) === String(roomId) && sameLocalDay(new Date(b.startAt), dayDate);
                      })
                      .map(b => {
                        const bs = new Date(b.startAt);
                        const be = new Date(b.endAt);
                        const style = timelineBarStyle(bs, be);
                        if (slotPos(be) - slotPos(bs) <= 0) return null;
                        return (
                          <div
                            key={`booked-${b._id}`}
                            className={`absolute top-[3px] bottom-[3px] rounded border text-[10px] font-semibold flex items-center justify-center overflow-hidden whitespace-nowrap ${b.isMaintenance ? 'border-orange-400 bg-orange-100/90 text-orange-700' : 'border-red-300 bg-red-100/80 text-red-500'}`}
                            style={{
                              ...style,
                              backgroundImage: b.isMaintenance
                                ? MAINT_HATCH
                                : 'repeating-linear-gradient(45deg, rgba(248,113,113,0.18) 0, rgba(248,113,113,0.18) 4px, transparent 4px, transparent 8px)',
                            }}
                            title={b.isMaintenance
                              ? `Maintenance ${fmtHM(bs)} – ${fmtHM(be)}${b.reason ? ` · ${b.reason}` : ''}`
                              : `ຈອງແລ້ວ ${fmtHM(bs)} – ${fmtHM(be)}${b.title ? ` · ${b.title}` : ''}`}
                          >
                            <span translate="no" key={`${b.startAt}|${b.endAt}`}>{b.isMaintenance ? '🔧 Maintenance' : `✕ ${fmtHM(bs)}–${fmtHM(be)}`}</span>
                          </div>
                        );
                      })}

                    {sameLocalDay(dayDate, new Date()) && slotPos(getEarliestStart()) > 0 && (
                      <div
                        className="absolute top-0 bottom-0 bg-gray-300/50 border-r-2 border-gray-400/70"
                        style={timelineBarStyle(new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 0), getEarliestStart())}
                        title={`ເວລາຜ່ານໄປແລ້ວ — ຈອງໄດ້ຕັ້ງແຕ່ ${fmtHM(getEarliestStart())}`}
                      />
                    )}
                    {originalStartVal && originalEndVal && sameLocalDay(new Date(originalStartVal), dayDate) && (
                      <div
                        className="absolute top-[3px] bottom-[3px] rounded border-2 border-dashed border-sky-400 bg-sky-100/40"
                        style={timelineBarStyle(new Date(originalStartVal), new Date(originalEndVal))}
                        title="ເວລາເດີມຂອງການຈອງຂອງທ່ານ"
                      />
                    )}
                    {conflictRanges
                      .filter(c => sameLocalDay(new Date(c.startAt), dayDate))
                      .map((c, i) => (
                        <div
                          key={`conflict-${i}`}
                          className="absolute top-[3px] bottom-[3px] rounded border-2 border-red-600 bg-red-200/60 text-red-700 text-[10px] font-bold flex items-center justify-center overflow-hidden whitespace-nowrap"
                          style={timelineBarStyle(new Date(c.startAt), new Date(c.endAt))}
                          title={`ການຈອງທີ່ຊົ່ວກັບທ່ານ: ${c.title || ''} ${fmtHM(new Date(c.startAt))}–${fmtHM(new Date(c.endAt))}`}
                        >
                          <span translate="no">⚠ {c.title || 'ຊົ່ວກັນ'} {fmtHM(new Date(c.startAt))}–{fmtHM(new Date(c.endAt))}</span>
                        </div>
                      ))}
                    {startVal && endVal && sameLocalDay(new Date(startVal), dayDate) && (
                      <div
                        className="absolute top-[1px] bottom-[1px] rounded border-2 border-amber-500 bg-amber-300/50 text-amber-800 text-[10px] font-bold flex items-center justify-center overflow-hidden whitespace-nowrap"
                        style={timelineBarStyle(new Date(startVal), new Date(endVal))}
                        title={`${fmtHM(new Date(startVal))} – ${fmtHM(new Date(endVal))}`}
                      >
                        <span translate="no" key={`${startVal}|${endVal}`}>{fmtHM(new Date(startVal))}–{fmtHM(new Date(endVal))}</span>
                        {onManualChange && ['start', 'end'].map(which => (
                          <span
                            key={which}
                            role="slider"
                            aria-label={which === 'start' ? 'ລາກປັບເວລາເລີ່ມ' : 'ລາກປັບເວລາສິ້ນສຸດ'}
                            title={which === 'start' ? 'ລາກເພື່ອປັບເວລາເລີ່ມ (ເທື່ອລະ 1 ນາທີ)' : 'ລາກເພື່ອປັບເວລາສິ້ນສຸດ (ເທື່ອລະ 1 ນາທີ)'}
                            onPointerDown={(ev) => handleBarDragStart(ev, which, { roomId, excludeId, startVal, endVal, onChange: onManualChange })}
                            className={`absolute top-0 bottom-0 w-2 bg-amber-600/80 hover:bg-amber-700 pointer-events-auto cursor-ew-resize ${which === 'start' ? 'left-0' : 'right-0'}`}
                            style={{ touchAction: 'none' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {onManualChange && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2" translate="no">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-700">ພິມເວລາເອງ (ລະອຽດເປັນນາທີ)</p>
            <p className="text-[11px] text-gray-400">ເຊັ່ນ 08:15 – 08:20 · ລາກຂຶ້ນ/ລົງເທິງຊ່ອງເວລາເພື່ອປັບເທື່ອລະ 1 ນາທີ · ລາກຂອບແຖບສີເຫຼືອງໃນຕາຕະລາງໄດ້ເຊັ່ນກັນ</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ວັນທີ</label>
              <input
                type="date"
                value={manual.day}
                min={availDateKey(new Date())}
                onChange={(e) => applyManualTime({ ...manual, day: e.target.value }, { roomId, excludeId, hasValue: !!(startVal || endVal), onChange: onManualChange })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ເວລາເລີ່ມ</label>
              <input
                type="time"
                step={60}
                min="08:00"
                max="17:00"
                value={manual.start}
                onPointerDown={(e) => handleTimeScrubStart(e, 'start')}
                title="ລາກຂຶ້ນ/ລົງ ເພື່ອປັບເທື່ອລະ 1 ນາທີ"
                style={{ touchAction: 'none' }}
                onChange={(e) => applyManualTime({ ...manual, start: e.target.value }, { roomId, excludeId, hasValue: !!(startVal || endVal), onChange: onManualChange })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ເວລາສິ້ນສຸດ</label>
              <input
                type="time"
                step={60}
                min="08:00"
                max="17:00"
                value={manual.end}
                onPointerDown={(e) => handleTimeScrubStart(e, 'end')}
                title="ລາກຂຶ້ນ/ລົງ ເພື່ອປັບເທື່ອລະ 1 ນາທີ"
                style={{ touchAction: 'none' }}
                onChange={(e) => applyManualTime({ ...manual, end: e.target.value }, { roomId, excludeId, hasValue: !!(startVal || endVal), onChange: onManualChange })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>
          {manualError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{manualError}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400" translate="no">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300 text-[8px] leading-3 text-center text-red-500">✕</span>
          ຖືກຈອງແລ້ວ (ແຖບສະແດງເວລາຈິງ)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-300/70 border border-gray-400" />
          ເວລາຜ່ານໄປແລ້ວ (+15 ນາທີ ໃຫ້ admin ອະນຸມັດ)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-300/60 border border-amber-500" />
          ເວລາທີ່ເລືອກ
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs" translate="no">
        {pickStart ? (
          <span className="text-amber-600 font-medium">
            ເລືອກຈຸດເລີ່ມແລ້ວ ({weekDays.find(d => d.dayIndex === pickStart.dayIndex)?.label} {pickStart.time}) — ກົດຈຸດສິ້ນສຸດຕໍ່
          </span>
        ) : startVal && endVal ? (
          <span className="text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg px-2 py-1">
            {new Date(startVal).toLocaleDateString('lo-LA', { weekday: 'long', day: 'numeric', month: 'short' })}
            {' ⋅ '}
            {new Date(startVal).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
            {' - '}
            {new Date(endVal).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-gray-400">ຍັງບໍ່ໄດ້ເລືອກເວລາ</span>
        )}
      </div>

      {originalStartVal && originalEndVal && (
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400" translate="no">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-sky-50 ring-1 ring-inset ring-sky-200" />
            ເວລາເດີມທີ່ຮ້ອງຂໍໄວ້
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-100" />
            ເວລາໃໝ່ທີ່ເລືອກ
          </span>
        </div>
      )}
    </div>
    );
  };

  const renderMaintenancePicker = (roomId) => {
    const rangeStart = scheduleForm.start ? new Date(scheduleForm.start) : null;
    const rangeEnd = scheduleForm.end ? new Date(scheduleForm.end) : null;
    const hasRange = !!(rangeStart && rangeEnd && !Number.isNaN(rangeStart.getTime()) && !Number.isNaN(rangeEnd.getTime()) && rangeEnd > rangeStart);
    const now = new Date();
    const nowMin = new Date(now);
    nowMin.setSeconds(0, 0);

    const handleMaintSlotClick = (slotS, slotE) => {
      setMaintenanceError('');
      if (!maintPickStart) {
        setMaintPickStart({ s: slotS, e: slotE });
        setScheduleForm(f => ({ ...f, start: '', end: '' }));
        return;
      }
      const from = new Date(Math.min(maintPickStart.s.getTime(), slotS.getTime()));
      const to = new Date(Math.max(maintPickStart.e.getTime(), slotE.getTime()));
      const clampedFrom = from < nowMin ? nowMin : from;
      setScheduleForm(f => ({ ...f, start: toDateTimeLocalValue(clampedFrom), end: toDateTimeLocalValue(to) }));
      setMaintPickStart(null);
    };

    const startMaintDrag = (e, dayDate) => {
      if (e.button !== undefined && e.button !== 0) return;
      const rowEl = e.currentTarget;
      const rect0 = rowEl.getBoundingClientRect();
      if (rect0.width <= 0) return;

      const pxPerMin = (rect0.width / SLOT_COLS) / SLOT_MINUTES;
      const step = pxPerMin < 3 ? 5 : 1;
      const uOf = (rect, x) => ((x - rect.left) / rect.width) * SLOT_COLS - 1;
      const minOf = (rect, x, asEnd) => {
        const u = Math.max(0, Math.min(16, uOf(rect, x)));
        return (u < 8 || (asEnd && u === 8)) ? 480 + u * SLOT_MINUTES : 780 + (u - 8) * SLOT_MINUTES;
      };
      const at = (day, m) => {
        const d = new Date(day);
        d.setHours(0, 0, 0, 0);
        d.setMinutes(m);
        return d;
      };
      if (uOf(rect0, e.clientX) < 0 || uOf(rect0, e.clientX) > 16) return;

      let anchor = at(dayDate, Math.round(minOf(rect0, e.clientX, false) / step) * step);
      if (anchor < nowMin) {
        if (nowMin.getTime() - anchor.getTime() >= SLOT_MINUTES * 60000) return;
        anchor = new Date(nowMin);
      }

      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      let lastKey = '';

      const onMove = (ev) => {
        if (!moved) {
          if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
          moved = true;
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'crosshair';
        }
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = el && el.closest ? el.closest('[data-mrow]') : null;
        if (!row) return;
        const rect = row.getBoundingClientRect();
        if (rect.width <= 0) return;
        const rowDay = new Date(Number(row.getAttribute('data-mrow')));
        const probe = at(rowDay, Math.round(minOf(rect, ev.clientX, false) / step) * step);
        const goesLater = probe.getTime() >= anchor.getTime();
        const cur = at(rowDay, Math.round(minOf(rect, ev.clientX, goesLater) / step) * step);
        let from = goesLater ? anchor : cur;
        const to = goesLater ? cur : anchor;
        if (from < nowMin) from = nowMin;

        const key = `${from.getTime()}-${to.getTime()}`;
        if (key === lastKey) return;
        lastKey = key;
        setMaintPickStart(null);
        setMaintenanceError('');
        if (to <= from) {
          setScheduleForm(f => ({ ...f, start: '', end: '' }));
          return;
        }
        setScheduleForm(f => ({ ...f, start: toDateTimeLocalValue(from), end: toDateTimeLocalValue(to) }));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (moved) {
          const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
          window.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    const startMaintResize = (e, which) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (!hasRange) return;

      const isEnd = which === 'end';
      const at = (day, m) => {
        const d = new Date(day);
        d.setHours(0, 0, 0, 0);
        d.setMinutes(m);
        return d;
      };

      let curS = new Date(rangeStart);
      let curE = new Date(rangeEnd);

      const onMove = (ev) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = el && el.closest ? el.closest('[data-mrow]') : null;
        if (!row) return;
        const rect = row.getBoundingClientRect();
        if (rect.width <= 0) return;
        const rowDay = new Date(Number(row.getAttribute('data-mrow')));

        const pxPerMin = (rect.width / SLOT_COLS) / SLOT_MINUTES;
        const step = pxPerMin < 3 ? 5 : 1;
        const minGap = step * 60000;
        const u = Math.max(0, Math.min(16, ((ev.clientX - rect.left) / rect.width) * SLOT_COLS - 1));
        const rawMin = (u < 8 || (isEnd && u === 8)) ? 480 + u * SLOT_MINUTES : 780 + (u - 8) * SLOT_MINUTES;
        let cand = at(rowDay, Math.round(rawMin / step) * step);

        if (isEnd) {
          if (cand.getTime() < curS.getTime() + minGap) cand = new Date(curS.getTime() + minGap);
          if (cand.getTime() === curE.getTime()) return;
          curE = cand;
        } else {
          if (cand < nowMin) cand = new Date(nowMin);
          if (cand.getTime() > curE.getTime() - minGap) cand = new Date(curE.getTime() - minGap);
          if (cand.getTime() === curS.getTime()) return;
          curS = cand;
        }
        setMaintPickStart(null);
        setMaintenanceError('');
        setScheduleForm(f => ({ ...f, start: toDateTimeLocalValue(curS), end: toDateTimeLocalValue(curE) }));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    const shiftWeek = (delta) => {
      setCalendarAnchorDate(prev => {
        const next = new Date(prev);
        next.setDate(next.getDate() + delta * 7);
        return next;
      });
    };

    const editingId = maintenanceDialog?.editing?._id ? String(maintenanceDialog.editing._id) : null;
    const roomItems = calendarItems.filter(b => (
      String(bookingRoomId(b)) === String(roomId)
      && !(editingId && String(b._id).startsWith(`${editingId}@`))
    ));

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            ເລືອກຊ່ວງເວລາປິດບຳລຸງ — ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດ ຫຼື ກົດຄ້າງແລ້ວລາກ (ລາກຂ້າງ = ເວລາ ເທື່ອລະ 5 ນາທີ, ລາກຂຶ້ນ/ລົງ = ຂ້າມວັນ)
          </label>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftWeek(-1)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">◀</button>
            <button type="button" onClick={() => shiftWeek(1)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">▶</button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 text-center py-1.5" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
              <div>ວັນ / ເວລາ</div>
              {hourHeaderSlots.map(time => (
                <div key={time} className="text-left pl-1 border-l border-gray-300" style={{ gridColumn: 'span 2' }}>{time}</div>
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {weekDays
                .map(day => {
                  const dayDate = new Date(getWeekRange(calendarAnchorDate).from);
                  dayDate.setDate(dayDate.getDate() + (day.dayIndex - 1));
                  dayDate.setHours(0, 0, 0, 0);
                  return { ...day, dayDate };
                })
                .filter(day => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return day.dayDate >= today;
                })
                .map(day => {
                  const dayDate = day.dayDate;
                  const dayEnd = new Date(dayDate);
                  dayEnd.setHours(23, 59, 59, 999);
                  const segS = hasRange && rangeStart > dayDate ? rangeStart : dayDate;
                  const segE = hasRange && rangeEnd < dayEnd ? rangeEnd : dayEnd;
                  const showSel = hasRange && segE > segS && slotPos(segE) > slotPos(segS);
                  return (
                    <div
                      key={day.key}
                      className="min-w-[1000px] relative select-none"
                      data-mrow={dayDate.getTime()}
                      onPointerDown={(ev) => startMaintDrag(ev, dayDate)}
                    >
                      <div className="items-stretch" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                        <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-300 py-2 flex flex-col items-center justify-center gap-0.5">
                          <span>{day.label}</span>
                          <span className="text-[10px] font-normal text-gray-300">
                            {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        {timeSlots.map(time => {
                          const [h, m] = time.split(':').map(Number);
                          const slotS = new Date(dayDate);
                          slotS.setHours(h, m, 0, 0);
                          const slotE = addMinutes(slotS, SLOT_MINUTES);
                          const isPast = slotE.getTime() <= now.getTime();
                          const isPicked = !!maintPickStart && maintPickStart.s.getTime() === slotS.getTime();
                          const isInRange = hasRange && slotS < rangeEnd && slotE > rangeStart;
                          return (
                            <button
                              type="button"
                              key={time}
                              disabled={isPast}
                              onClick={() => handleMaintSlotClick(slotS, slotE)}
                              className={`h-9 border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'} text-[10px] transition ${isPast
                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                : isPicked
                                  ? 'bg-orange-500 text-white font-semibold'
                                  : isInRange
                                    ? 'bg-orange-100 text-orange-700 font-semibold border-orange-200'
                                    : 'bg-white hover:bg-orange-50 text-gray-300'
                              }`}
                              title={isPast ? 'ເວລາຜ່ານໄປແລ້ວ' : time}
                            >
                              {isPast ? '' : (isPicked || isInRange) ? '●' : ''}
                            </button>
                          );
                        })}
                      </div>

                      <div className="absolute inset-0 pointer-events-none" data-timeline="1">
                        {roomItems
                          .filter(b => sameLocalDay(new Date(b.startAt), dayDate))
                          .map(b => {
                            const bs = new Date(b.startAt);
                            const be = new Date(b.endAt);
                            if (slotPos(be) - slotPos(bs) <= 0) return null;
                            return (
                              <div
                                key={`booked-${b._id}`}
                                className={`absolute top-[3px] bottom-[3px] rounded border text-[10px] font-semibold flex items-center justify-center overflow-hidden whitespace-nowrap ${b.isMaintenance ? 'border-orange-400 bg-orange-100/90 text-orange-700' : 'border-red-300 bg-red-100/80 text-red-500'}`}
                                style={{
                                  ...timelineBarStyle(bs, be),
                                  backgroundImage: b.isMaintenance
                                    ? MAINT_HATCH
                                    : 'repeating-linear-gradient(45deg, rgba(248,113,113,0.18) 0, rgba(248,113,113,0.18) 4px, transparent 4px, transparent 8px)',
                                }}
                                title={b.isMaintenance
                                  ? `Maintenance ${fmtHM(bs)} – ${fmtHM(be)}${b.reason ? ` · ${b.reason}` : ''}`
                                  : `ຈອງແລ້ວ ${fmtHM(bs)} – ${fmtHM(be)}${b.title ? ` · ${b.title}` : ''}`}
                              >
                                <span translate="no">{b.isMaintenance ? '🔧 Maintenance' : `✕ ${fmtHM(bs)}–${fmtHM(be)}`}</span>
                              </div>
                            );
                          })}

                        {sameLocalDay(dayDate, now) && slotPos(now) > 0 && (
                          <div
                            className="absolute top-0 bottom-0 bg-gray-300/50 border-r-2 border-gray-400/70"
                            style={timelineBarStyle(new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 0), now)}
                            title="ເວລາຜ່ານໄປແລ້ວ"
                          />
                        )}

                        {showSel && (
                          <div
                            className="absolute top-[1px] bottom-[1px] rounded border-2 border-orange-500 bg-orange-300/50 text-orange-800 text-[10px] font-bold flex items-center justify-center overflow-hidden whitespace-nowrap"
                            style={timelineBarStyle(segS, segE)}
                            title={`${fmtDT(rangeStart)} – ${fmtDT(rangeEnd)}`}
                          >
                            <span translate="no">
                              {rangeStart > dayDate ? fmtHM(rangeStart) : '◀'}–{rangeEnd < dayEnd ? fmtHM(rangeEnd) : '▶'}
                            </span>
                            {['start', 'end'].map(which => {
                              const show = which === 'start'
                                ? sameLocalDay(rangeStart, dayDate)
                                : sameLocalDay(rangeEnd, dayDate);
                              if (!show) return null;
                              return (
                                <span
                                  key={which}
                                  role="slider"
                                  aria-label={which === 'start' ? 'ລາກປັບເວລາເລີ່ມ' : 'ລາກປັບເວລາສິ້ນສຸດ'}
                                  title={which === 'start' ? 'ລາກເພື່ອປັບເວລາເລີ່ມ' : 'ລາກເພື່ອປັບເວລາສິ້ນສຸດ'}
                                  onPointerDown={(ev) => startMaintResize(ev, which)}
                                  className={`absolute top-0 bottom-0 w-2 bg-orange-600/80 hover:bg-orange-700 pointer-events-auto cursor-move ${which === 'start' ? 'left-0' : 'right-0'}`}
                                  style={{ touchAction: 'none' }}
                                />
                              );
                            })}
                          </div>
                        )}

                        {hasRange && !showSel && ['start', 'end'].map(which => {
                          const edge = which === 'start' ? rangeStart : rangeEnd;
                          if (!sameLocalDay(edge, dayDate)) return null;
                          const leftPct = (1 + slotPos(edge)) * (100 / SLOT_COLS);
                          return (
                            <span
                              key={`edge-${which}`}
                              role="slider"
                              aria-label={which === 'start' ? 'ລາກປັບເວລາເລີ່ມ' : 'ລາກປັບເວລາສິ້ນສຸດ'}
                              title={`${which === 'start' ? 'ເລີ່ມ' : 'ສິ້ນສຸດ'} ${fmtDT(edge)} — ລາກເພື່ອປັບ`}
                              onPointerDown={(ev) => startMaintResize(ev, which)}
                              className="absolute top-[1px] bottom-[1px] w-2 rounded bg-orange-600/80 hover:bg-orange-700 pointer-events-auto cursor-move"
                              style={{ left: which === 'start' ? `calc(${leftPct}% - 8px)` : `${leftPct}%`, touchAction: 'none' }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2" translate="no">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-700">ພິມເວລາເອງ (ວັນທີ + ເວລາ)</p>
            <p className="text-[11px] text-gray-400">ລາກຂອບແຖບສີສົ້ມໃນຕາຕະລາງ (ຊ້າຍ/ຂວາ = ເວລາ, ຂຶ້ນ/ລົງ = ວັນ) ເພື່ອຍືດ/ຫົດ · ໃຊ້ຊ່ອງນີ້ສຳລັບປິດຂ້າມຄືນ ຫຼື ທ້າຍອາທິດ</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ເລີ່ມປິດບຳລຸງ <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={scheduleForm.start}
                min={toDateTimeLocalValue(new Date())}
                onChange={(e) => { setMaintPickStart(null); setScheduleForm(f => ({ ...f, start: e.target.value })); }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ສິ້ນສຸດ <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={scheduleForm.end}
                min={scheduleForm.start || toDateTimeLocalValue(new Date())}
                onChange={(e) => { setMaintPickStart(null); setScheduleForm(f => ({ ...f, end: e.target.value })); }}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400" translate="no">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300 text-[8px] leading-3 text-center text-red-500">✕</span>
            ມີການຈອງແລ້ວ (ຈະໄດ້ຮັບຜົນກະທົບ)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-100 border border-orange-400" />
            ປິດບຳລຸງຢູ່ແລ້ວ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-300/70 border border-gray-400" />
            ເວລາຜ່ານໄປແລ້ວ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-300/60 border border-orange-500" />
            ຊ່ວງທີ່ເລືອກ
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs" translate="no">
          {maintPickStart ? (
            <span className="text-orange-600 font-medium">
              ເລືອກຈຸດເລີ່ມແລ້ວ ({fmtDT(maintPickStart.s)}) — ກົດຈຸດສິ້ນສຸດຕໍ່ (ກົດ ◀ ▶ ເພື່ອປ່ຽນອາທິດ)
            </span>
          ) : hasRange ? (
            <span className="text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              {fmtDT(rangeStart)} → {fmtDT(rangeEnd)}
            </span>
          ) : (
            <span className="text-gray-400">ຍັງບໍ່ໄດ້ເລືອກເວລາ</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      {bookingNote && (() => {
        const b = bookingNote.booking;
        const room = roomForBooking(b);
        if (b.isMaintenance) {
          return (
            <div
              className="fixed z-[9999] pointer-events-none w-64 bg-gray-900/95 text-white text-xs rounded-xl p-3 shadow-xl space-y-2"
              style={bookingNoteStyle(bookingNote.rect)}
            >
              <p className="font-semibold text-orange-300">🔧 Maintenance — {room?.name || bookingRoomLabel(b)}</p>
              <div className="space-y-1 text-gray-200">
                <p className="flex gap-1.5"><span className="text-gray-400 shrink-0">ຊັ້ນ:</span> <span className="text-white font-medium">{room ? roomFloor(room) : '-'}</span></p>
                <p className="flex gap-1.5"><span className="text-gray-400 shrink-0">ຈຸດໃນຊັ້ນ:</span> <span className="text-white font-medium">{(room && roomSpot(room)) || '-'}</span></p>
              </div>
              <div className="pt-2 border-t border-white/15 space-y-1">
                <p className="flex gap-1.5 text-gray-300">
                  <span className="text-gray-400 shrink-0">ປິດຕັ້ງແຕ່:</span>
                  <span className="text-white font-medium">{fmtDT(b.windowStartAt)}</span>
                </p>
                <p className="flex gap-1.5 text-gray-300">
                  <span className="text-gray-400 shrink-0">ເຖິງ:</span>
                  <span className="text-white font-medium">{b.instant ? 'ຈົນກວ່າຈະເປີດໃຊ້ຄືນ' : fmtDT(b.windowEndAt)}</span>
                </p>
                {b.reason && (
                  <p className="flex gap-1.5 text-gray-300">
                    <span className="text-gray-400 shrink-0">ເຫດຜົນ:</span>
                    <span className="text-white font-medium">{b.reason}</span>
                  </p>
                )}
              </div>
            </div>
          );
        }
        return (
          <div
            className="fixed z-[9999] pointer-events-none w-64 bg-gray-900/95 text-white text-xs rounded-xl p-3 shadow-xl space-y-2"
            style={bookingNoteStyle(bookingNote.rect)}
          >
            <p className="font-semibold text-amber-300">{room?.name || bookingRoomLabel(b)}</p>
            <div className="space-y-1 text-gray-200">
              <p className="flex gap-1.5"><span className="text-gray-400 shrink-0">ຊັ້ນ:</span> <span className="text-white font-medium">{room ? roomFloor(room) : '-'}</span></p>
              <p className="flex gap-1.5"><span className="text-gray-400 shrink-0">ຈຸດໃນຊັ້ນ:</span> <span className="text-white font-medium">{(room && roomSpot(room)) || '-'}</span></p>
            </div>
            <div className="pt-2 border-t border-white/15 space-y-1">
              <p className="flex gap-1.5">
                <span className="text-gray-400 shrink-0">ຜູ້ຈອງຫ້ອງ:</span>
                <span className="text-white font-medium">{roomBookerLabel(b.bookedBy)}</span>
              </p>
              <p className="flex gap-1.5 text-gray-300">
                <span className="text-gray-400 shrink-0">ເວລາ:</span>
                <span>{fmtTime(b.startAt)}–{fmtTime(b.endAt)}</span>
              </p>
              {b.title && (
                <p className="flex gap-1.5 text-gray-300">
                  <span className="text-gray-400 shrink-0">ຫົວຂໍ້:</span>
                  <span className="text-white font-medium">{b.title}</span>
                </p>
              )}
            </div>
          </div>
        );
      })()}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ລະບົບຈອງຫ້ອງປະຊຸມ</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການ, ກວດສອບສະຖານະ ແລະ ຈອງຫ້ອງປະຊຸມອອນໄລນ໌</p>
          </div>
          <div className="flex items-center gap-2">
            {canImportBookings && (
              <CsvImportButton
                endpoint="/room-bookings/bulk-import"
                refresh={() => { fetchCalendarBookings(); fetchMyBookings(); }}
                permitted={canImportBookings}
                csvHint="CSV ການຈອງ: title, roomId, startAt, endAt (ISO datetime) — ຈຳເປັນ"
              />
            )}
            <CsvExportButton
              data={calendarBookings}
              filename="room-bookings.csv"
              label="Export ການຈອງ"
              permitted={hasPermission('rooms', 'read')}
              columns={[
                { key: 'title', label: 'title' },
                { label: 'room', value: (b) => (b.roomId?.name || b.roomId?._id || b.roomId || '') },
                { key: 'startAt', label: 'startAt' },
                { key: 'endAt', label: 'endAt' },
                { key: 'status', label: 'status' },
                { label: 'bookedBy', value: (b) => ([b.bookedBy?.firstName, b.bookedBy?.lastName].filter(Boolean).join(' ') || b.bookedBy?.email || (typeof b.bookedBy === 'string' ? b.bookedBy : '')) },
                { key: 'seriesId', label: 'seriesId' },
                { key: '_id', label: 'id' },
              ]}
            />
            <button
              onClick={() => {
                const firstRoom = rooms.length > 0 ? rooms[0] : null;
                setSelectedRoom(firstRoom ? (firstRoom.roomId || firstRoom._id) : '');
                setCalendarViewMode('week');
                setPickStart(null);
                setIsModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span>ຈອງຫ້ອງປະຊຸມ</span>
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'rooms' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ລາຍຊື່ຫ້ອງ ແລະ ປະຕິທິນ (Rooms & Calendar)
          </button>
          <button
            onClick={() => setActiveTab('my-bookings')}
            className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'my-bookings' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ການຈອງຂອງຂ້ອຍ (My Bookings)
          </button>
          {canSeeAdminTab && (
            <button
              onClick={() => { setActiveTab('admin'); if (canManageRooms) fetchUtilization(); if (canApproveBookings) fetchPendingApprovals(); }}
              className={`pb-3 text-sm font-medium transition border-b-2 ${activeTab === 'admin' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              ຈັດການຫ້ອງ (Admin)
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ຄົ້ນຫາຊື່ຫ້ອງ, ລະຫັດ ຫຼື ສະຖານທີ່..."
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="ລ້າງການຄົ້ນຫາ"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">

                <div>
                  <button
                    onClick={() => { setIsAvailOpen(!isAvailOpen); setIsFloorOpen(false); setIsLocationOpen(false); setIsCapOpen(false); }}
                    className={`border px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${availRooms ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                  >
                    <Clock size={16} />
                    <span>
                      {availRooms
                        ? `ວ່າງ ${availFrom.slice(5, 10).replace('-', '/')} ${availFrom.slice(11)}–${availTo.slice(11)}`
                        : 'ຫ້ອງວ່າງຕາມເວລາ'}
                    </span>
                  </button>
                </div>
                {availRooms && (
                  <button
                    onClick={clearAvailFilter}
                    className="px-3 py-2 text-xs text-amber-600 hover:text-amber-700 transition"
                  >
                    ລ້າງເວລາ
                  </button>
                )}

                <div className="relative" ref={floorRef}>
                  <button
                    onClick={() => { setIsFloorOpen(!isFloorOpen); setIsLocationOpen(false); setIsCapOpen(false); }}
                    className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
                  >
                    <Layers size={16} />
                    <span>ຊັ້ນ</span>
                    {floorFilter.length > 0 && <span className="text-amber-600">({floorFilter.length})</span>}
                  </button>

                  {isFloorOpen && (
                    <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-2">
                      <div className="max-h-60 overflow-y-auto">
                        {availableFloors.map((f) => (
                          <label key={f} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={floorFilter.includes(f)}
                              onChange={() => toggleFloorFilter(f)}
                              className="rounded"
                            />
                            <span className="truncate">{f}</span>
                          </label>
                        ))}
                        {availableFloors.length === 0 && (
                          <span className="block px-2 py-1.5 text-sm text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນຫ້ອງ</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={locationRef}>
                  <button
                    onClick={() => { setIsLocationOpen(!isLocationOpen); setIsFloorOpen(false); setIsCapOpen(false); }}
                    disabled={availableLocations.length === 0}
                    className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <MapPin size={16} />
                    <span>ຈຸດໃນຊັ້ນ</span>
                    {locationFilter.length > 0 && <span className="text-amber-600">({locationFilter.length})</span>}
                  </button>

                  {isLocationOpen && (
                    <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-2">
                      <div className="max-h-60 overflow-y-auto">
                        {availableLocations.map((loc) => (
                          <label key={loc} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={locationFilter.includes(loc)}
                              onChange={() => toggleLocationFilter(loc)}
                              className="rounded"
                            />
                            <span className="truncate">{loc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={capRef}>
                  <button
                    onClick={() => { setIsCapOpen(!isCapOpen); setIsFloorOpen(false); setIsLocationOpen(false); setIsAvailOpen(false); }}
                    className={`border px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${capActive ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                  >
                    <Users size={16} />
                    <span>{capLabel}</span>
                  </button>

                  {isCapOpen && (
                    <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3 space-y-3" translate="no">
                      <div className="flex flex-wrap gap-1.5">
                        {CAP_PRESETS.map((pr) => {
                          const on = capMin === pr.min && capMax === pr.max;
                          return (
                            <button
                              type="button"
                              key={pr.label}
                              onClick={() => { if (on) { setCapMin(''); setCapMax(''); } else { setCapMin(pr.min); setCapMax(pr.max); } }}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${on ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                              {pr.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">ຕ່ຳສຸດ (ຄົນ)</label>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={capMin}
                            onChange={(e) => setCapMin(e.target.value === '' ? '' : String(Math.max(0, Math.floor(Number(e.target.value)))))}
                            placeholder="ເຊັ່ນ 8"
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">ສູງສຸດ (ຄົນ)</label>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={capMax}
                            onChange={(e) => setCapMax(e.target.value === '' ? '' : String(Math.max(0, Math.floor(Number(e.target.value)))))}
                            placeholder="ເຊັ່ນ 20"
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      {capMin !== '' && capMax !== '' && Number(capMin) > Number(capMax) && (
                        <p className="text-[11px] text-red-500">ຄ່າຕ່ຳສຸດຕ້ອງບໍ່ຫຼາຍກວ່າຄ່າສູງສຸດ</p>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">ພົບ {filteredRooms.length} ຫ້ອງ</span>
                        {capActive && (
                          <button type="button" onClick={() => { setCapMin(''); setCapMax(''); }} className="text-amber-600 hover:text-amber-700">ລ້າງຄວາມຈຸ</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {activeLocationFilterCount > 0 && (
                  <button
                    onClick={clearLocationFilters}
                    className="px-3 py-2 text-xs text-amber-600 hover:text-amber-700 transition"
                  >
                    ລ້າງ ({activeLocationFilterCount})
                  </button>
                )}

                {canManageRooms && (
                  <button
                    onClick={openCreateRoomModal}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm shrink-0"
                  >
                    <Plus size={16} />
                    <span>ເພີ່ມຫ້ອງ</span>
                  </button>
                )}
              </div>
            </div>

            {isAvailOpen && (() => {
              const span = AVAIL_END_MIN - AVAIL_START_MIN;
              const ratio = (m) => (m - AVAIL_START_MIN) / span;
              const THUMB = 18;
              const posOf = (m) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${ratio(m)})`;
              const blockedUntil = availMinAllowed();
              const shownStart = Math.max(availRange.start, Math.min(blockedUntil, AVAIL_END_MIN - AVAIL_STEP));
              const shownEnd = Math.max(availRange.end, shownStart + AVAIL_STEP);
              const todayStr = availDateKey(new Date());
              return (
                <div className="-mt-4 bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-3">
                  <style>{`
                    .avail-range { position: absolute; left: 0; width: 100%; top: 0; height: 18px; margin: 0; background: transparent; pointer-events: none; -webkit-appearance: none; appearance: none; }
                    .avail-range::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; width: 18px; height: 18px; border-radius: 9999px; background: #f59e0b; border: 2px solid #fff; box-shadow: 0 0 0 1px #d97706; cursor: grab; }
                    .avail-range::-moz-range-thumb { pointer-events: auto; width: 14px; height: 14px; border-radius: 9999px; background: #f59e0b; border: 2px solid #fff; box-shadow: 0 0 0 1px #d97706; cursor: grab; }
                    .avail-range::-webkit-slider-runnable-track { background: transparent; }
                    .avail-range::-moz-range-track { background: transparent; }
                    .avail-range:disabled::-webkit-slider-thumb { background: #d1d5db; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
                    .avail-range:disabled::-moz-range-thumb { background: #d1d5db; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
                  `}</style>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700">ຄົ້ນຫາຫ້ອງວ່າງຕາມວັນ ແລະ ເວລາ</p>
                    <button type="button" onClick={() => setIsAvailOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">

                    <div className="md:w-56 shrink-0">
                      <label className="block text-xs font-medium text-gray-500 mb-1">ວັນທີ <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={availDate}
                        min={todayStr}
                        onChange={(e) => { setAvailDate(e.target.value); setAvailError(''); if (!e.target.value) clearAvailFilter(); }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-500">
                          ເວລາ {availDate ? '' : '— ກະລຸນາເລືອກວັນທີກ່ອນ'}
                        </label>
                        <span className="text-sm font-semibold text-amber-600">
                          {fmtMin(shownStart)} – {fmtMin(shownEnd)}
                        </span>
                      </div>
                      <div className="px-1">
                        <div className="relative" style={{ height: THUMB }}>
                          <div className="absolute left-0 right-0 rounded-full bg-gray-200" style={{ top: THUMB / 2 - 3, height: 6 }} />
                          <div
                            className={`absolute rounded-full ${availDate ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ top: THUMB / 2 - 3, height: 6, left: posOf(shownStart), width: `calc(${posOf(shownEnd)} - ${posOf(shownStart)})` }}
                          />
                          <input
                            type="range"
                            className="avail-range"
                            min={AVAIL_START_MIN}
                            max={AVAIL_END_MIN}
                            step={AVAIL_STEP}
                            value={shownStart}
                            disabled={!availDate}
                            onChange={(e) => handleAvailSlider('start', e.target.value)}
                            aria-label="ເວລາເລີ່ມ"
                          />
                          <input
                            type="range"
                            className="avail-range"
                            min={AVAIL_START_MIN}
                            max={AVAIL_END_MIN}
                            step={AVAIL_STEP}
                            value={shownEnd}
                            disabled={!availDate}
                            onChange={(e) => handleAvailSlider('end', e.target.value)}
                            aria-label="ເວລາສິ້ນສຸດ"
                          />
                        </div>

                        <div className="relative h-5 mt-1 text-[11px] text-gray-500">
                          {AVAIL_HOUR_LABELS.map(h => (
                            <span key={h} className="absolute -translate-x-1/2" style={{ left: posOf(h * 60) }}>
                              {String(h).padStart(2, '0')}:00
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {availLoading && <p className="text-xs text-gray-500">ກຳລັງຄົ້ນຫາ...</p>}
                  {availError && <p className="text-xs text-red-600">{availError}</p>}
                  {availRooms && !availLoading && (
                    <p className="text-xs text-gray-600">
                      {availRooms.length === 0
                        ? 'ບໍ່ມີຫ້ອງວ່າງໃນຊ່ວງເວລານີ້'
                        : `ພົບ ${availRooms.length} ຫ້ອງວ່າງ (${availFrom.slice(0, 10)} ${availFrom.slice(11)}–${availTo.slice(11)}) — ສະແດງເປັນບັດຫ້ອງດ້ານລຸ່ມ`}
                    </p>
                  )}
                </div>
              );
            })()}

            <p className="text-xs text-gray-400 -mt-4">
              ຄລິກທີ່ບັດຫ້ອງເພື່ອເພີ່ມ/ຖອດອອກຈາກຕາຕະລາງ — ຖ້າຢັງບໍ່ເລືອກຫ້ອງໃດ, ຕາຕະລາງຈະສະແດງທຸກຫ້ອງ
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
                  ກຳລັງໂຫຼດຂໍ້ມູນຫ້ອງປະຊຸມ...
                </div>
              ) : filteredRooms.length > 0 ? (
                filteredRooms.map((room) => {
                  const roomId = room.roomId || room._id;
                  const isSelected = selectedRoomIds.includes(roomId);

                  return (
                    <div
                      key={roomId}
                      onClick={() => toggleCalendarRoom(room)}
                      className={`bg-white p-5 rounded-2xl border transition shadow-sm space-y-4 flex flex-col justify-between cursor-pointer ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-gray-800 text-base">{room.name}</h3>
                            <p className="text-xs text-gray-400">ລະຫັດ: {roomId}</p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${room.liveStatus === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                            room.liveStatus === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {roomStatusLabel(room.liveStatus || room.status)}
                          </span>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1.5 pt-2 border-t border-gray-100">
                          <p className="flex items-center gap-2">
                            <Layers size={16} className="text-gray-400" />
                            <span>ຊັ້ນ: {roomFloor(room)}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400" />
                            <span>ຈຸດໃນຊັ້ນ: {roomSpot(room) || '-'}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <DoorClosed size={16} className="text-gray-400" />
                            <span>ຄວາມຈຸ: {room.capacity} ຄົນ</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoom(roomId);
                          if (availRooms && availFrom && availTo) {
                            setStartAt(availFrom);
                            setEndAt(availTo);
                            setPickStart(null);
                            setCalendarViewMode('week');
                            setCalendarAnchorDate(new Date(availFrom));
                          }
                          setIsModalOpen(true);
                        }}
                        className="w-full mt-4 bg-gray-50 hover:bg-amber-50 text-amber-600 border border-amber-200 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5"
                      >
                        <CalendarIcon size={16} />
                        <span>ເລືອກຈອງຫ້ອງນີ້</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
                  {activeLocationFilterCount > 0
                    ? 'ບໍ່ພົບຫ້ອງທີ່ກົງກັບຕົວກອນກອນຊັ້ນ/ຈຸດໃນຊັ້ນ — ລອງລ້າງຕົວກອນກອນ'
                    : searchQuery.trim()
                      ? 'ບໍ່ພົບຫ້ອງທີ່ກົງກັບການຄົ້ນຫາ'
                      : 'ຍັງບໍ່ມີຂໍ້ມູນຫ້ອງປະຊຸມ'}
                </div>
              )}
            </div>

            {renderCalendarPanel(calendarRooms, { selectedCount: selectedRoomIds.length, onShowAll: () => setSelectedRoomIds([]) })}
          </div>
        )}

        {activeTab === 'my-bookings' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800">
              ປະຫວັດ ແລະ ລາຍການການຈອງຫ້ອງປະຊຸມຂອງຂ້ອຍ
            </div>
            <div className="p-3 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={myQuery}
                  onChange={(e) => setMyQuery(e.target.value)}
                  placeholder="ຄົ້ນຫາ ຊື່ການຈອງ, ຫ້ອງ, ສະຖານະ, ວັນທີ..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {myQuery && (
                  <button type="button" onClick={() => setMyQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <select value={myStatusFilter} onChange={(e) => setMyStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="all">ທຸກສະຖານະ</option>
                <option value="needs_change">⚠️ ຕ້ອງແກ້ໄຂ</option>
                <option value="PENDING">ລໍຖ້າອະນຸມັດ</option>
                <option value="CONFIRMED">ອະນຸມັດແລ້ວ</option>
                <option value="upcoming">ກຳລັງຈະມາເຖິງ</option>
                <option value="past">ຜ່ານໄປແລ້ວ / ໃຊ້ງານແລ້ວ</option>
                <option value="REJECTED">ຖືກປະຕິເສດ</option>
                <option value="CANCELLED">ຍົກເລີກແລ້ວ</option>
              </select>
              <select value={myRoomFilter} onChange={(e) => setMyRoomFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="all">ທຸກຫ້ອງ</option>
                {[...new Set(myBookings.map(myBookingRoomName))].sort().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select value={mySort} onChange={(e) => setMySort(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" title="ຮຽງລຳດັບ">
                <option value="created_desc">ຮຽງ: ວັນທີສ້າງ (ໃໝ່ → ເກົ່າ)</option>
                <option value="created_asc">ຮຽງ: ວັນທີສ້າງ (ເກົ່າ → ໃໝ່)</option>
                <option value="start_desc">ຮຽງ: ວັນທີປະຊຸມ (ໃໝ່ → ເກົ່າ)</option>
                <option value="start_asc">ຮຽງ: ວັນທີປະຊຸມ (ເກົ່າ → ໃໝ່)</option>
                <option value="room_asc">ຮຽງ: ຊື່ຫ້ອງ (A → Z)</option>
              </select>
              {myFiltersActive && (
                <button type="button" onClick={resetMyFilters} className="px-3 py-2 text-sm rounded-xl text-gray-600 hover:bg-gray-200/60 flex items-center gap-1">
                  <X size={14} /> ລ້າງ
                </button>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {getVisibleMyBookings().length} / {myBookings.length} ລາຍການ
              </span>
            </div>
            {loadingMyBookings ? (
              <div className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
            ) : myBookings.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {getVisibleMyBookings().length === 0 && (
                  <div className="py-10 text-center text-sm text-gray-400">
                    ບໍ່ພົບການຈອງທີ່ຕົງກັບການຄົ້ນຫາ / ຕົວກັ່ນຕອງ
                    <div>
                      <button type="button" onClick={resetMyFilters} className="mt-2 text-blue-600 hover:underline">ລ້າງຕົວກັ່ນຕອງ</button>
                    </div>
                  </div>
                )}
                {getVisibleMyBookings().map((b) => {
                  const needsChange = bookingNeedsChange(b);
                  const roomName = b.room?.name || b.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ';
                  const past = isBookingPast(b);

                  const inactive = past || b.status === 'REJECTED';
                  const canModify = b.status === 'PENDING' || b.status === 'CONFIRMED' || !b.status;
                  return (
                    <div
                      key={b._id}
                      onClick={() => { setReportError(''); setDetailBooking(b); }}
                      title="ກົດເພື່ອເບິ່ງລາຍລະອຽດ"
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition cursor-pointer ${inactive ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'} ${needsChange ? 'mx-2 my-2 rounded-xl border-2 border-dashed border-red-500 bg-red-50/40' : ''}`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-base">ຫ້ອງ: {roomName}</span>
                          {b.title && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{b.title}</span>}
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${bookingStatusInfo(b.status).className}`}>
                            {bookingStatusInfo(b.status).label}
                          </span>
                          {needsChange && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">
                              ⚠️ ຕ້ອງແກ້ໄຂ
                            </span>
                          )}
                          {b.pendingStartAt && b.pendingEndAt && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">
                              ລໍຖ້າອະນຸມັດການເລື່ອນເວລາ
                            </span>
                          )}
                          {past && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                              {b.checkedOutAt ? 'Check-out ແລ້ວ' : 'ຜ່ານໄປແລ້ວ'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>ເລີ່ມ: {new Date(b.startAt).toLocaleString()} — ສິ້ນສຸດ: {new Date(b.endAt).toLocaleString()}</span>
                        </p>
                        {b.pendingStartAt && b.pendingEndAt && (
                          <p className="text-xs text-sky-700 bg-sky-50 rounded-lg px-2 py-1 mt-1">
                            ເວລາໃໝ່ທີ່ຂໍປ່ຽນ: {new Date(b.pendingStartAt).toLocaleString()} — {new Date(b.pendingEndAt).toLocaleString()} (ລໍຖ້າອະນຸມັດ; ຖ້າບໍ່ອະນຸມັດ ຈະຄົງເວລາເດີມ)
                          </p>
                        )}
                        {b.changeRequestedAt && b.status !== 'CANCELLED' && b.status !== 'REJECTED' && (
                          <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1.5 mt-1">
                            ⚠️ ຜູ້ອະນຸມັດຂໍໃຫ້ທ່ານ{b.changeRequestType === 'TIME' ? 'ປ່ຽນເວລາ' : b.changeRequestType === 'ROOM' ? 'ປ່ຽນໄປຫ້ອງອື່ນ (ຍົກເລີກແລ້ວຈອງໃໝ່)' : 'ປ່ຽນເວລາ ຫຼື ປ່ຽນຫ້ອງ'}: {b.changeRequestMessage}
                            {b.changeSuggestedStartAt && b.changeSuggestedEndAt && (
                              <span className="block font-semibold mt-0.5" translate="no">💡 ເວລາທີ່ແນະນຳ: {fmtShortDate(b.changeSuggestedStartAt)} {fmtHM(new Date(b.changeSuggestedStartAt))}–{fmtHM(new Date(b.changeSuggestedEndAt))}</span>
                            )}
                          </p>
                        )}
                        {!b.pendingStartAt && b.rescheduleRejectionReason && (
                          <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-2 py-1 mt-1">
                            ຄຳຮ້ອງເລື່ອນເວລາບໍ່ຖືກອະນຸມັດ: {b.rescheduleRejectionReason} (ການຈອງເດີມຍັງຄົງຢູ່)
                          </p>
                        )}
                        {b.rejectionReason && (
                          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 mt-1">
                            {b.status === 'REJECTED' ? 'ເຫດຜົນທີ່ປະຕິເສດ: ' : 'ເຫດຜົນທີ່ຍົກເລີກ: '}{b.rejectionReason}
                          </p>
                        )}
                        <BookingProgress booking={b} />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canModify && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRescheduleModal(b);
                              }}
                              aria-disabled={past}
                              title={past ? 'ປະຊຸມນີ້ຈົບແລ້ວ ເລື່ອນເວລາບໍ່ໄດ້' : 'ເລື່ອນເວລາ / ປ່ຽນຫ້ອງ'}
                              className={`px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium transition flex items-center gap-1 ${past ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                            >
                              <Edit3 size={14} />
                              <span>ເລື່ອນເວລາ / ປ່ຽນຫ້ອງ</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();

                                if (past) {
                                  alert('ປະຊຸມນີ້ຈົບແລ້ວ ຍົກເລີກບໍ່ໄດ້');
                                  return;
                                }
                                handleCancelBooking(b._id);
                              }}
                              aria-disabled={past}
                              title={past ? 'ປະຊຸມນີ້ຈົບແລ້ວ ຍົກເລີກບໍ່ໄດ້' : 'ຍົກເລີກການຈອງ'}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${past ? 'bg-red-50 text-red-400 opacity-40 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                            >
                              <Trash2 size={14} />
                              <span>ຍົກເລີກ</span>
                            </button>
                            {b.seriesId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (past) {
                                    alert('ປະຊຸມນີ້ຈົບແລ້ວ ຍົກເລີກບໍ່ໄດ້');
                                    return;
                                  }
                                  handleCancelSeries(b.seriesId);
                                }}
                                aria-disabled={past}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${past ? 'bg-red-100 text-red-400 opacity-40 cursor-not-allowed' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
                                title={past ? 'ປະຊຸມນີ້ຈົບແລ້ວ ຍົກເລີກບໍ່ໄດ້' : 'ຍົກເລີກທຸກຄັ້ງໃນຊຸດການຈອງແບບຊ້ຳນີ້'}
                              >
                                ຍົກເລີກທັງຊຸດ
                              </button>
                            )}
                          </>
                        )}
                        <ChevronRight size={18} className="text-gray-300 shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400">
                ທ່ານຍັງບໍ່ມີປະຫວັດການຈອງຫ້ອງປະຊຸມ
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && canSeeAdminTab && (
          <div className="space-y-6">
            <div className="flex border-b border-gray-200 gap-6">
              {canApproveBookings && (
                <button
                  type="button"
                  onClick={() => { setAdminSubTab('requests'); fetchPendingApprovals(); }}
                  className={`pb-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${adminSubTab === 'requests' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  ຄຳຮ້ອງຂໍຈອງ (Reservation Requests)
                  {pendingApprovals.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingApprovals.length}</span>
                  )}
                </button>
              )}
              {canManageRooms && (
                <button
                  type="button"
                  onClick={() => { setAdminSubTab('status'); fetchUtilization(); }}
                  className={`pb-3 text-sm font-medium transition border-b-2 ${adminSubTab === 'status' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  ຈັດການສະຖານະຫ້ອງ (Manage Room Status)
                </button>
              )}
            </div>
            {canApproveBookings && adminSubTab === 'requests' && (() => {
              const selectedPending = pendingApprovals.find(b => b._id === adminSelectedId) || null;
              const effectiveRoomId = String(
                adminRoomId
                || (selectedPending && bookingRoomId(selectedPending))
                || (pendingApprovals[0] && bookingRoomId(pendingApprovals[0]))
                || (rooms[0] && (rooms[0].roomId || rooms[0]._id))
                || ''
              );
              const roomPending = pendingApprovals.filter(b => String(bookingRoomId(b)) === effectiveRoomId);
              const roomConfirmed = adminConfirmed.filter(b => String(bookingRoomId(b)) === effectiveRoomId);
              const effPending = roomPending.map(b => {
                const dr = suggestMode ? suggestDraft[b._id] : null;
                return dr ? { ...b, startAt: dr.start.toISOString(), endAt: dr.end.toISOString() } : b;
              });
              const conflictingPending = roomPending.filter(b => blockedBy(b).length > 0 || conflictWith(b).length > 0);
              const weekStart = getWeekRange(adminWeek).from;
              const adminSegs = maintenanceSegments(weekStart, getWeekRange(adminWeek).to)
                .filter(sg => String(sg.roomId) === effectiveRoomId);
              const overlaps = (item, a0, a1) => new Date(item.startAt) < a1 && new Date(item.endAt) > a0;
              const selectedRoomObj = rooms.find(r => String(r.roomId || r._id) === effectiveRoomId) || null;

              const roomTokens = adminRoomQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
              const splitWords = (str) => String(str || '').toLowerCase().split(/[\s\-_/.,()[\]]+/).filter(Boolean);
              const roomSearchScore = (r) => {
                if (roomTokens.length === 0) return 0;
                const nameWords = splitWords(r.name);
                const otherWords = [String(r.roomId || r._id || ''), r.floor, r.location].flatMap(splitWords);
                const allWords = [...nameWords, ...otherWords];
                const everyTokenMatches = roomTokens.every(t => allWords.some(w => w.startsWith(t)));
                if (!everyTokenMatches) return -1;
                const fullName = String(r.name || '').toLowerCase();
                if (fullName.startsWith(roomTokens.join(' '))) return 0;
                if (roomTokens.every(t => nameWords.some(w => w.startsWith(t)))) return 1;
                return 2;
              };
              const matchedRooms = rooms
                .map(r => ({ r, score: roomSearchScore(r) }))
                .filter(x => x.score >= 0)
                .sort((x, y) => x.score - y.score || String(x.r.name || '').localeCompare(String(y.r.name || '')))
                .map(x => x.r);
              const pickAdminRoom = (r) => {
                setAdminRoomId(String(r.roomId || r._id));
                setAdminSelectedId(null);
                setAdminRoomOpen(false);
                setAdminRoomQuery('');
                cancelSuggest();
              };
              const pendingCountFor = (id) => pendingApprovals.filter(b => String(bookingRoomId(b)) === String(id)).length;

              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="font-bold text-gray-800">ຕາຕະລາງພາບລວມຄຳຮ້ອງຂໍຈອງ</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!suggestMode && conflictingPending.some(b => canMoveTime(b)) && (
                        <button
                          type="button"
                          onClick={() => {
                            const movable = conflictingPending.filter(b => canMoveTime(b));
                            setAdminWeek(new Date(movable[0].startAt));
                            startSuggest(movable);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-violet-50 border border-violet-300 text-violet-700 hover:bg-violet-100 transition"
                          title="ລາກແຖບຄຳຮ້ອງທີ່ຊົ່ວກັນເພື່ອແນະນຳເວລາໃໝ່"
                        >
                          ⇄ ແນະນຳເວລາ ({conflictingPending.filter(b => canMoveTime(b)).length})
                        </button>
                      )}
                      <div className="relative w-64" ref={adminRoomRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                        <input
                          type="text"
                          value={adminRoomOpen ? adminRoomQuery : (selectedRoomObj?.name || '')}
                          placeholder="ພິມເພື່ອຄົ້ນຫາ / ເລືອກຫ້ອງ..."
                          onFocus={(e) => { setAdminRoomQuery(''); setAdminRoomOpen(true); e.target.select?.(); }}
                          onChange={(e) => { setAdminRoomQuery(e.target.value); setAdminRoomOpen(true); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setAdminRoomOpen(false); e.target.blur(); }
                            if (e.key === 'Enter') { e.preventDefault(); if (matchedRooms[0]) pickAdminRoom(matchedRooms[0]); }
                          }}
                          className="w-full pl-9 pr-8 py-1.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        {adminRoomOpen && adminRoomQuery && (
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setAdminRoomQuery(''); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="ລ້າງການຄົ້ນຫາ"
                          >
                            <X size={15} />
                          </button>
                        )}
                        {adminRoomOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto py-1">
                            {matchedRooms.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-400">ບໍ່ພົບຫ້ອງທີ່ຄົ້ນຫາ</div>
                            ) : matchedRooms.map(r => {
                              const id = String(r.roomId || r._id);
                              const n = pendingCountFor(id);
                              return (
                                <button
                                  type="button"
                                  key={id}
                                  onMouseDown={(e) => { e.preventDefault(); pickAdminRoom(r); }}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-amber-50 ${id === effectiveRoomId ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'}`}
                                >
                                  <span className="truncate">
                                    {r.name}
                                    {(r.floor || r.location) && <span className="text-xs text-gray-400"> · {[r.floor, r.location].filter(Boolean).join(' ')}</span>}
                                  </span>
                                  {n > 0 && <span className="shrink-0 text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{n} ລໍຖ້າ</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setAdminWeek(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">◀</button>
                      <span className="text-xs text-gray-600 min-w-[110px] text-center">
                        {weekStart.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {getWeekRange(adminWeek).to.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                      </span>
                      <button type="button" onClick={() => setAdminWeek(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">▶</button>
                    </div>
                  </div>

                  <div className="px-4 pt-3 flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-gray-600" translate="no">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-4 rounded border border-red-300 bg-red-100 text-[9px] leading-[14px] text-center text-red-500" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(248,113,113,0.25) 0, rgba(248,113,113,0.25) 3px, transparent 3px, transparent 6px)' }}>✕</span>
                      ອະນຸມັດແລ້ວ
                    </span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-blue-400 bg-blue-100" /> ລໍຖ້າອະນຸມັດ</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border-2 border-red-500 bg-red-50" /> ລໍຖ້າອະນຸມັດ ແຕ່ຊົນກັບຄຳຮ້ອງ/ການຈອງອື່ນ</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded bg-green-300 border-2 border-green-600" /> ຄຳຮ້ອງທີ່ເລືອກ</span>
                    {suggestMode && (
                      <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded bg-violet-200 border-2 border-violet-600" /> ເວລາທີ່ແນະນຳ (ລາກໄດ້)</span>
                    )}
                    <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded border border-orange-400 bg-orange-200" /> ປິດບຳລຸງ (Maintenance)</span>
                  </div>

                  <div className="p-4">

                    <style>{`
                      @keyframes overlapFlash {
                        0%, 100% { border-color: transparent; box-shadow: 0 0 0 1px transparent, 0 0 8px 2px rgba(220, 38, 38, 0); }
                        50% { border-color: #dc2626; box-shadow: 0 0 0 1px #dc2626, 0 0 8px 2px rgba(220, 38, 38, 0.6); }
                      }
                      .overlap-flash { border-color: transparent; animation: overlapFlash 1.4s ease-in-out infinite; }
                      @media (prefers-reduced-motion: reduce) {
                        .overlap-flash { animation: none; border-color: #dc2626; box-shadow: 0 0 0 1px #dc2626; }
                      }
                    `}</style>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <div className="min-w-[1000px] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 text-center py-1.5" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                          <div>ວັນ / ເວລາ</div>
                          {hourHeaderSlots.map(time => (
                            <div key={time} className="text-left pl-1 border-l border-gray-300" style={{ gridColumn: 'span 2' }}>{time}</div>
                          ))}
                        </div>
                        <div className="divide-y divide-gray-100">
                          {weekDays.map(day => {
                            const dayDate = new Date(weekStart);
                            dayDate.setDate(dayDate.getDate() + (day.dayIndex - 1));

                            const items = [
                              ...roomConfirmed.filter(b => sameLocalDay(new Date(b.startAt), dayDate)).map(b => ({ b, kind: 'confirmed' })),
                              ...effPending.filter(b => sameLocalDay(new Date(b.startAt), dayDate)).map(b => ({ b, kind: 'pending' })),
                            ].filter(it => slotPos(new Date(it.b.endAt)) - slotPos(new Date(it.b.startAt)) > 0);
                            const laneOf = computeLanes(items.map(it => ({ start: new Date(it.b.startAt), end: new Date(it.b.endAt) })));
                            const maxLanes = items.length ? (Math.max(...laneOf) + 1) : 1;
                            const LANE_H = 28;
                            const rowH = Math.max(44, maxLanes * LANE_H + 8);

                            const overlapSegs = (() => {
                              const ivs = [];
                              for (let i = 0; i < items.length; i += 1) {
                                for (let j = i + 1; j < items.length; j += 1) {
                                  const st = Math.max(new Date(items[i].b.startAt).getTime(), new Date(items[j].b.startAt).getTime());
                                  const en = Math.min(new Date(items[i].b.endAt).getTime(), new Date(items[j].b.endAt).getTime());
                                  if (en > st && slotPos(new Date(en)) - slotPos(new Date(st)) > 0) ivs.push([st, en]);
                                }
                              }
                              ivs.sort((x, y) => x[0] - y[0]);
                              const merged = [];
                              ivs.forEach(iv => {
                                const last = merged[merged.length - 1];
                                if (last && iv[0] < last[1]) last[1] = Math.max(last[1], iv[1]);
                                else merged.push([iv[0], iv[1]]);
                              });
                              return merged;
                            })();

                            return (
                              <div key={day.key} data-admin-day={day.dayIndex} className="min-w-[1000px] relative select-none" style={{ height: rowH }}>
                                <div className="absolute inset-0 text-xs text-gray-500" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                                  <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-300 flex flex-col items-center justify-center gap-0.5">
                                    <span>{day.label}</span>
                                    <span className="text-[10px] font-normal text-gray-300">
                                      {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                                    </span>
                                  </div>
                                  {timeSlots.map(time => (
                                    <div key={time} className={`border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'}`} />
                                  ))}
                                </div>

                                {adminSegs
                                  .filter(sg => sameLocalDay(new Date(sg.startAt), dayDate))
                                  .map(sg => {
                                    const sgs = new Date(sg.startAt);
                                    const sge = new Date(sg.endAt);
                                    if (slotPos(sge) - slotPos(sgs) <= 0) return null;
                                    return (
                                      <div
                                        key={`m-${sg._id}`}
                                        className="absolute top-1 bottom-1 rounded border border-orange-400 bg-orange-100/90 text-orange-800 text-[10px] font-semibold flex items-start justify-center pt-0.5 overflow-hidden whitespace-nowrap"
                                        style={{ ...timelineBarStyle(sgs, sge), backgroundImage: MAINT_HATCH }}
                                        onMouseEnter={(e) => showBookingNote(e, sg)}
                                        onMouseLeave={hideBookingNote}
                                      >
                                        <span translate="no">🔧 Maintenance</span>
                                      </div>
                                    );
                                  })}

                                {suggestMode && Object.entries(suggestDraft)
                                  .filter(([, dr]) => isSuggestMoved(dr) && sameLocalDay(dr.origStart, dayDate)
                                    && slotPos(dr.origEnd) - slotPos(dr.origStart) > 0)
                                  .map(([gid, dr]) => (
                                    <div
                                      key={`ghost-${gid}`}
                                      className="absolute top-1 bottom-1 rounded border-2 border-dashed border-gray-400 bg-gray-100/50 pointer-events-none"
                                      style={timelineBarStyle(dr.origStart, dr.origEnd)}
                                      title="ເວລາເດີມ"
                                    />
                                  ))}

                                {items.map((it, idx) => {
                                  const { b, kind } = it;
                                  const bs = new Date(b.startAt);
                                  const be = new Date(b.endAt);
                                  const isSel = kind === 'pending' && !!selectedPending && selectedPending._id === b._id;
                                  const conflict = kind === 'pending' && (
                                    roomConfirmed.some(o => overlaps(o, bs, be))
                                    || effPending.some(o => o._id !== b._id && overlaps(o, bs, be))
                                  );
                                  const style = {
                                    ...timelineBarStyle(bs, be),
                                    top: 4 + laneOf[idx] * LANE_H,
                                    height: LANE_H - 4,
                                  };
                                  const timeLabel = `${fmtHM(bs)}–${fmtHM(be)}`;
                                  const label = (
                                    <span translate="no" key={`${b.startAt}|${b.endAt}`} className="truncate">
                                      {kind === 'confirmed' ? '✕ ' : conflict ? '⊗ ' : ''}{timeLabel}{b.title ? ` · ${b.title}` : ''}
                                    </span>
                                  );
                                  if (kind === 'confirmed') {
                                    return (
                                      <div
                                        key={`c-${b._id}`}
                                        className="absolute rounded border border-red-300 bg-red-100/80 text-red-600 text-[10px] font-semibold flex items-center justify-center px-1 overflow-hidden whitespace-nowrap"
                                        style={{ ...style, backgroundImage: 'repeating-linear-gradient(45deg, rgba(248,113,113,0.18) 0, rgba(248,113,113,0.18) 4px, transparent 4px, transparent 8px)' }}
                                        onMouseEnter={(e) => showBookingNote(e, b)}
                                        onMouseLeave={hideBookingNote}
                                      >
                                        {label}
                                      </div>
                                    );
                                  }
                                  const dragDraft = suggestMode ? suggestDraft[b._id] : null;
                                  if (dragDraft) {
                                    const movedBar = isSuggestMoved(dragDraft);
                                    return (
                                      <button
                                        type="button"
                                        key={`p-${b._id}`}
                                        onPointerDown={(e) => beginSuggestDrag(e, b, weekStart)}
                                        onMouseEnter={(e) => showBookingNote(e, b)}
                                        onMouseLeave={hideBookingNote}
                                        className={`absolute rounded text-[10px] font-semibold flex items-center justify-center px-1 overflow-hidden whitespace-nowrap cursor-grab active:cursor-grabbing z-10 ${movedBar
                                          ? 'bg-violet-200 border-2 border-violet-600 text-violet-900 shadow-md'
                                          : 'bg-violet-50 border-2 border-dashed border-violet-400 text-violet-700'}`}
                                        style={{ ...style, touchAction: 'none' }}
                                        title="ລາກເພື່ອແນະນຳເວລາໃໝ່"
                                      >
                                        ⇄ {label}
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      key={`p-${b._id}`}
                                      onClick={() => selectPendingRequest(b)}
                                      onMouseEnter={(e) => showBookingNote(e, b)}
                                      onMouseLeave={hideBookingNote}
                                      className={`absolute rounded text-[10px] font-semibold flex items-center justify-center px-1 overflow-hidden whitespace-nowrap cursor-pointer transition hover:brightness-95 ${isSel
                                        ? 'bg-green-300 border-2 border-green-600 text-green-900 z-10'
                                        : conflict
                                          ? 'bg-red-50 border-2 border-red-500 text-red-600'
                                          : 'bg-blue-100 border border-blue-400 text-blue-700'}`}
                                      style={style}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}

                                {overlapSegs.map(([st, en]) => (
                                  <div
                                    key={`ov-${st}-${en}`}
                                    className="overlap-flash absolute rounded pointer-events-none z-20 border-2 border-solid bg-transparent"
                                    style={{ ...timelineBarStyle(new Date(st), new Date(en)), top: 2, bottom: 2 }}
                                    title={`ຊ່ວງເວລາທີ່ຊ້ອນກັນ ${fmtHM(new Date(st))}–${fmtHM(new Date(en))}`}
                                  />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">
                      ກົດແຖບສີຟ້າ ຫຼື ກົດຄຳຮ້ອງໃນລາຍການດ້ານລຸ່ມ ເພື່ອເລືອກ (ແຖບສີຂຽວ). ແຖບສະແດງຕາມນາທີຈິງ; ຖ້າເວລາຊ້ອນກັນ ແຖບຈະແຍກລົງເປັນແຖວໃໝ່.
                    </p>

                    {suggestMode && (
                      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-violet-900 text-sm">ແນະນຳເວລາໃໝ່ໃຫ້ຜູ້ຈອງ</p>
                            <p className="text-xs text-violet-700">
                              ລາກແຖບສີມ່ວງໃນຕາຕະລາງ (ລາກຂຶ້ນ/ລົງເພື່ອປ່ຽນວັນ) ຫຼື ປ້ອນວັນ/ເວລາເລີ່ມເອງ — ໄລຍະເວລາຈະເທົ່າກັບທີ່ຜູ້ຈອງຂໍມາສະເໝີ.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {Object.entries(suggestDraft).map(([sid, dr]) => {
                            const bk = pendingApprovals.find(x => x._id === sid);
                            if (!bk) return null;
                            const who = [bk.bookedBy?.firstName, bk.bookedBy?.lastName].filter(Boolean).join(' ') || bk.bookedBy?.email || 'ບໍ່ລະບຸຜູ້ຈອງ';
                            const moved = isSuggestMoved(dr);
                            const issues = getSuggestIssues(sid, effectiveRoomId, roomConfirmed);
                            return (
                              <div key={sid} className={`rounded-lg bg-white border p-3 space-y-2 ${issues.length > 0 ? 'border-red-300' : moved ? 'border-violet-400' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="text-sm">
                                    <span className="font-semibold text-gray-800">{bk.title || 'ບໍ່ມີຫົວຂໍ້'}</span>
                                    <span className="text-xs text-gray-500"> · {who} · {durationMinutes(dr.origStart, dr.origEnd)} ນາທີ</span>
                                  </div>
                                  <span className="text-xs text-gray-400" translate="no">
                                    ເດີມ: {fmtShortDate(dr.origStart)} {fmtHM(dr.origStart)}–{fmtHM(dr.origEnd)}
                                  </span>
                                </div>
                                <div className="flex items-end gap-3 flex-wrap" translate="no">
                                  <label className="text-xs text-gray-500">
                                    ວັນທີ
                                    <input
                                      type="date"
                                      value={toDateInputValue(dr.start)}
                                      onChange={(e) => setSuggestFromInputs(sid, e.target.value, fmtHM(dr.start))}
                                      className="block mt-0.5 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-800"
                                    />
                                  </label>
                                  <label className="text-xs text-gray-500">
                                    ເລີ່ມ
                                    <input
                                      type="time"
                                      step={SUGGEST_STEP_MIN * 60}
                                      value={fmtHM(dr.start)}
                                      onChange={(e) => setSuggestFromInputs(sid, toDateInputValue(dr.start), e.target.value)}
                                      className="block mt-0.5 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-800"
                                    />
                                  </label>
                                  <div className="text-xs text-gray-500">
                                    ສິ້ນສຸດ (ອັດຕະໂນມັດ)
                                    <div className="mt-0.5 px-2 py-1 rounded-lg bg-gray-100 text-sm text-gray-800">{fmtHM(dr.end)}</div>
                                  </div>
                                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${moved ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {moved ? 'ເວລາແນະນຳ' : 'ບໍ່ປ່ຽນ'}
                                  </span>
                                </div>
                                {issues.length > 0 && (
                                  <p className="text-xs text-red-600 flex items-start gap-1.5">
                                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                    <span>{issues.join(' • ')}</span>
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {suggestError && <p className="text-xs text-red-600">{suggestError}</p>}

                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button type="button" onClick={resetSuggest} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">ຣີເຊັດ</button>
                          <button type="button" onClick={cancelSuggest} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">ຍົກເລີກ</button>
                          <button
                            type="button"
                            onClick={() => sendSuggestions(effectiveRoomId, roomConfirmed)}
                            disabled={suggestSending}
                            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {suggestSending ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳແນະນຳເວລາ (Suggest)'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {canApproveBookings && adminSubTab === 'requests' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="font-bold text-gray-800">ຄຳຮ້ອງຂໍຈອງທີ່ລໍຖ້າອະນຸມັດ</div>
                {pendingApprovals.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                    {pendingApprovals.length} ລາຍການ
                  </span>
                )}
              </div>

              {(pendingBlockedCount > 0 || pendingConflictCount > 0) && !loadingPending && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    {pendingBlockedCount > 0 && (
                      <>ມອງ {pendingBlockedCount} ຄຳຮ້ອງຊົ່ວກັນຫ້ອງທີ່ຖືກຈອງແລ້ວ — ກົດອະນຸມັດຈະບໍ່ຜ່ານ ຕ້ອງແກ້ໄຂຫຼືໃຫ້ຜູ້ຂໍປ່ຽນເວລາ. </>
                    )}
                    {pendingConflictCount > 0 && (
                      <>ມອງ {pendingConflictCount} ຄຳຮ້ອງຊົ່ວກັນເວລາໃນຫ້ອງເດີວກັນ — ກະລຸນາອະນຸມັດແລ້ວປະຕິເສດອື່ນ ຫຼື ໃຫ້ຜູ້ຂໍປ່ຽນເວລາກ່ອນ.</>
                    )}
                  </span>
                </div>
              )}
              {loadingPending ? (
                <div className="py-10 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
              ) : pendingApprovalsError ? (
                <div className="py-10 text-center text-sm text-red-500 px-4">
                  ⚠️ {pendingApprovalsError}
                </div>
              ) : pendingApprovals.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {pendingApprovals.map((b) => {
                    const roomName = b.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ';
                    const requesterName = [b.bookedBy?.firstName, b.bookedBy?.lastName].filter(Boolean).join(' ') || b.bookedBy?.email || 'ບໍ່ລະບຸຜູ້ຈອງ';
                    const isBlocked = blockedBy(b).length > 0;
                    const isConflicting = conflictWith(b).length > 0;
                    const showConflict = isBlocked || isConflicting;
                    return (
                      <div
                        key={b._id}
                        onClick={() => selectPendingRequest(b)}
                        title="ກົດເພື່ອເບິ່ງໃນຕາຕະລາງ"
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition ${adminSelectedId === b._id ? 'bg-green-50 ring-2 ring-inset ring-green-400' : showConflict ? 'bg-red-50/40 border-l-4 border-l-red-400' : 'hover:bg-gray-50'}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-800">ຫ້ອງ: {roomName}</span>
                            {b.title && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{b.title}</span>}
                            {b.seriesId && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">ຈອງແບບຊ້ຳ</span>}
                            {b.isReschedule && (
                              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md font-medium">ຄຳຮ້ອງເລື່ອນເວລາ</span>
                            )}
                            {isBlocked && (
                              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                                <AlertTriangle size={12} />
                                ເວລານີ້ຖືກຈອງແລ້ວ — ອະນຸມັດບໍ່ໄດ້
                              </span>
                            )}
                            {isConflicting && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                                <AlertTriangle size={12} />
                                ຊົ່ວກັນອີກ {conflictWith(b).length} ຄຳຮ້ອງ
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">ຜູ້ຂໍຈອງ: {requesterName}</p>
                          <p className="text-xs">
                            <span className={`inline-block px-2 py-0.5 rounded-md font-medium ${flexOf(b) === 'BOTH' ? 'bg-emerald-50 text-emerald-700' : flexOf(b) === 'NONE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                              ຖ້າຊົ່ວກັນ: {flexLabel(flexOf(b))}
                            </span>
                          </p>
                          {b.isReschedule && b.originalRoomId && String(b.originalRoomId?._id || b.originalRoomId) !== String(bookingRoomId(b)) && (
                            <p className="text-xs text-sky-700">ຂໍຍ້າຍຫ້ອງຈາກ: {b.originalRoomId?.name || '-'} → {roomName}</p>
                          )}
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Clock size={14} />
                            <span>ເລີ່ມ: {new Date(b.startAt).toLocaleString()} — ສິ້ນສຸດ: {new Date(b.endAt).toLocaleString()}</span>
                          </p>
                          {b.isReschedule && b.originalStartAt && b.originalEndAt && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Clock size={14} />
                              <span>ເວລາເດີມທີ່ອະນຸມັດແລ້ວ: {new Date(b.originalStartAt).toLocaleString()} — {new Date(b.originalEndAt).toLocaleString()}</span>
                            </p>
                          )}
                          {b.changeRequestedAt && (
                            <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-2 py-1">
                              ສົ່ງຄຳຂໍໃຫ້ຜູ້ຈອງແກ້ໄຂແລ້ວ ({new Date(b.changeRequestedAt).toLocaleString()}) — ລໍຖ້າຜູ້ຈອງປ່ຽນເວລາ/ຫ້ອງ: {b.changeRequestMessage}
                              {b.changeSuggestedStartAt && b.changeSuggestedEndAt && (
                                <span className="block font-medium" translate="no">💡 ເວລາທີ່ແນະນຳ: {fmtShortDate(b.changeSuggestedStartAt)} {fmtHM(new Date(b.changeSuggestedStartAt))}–{fmtHM(new Date(b.changeSuggestedEndAt))}</span>
                              )}
                            </p>
                          )}
                          {showConflict && (
                            <p className="text-xs text-red-600 flex items-start gap-1.5">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>ຊົ່ວກັບ: {conflictDetailText(b)}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => reviewBooking(b._id, 'approve').catch(err => alert(err.message))}
                            disabled={reviewingId === b._id}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
                          >
                            {reviewingId === b._id ? 'ກຳລັງດຳເນີນການ...' : '✓ ອະນຸມັດ'}
                          </button>
                          {showConflict && (
                            <button
                              onClick={() => openChangeModal(b)}
                              disabled={reviewingId === b._id}
                              title="ຂໍໃຫ້ຜູ້ຈອງປ່ຽນເວລາ ຫຼື ປ່ຽນຫ້ອງ ເພາະຕາຕະລາງຊົ່ວກັນ"
                              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
                            >
                              ↻ ຂໍໃຫ້ປ່ຽນ
                            </button>
                          )}
                          <button
                            onClick={() => openRejectModal(b)}
                            disabled={reviewingId === b._id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition disabled:opacity-50"
                          >
                            ✕ ປະຕິເສດ
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-gray-400">
                  ບໍ່ມີຄຳຮ້ອງຂໍລໍຖ້າອະນຸມັດ
                </div>
              )}
            </div>
            )}

            {canManageRooms && adminSubTab === 'status' && (() => {
              const statusRoom = statusRoomId
                ? rooms.find(r => String(r.roomId || r._id) === String(statusRoomId))
                : null;
              return renderCalendarPanel(statusRoom ? [statusRoom] : rooms, {
                selectedCount: statusRoom ? 1 : 0,
                onShowAll: () => setStatusRoomId(null),
              });
            })()}

            {canManageRooms && adminSubTab === 'status' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="font-bold text-gray-800">
                  ຈັດການສະຖານະຫ້ອງ (ວ່າງ / ກຳລັງໃຊ້ງານ / ປິດບຳລຸງ)
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canImportBookings && (
                    <CsvImportButton
                      endpoint="/rooms/bulk-import"
                      refresh={() => fetchRooms(true)}
                      permitted={canImportBookings}
                      csvHint="CSV ຫ້ອງ: branchId, name, capacity — ຈຳເປັນ; floor, location, amenities (ແບ່ງດ້ວຍ , ຫຼື ;), status (AVAILABLE/MAINTENANCE), isActive (true/false) — ເພີ່ມໄດ້"
                    />
                  )}
                  <CsvExportButton
                    data={rooms}
                    filename="rooms.csv"
                    label="Export ຫ້ອງ"
                    permitted={hasPermission('rooms', 'read')}
                    columns={[
                      { key: '_id', label: 'id' },
                      { key: 'name', label: 'name' },
                      { label: 'branchId', value: (r) => (r.branchId?._id || r.branchId || '') },
                      { label: 'floor', value: (r) => roomFloor(r) },
                      { label: 'location', value: (r) => roomSpot(r) },
                      { key: 'capacity', label: 'capacity' },
                      { label: 'amenities', value: (r) => (r.amenities || []).join('; ') },
                      { label: 'status', value: (r) => r.status || 'AVAILABLE' },
                      { key: 'isActive', label: 'isActive' },
                    ]}
                  />
                </div>
              </div>
              <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                ຄລິກທີ່ຫ້ອງເພື່ອສະແດງສະເພາະຫ້ອງນັ້ນໃນຕາຕະລາງ — ຄລິກອີກຄັ້ງເພື່ອສະແດງທຸກຫ້ອງ
              </p>
              <div className="divide-y divide-gray-100">
                {rooms.map(room => {
                  const roomId = room.roomId || room._id;
                  const isRoomPicked = statusRoomId != null && String(statusRoomId) === String(roomId);
                  const toggleStatusRoom = () => setStatusRoomId(isRoomPicked ? null : roomId);
                  const isMaintenance = room.status === 'MAINTENANCE';
                  const liveStatus = room.liveStatus || room.status;
                  const nowMs = Date.now();
                  const roomWindows = maintenanceWindows
                    .filter(w => String(w.roomId) === String(roomId) && new Date(w.endAt).getTime() > nowMs)
                    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
                  const roomAffected = affectedBookings.filter(b => String(bookingRoomId(b)) === String(roomId));
                  return (
                    <div
                      key={roomId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isRoomPicked}
                      onClick={(e) => { if (e.target.closest('button, a, input, select')) return; toggleStatusRoom(); }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStatusRoom(); }
                      }}
                      className={`p-4 space-y-3 cursor-pointer transition ${isRoomPicked ? 'bg-amber-50 ring-2 ring-inset ring-amber-500/40' : 'hover:bg-gray-50'}`}
                    >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-gray-800">{room.name} <span className="text-xs text-gray-400">({roomId})</span></div>
                        <div className="text-xs text-gray-500">
                          {roomFloor(room)}{roomSpot(room) ? ` — ${roomSpot(room)}` : ''} — ຄວາມຈຸ {room.capacity} ຄົນ
                        </div>
                      </div>
                      <div className="flex items-center gap-3">

                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${liveStatus === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' :
                          liveStatus === 'BOOKED' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                          ສະຖານະປັດຈຸບັນ: {roomStatusLabel(liveStatus)}
                        </span>
                        {canUpdateRooms && (
                        <button
                          onClick={() => toggleRoomStatus(room)}
                          disabled={statusUpdatingRoomId === roomId}
                          className={`px-4 py-2 rounded-lg text-xs font-medium transition ${isMaintenance
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                            } disabled:opacity-50`}
                        >
                          {statusUpdatingRoomId === roomId
                            ? 'ກຳລັງອັບເດດ...'
                            : isMaintenance ? 'ກົດເພື່ອເປີດໃຊ້ຄືນ →' : 'ກົດເພື່ອປິດບຳລຸງ →'}
                        </button>
                        )}
                      </div>
                    </div>
                    {canUpdateRooms && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openScheduleDialog(room)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
                        >
                          + ກຳນົດຊ່ວງເວລາປິດບຳລຸງ
                        </button>
                        {roomAffected.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setMaintenanceError(''); setMaintenanceDialog({ type: 'review', room }); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition flex items-center gap-1.5"
                          >
                            <AlertTriangle size={13} /> {roomAffected.length} ການຈອງໄດ້ຮັບຜົນກະທົບ — ກົດເພື່ອເບິ່ງ
                          </button>
                        )}
                        {roomWindows.map(w => {
                          const active = new Date(w.startAt).getTime() <= nowMs;
                          const chipPicked = selectedMaintId === String(w._id);
                          return (
                            <span
                              key={w._id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={chipPicked}
                              onClick={(e) => { e.stopPropagation(); if (e.target.closest('button')) return; setSelectedMaintId(chipPicked ? null : String(w._id)); }}
                              onKeyDown={(e) => {
                                if (e.target !== e.currentTarget) return;
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMaintId(chipPicked ? null : String(w._id)); }
                              }}
                              className={`inline-flex items-center gap-1.5 text-xs border rounded-full pl-3 pr-1.5 py-1 cursor-pointer transition ${chipPicked ? 'bg-orange-300 border-orange-600 text-orange-950 ring-2 ring-orange-400/60 font-semibold shadow-sm' : active ? 'bg-orange-200 border-orange-400 text-orange-900' : 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100'}`}
                            >
                              <span translate="no">🔧 {fmtDT(w.startAt)} → {fmtDT(w.endAt)}</span>
                              {w.reason && <span className="text-orange-700/80">· {w.reason}</span>}
                              <button
                                type="button"
                                onClick={() => openScheduleDialog(room, w)}
                                className="w-5 h-5 rounded-full hover:bg-orange-300/60 flex items-center justify-center"
                                aria-label="ແກ້ໄຂຊ່ວງເວລາປິດບຳລຸງ"
                                title="ແກ້ໄຂຊ່ວງເວລາປິດບຳລຸງຊ່ວງນີ້"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMaintenanceWindow(w)}
                                className="w-5 h-5 rounded-full hover:bg-orange-300/60 flex items-center justify-center"
                                aria-label="ຍົກເລີກການກຳນົດປິດບຳລຸງ"
                                title="ຍົກເລີກການກຳນົດປິດບຳລຸງຊ່ວງນີ້"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  );
                })}
                {rooms.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">ບໍ່ມີຫ້ອງໃນລະບົບ</div>
                )}
              </div>
            </div>
            )}

            {canManageRooms && adminSubTab === 'status' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="font-bold text-gray-800">ລາຍງານການໃຊ້ງານຫ້ອງ (Utilization Report)</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={utilFrom}
                    onChange={(e) => setUtilFrom(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                  />
                  <span className="text-xs text-gray-400">ຫາ</span>
                  <input
                    type="date"
                    value={utilTo}
                    onChange={(e) => setUtilTo(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={fetchUtilization}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium"
                  >
                    ດຶງລາຍງານ
                  </button>
                </div>
              </div>

              {loadingUtilization ? (
                <div className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
              ) : utilizationData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">ຫ້ອງ</th>
                        <th className="text-left px-4 py-2 font-semibold">ຈຳນວນນາທີທີ່ຖືກຈອງ</th>
                        <th className="text-left px-4 py-2 font-semibold">ຈຳນວນຄັ້ງທີ່ຈອງ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {utilizationData.map((row) => {
                        const roomInfo = rooms.find(r => (r.roomId || r._id) === row._id);
                        return (
                          <tr key={row._id}>
                            <td className="px-4 py-2 font-medium text-gray-800">{roomInfo?.name || row._id}</td>
                            <td className="px-4 py-2 text-gray-600">{Math.round(row.bookedMinutes)} ນາທີ</td>
                            <td className="px-4 py-2 text-gray-600">{row.bookingCount} ຄັ້ງ</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-gray-400">
                  ບໍ່ມີຂໍ້ມູນການໃຊ້ງານໃນຊ່ວງເວລານີ້ — ລອງເລືອກຊ່ວງວັນທີ ແລ້ວກົດ "ດຶງລາຍງານ"
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {isRoomModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">ເພີ່ມຫ້ອງປະຊຸມໃໝ່</h3>
                <button
                  onClick={() => setIsRoomModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateRoomSubmit} className="p-6 space-y-4">
                {roomFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                    {roomFormError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຊື່ຫ້ອງ (Name)</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={roomForm.name}
                    onChange={handleRoomInputChange}
                    placeholder="ເຊັ່ນ: ຫ້ອງປະຊຸມໃຫຼ່ 1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ (Branch)</label>
                  <select
                    name="branchId"
                    required
                    value={roomForm.branchId}
                    onChange={handleRoomInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- ເລືອກສາຂາ --</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b._id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ຊັ້ນ (Floor)</label>
                    <input
                      type="text"
                      name="floor"
                      value={roomForm.floor}
                      onChange={handleRoomInputChange}
                      placeholder="ເຊັ່ນ: ຊັ້ນ 2"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ຈຸດໃນຊັ້ນ (Location)</label>
                    <input
                      type="text"
                      name="location"
                      value={roomForm.location}
                      onChange={handleRoomInputChange}
                      placeholder="ເຊັ່ນ: ປີກຂວາ / ຫຼັກ B"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ຄວາມຈຸ (Capacity)</label>
                  <input
                    type="number"
                    name="capacity"
                    min="1"
                    required
                    value={roomForm.capacity}
                    onChange={handleRoomInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ອຸປະກອນຕິດຕັ້ງ (Amenities) — ແບ່ງດ້ວຍ , ຫຼື ;
                  </label>
                  <input
                    type="text"
                    name="amenities"
                    value={roomForm.amenities}
                    onChange={handleRoomInputChange}
                    placeholder="ເຊັ່ນ: ໂປັເກັດ, ກະດານຂຽວ, ກລ້ອງປະຊຸມ"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRoomModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                  >
                    ຍົກເລີກ
                  </button>
                  <button
                    type="submit"
                    disabled={roomSubmitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50"
                  >
                    {roomSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຂໍ້ມູນ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ຟອມຈອງຫ້ອງປະຊຸມອອນໄລນ໌</h2>
                <button onClick={() => { setIsModalOpen(false); setPickStart(null); setStartAt(''); setEndAt(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {bookingMessage.text && (
                <div className={`p-3 rounded-xl text-sm text-center font-medium ${bookingMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {bookingMessage.text}
                </div>
              )}

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ເລືອກຫ້ອງປະຊຸມ</label>
                  <select
                    value={selectedRoom}
                    onChange={(e) => {
                      const roomId = e.target.value;
                      setSelectedRoom(roomId);
                      setPickStart(null);
                      const room = rooms.find(r => (r.roomId || r._id) === roomId);
                      if (room) {
                        const id = room.roomId || room._id;
                        setSelectedRoomIds(prev => prev.includes(id) ? prev : [...prev, id]);
                      }
                    }}
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- ເລືອກຫ້ອງ --</option>
                    {rooms.map(room => {
                      const rId = room.roomId || room._id;
                      return (
                        <option key={rId} value={rId}>{room.name} ({rId})</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ຫົວຂໍ້ການປະຊຸມ (Meeting Title)</label>
                  <input
                    type="text"
                    placeholder="ປ້ອນຫົວຂໍ້ ຫຼື ວາລະການປະຊຸມ..."
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  {!selectedRoom ? (
                    <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      ກະລຸນາເລືອກຫ້ອງກ່ອນ ເພື່ອເບິ່ງເວລາທີ່ວ່າງ
                    </div>
                  ) : renderSlotPicker({
                    pickStart,
                    startVal: startAt,
                    endVal: endAt,
                    onSlotClick: handlePickerClick,
                    isOccupied: isSlotOccupied,
                    roomId: selectedRoom,
                    excludeId: null,
                    onManualChange: (st, en) => { setStartAt(st); setEndAt(en); setPickStart(null); },
                  })}
                </div>

                {(startAt && isOutsideWorkingHours(startAt)) || (endAt && isOutsideWorkingHours(endAt)) ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ ເວລາທີ່ເລືອກຢູ່ນອກຊ່ວງເວລາທຳການ 08:00 - 17:00 — ກະລຸນາກວດ AM/PM ໃຫ້ຖືກຕ້ອງ
                  </div>
                ) : null}

                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    ຖ້າເວລາທີ່ຂໍຈອງຊົ່ວກັບຄຳຮ້ອງອື່ນ ທ່ານສາມາດປ່ຽນຫຍັງໄດ້? <span className="text-red-500">*</span>
                  </p>
                  <select
                    value={flexChoice}
                    onChange={(e) => setFlexChoice(e.target.value)}
                    required
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none ${!flexChoice ? 'border-red-300 text-gray-500' : 'border-amber-400 text-gray-800'}`}
                  >
                    <option value="" disabled>-- ກະລຸນາເລືອກ --</option>
                    <option value="TIME">ປ່ຽນເວລາໄດ້ (Time) — ເລື່ອນໄປຊ່ວງເວລາອື່ນໃນຫ້ອງເດີມ</option>
                    <option value="ROOM">ປ່ຽນຫ້ອງໄດ້ (Room) — ຍ້າຍໄປຫ້ອງອື່ນທີ່ວ່າງໃນເວລາເດີມ</option>
                    <option value="BOTH">ປ່ຽນໄດ້ທັງສອງ (Time ແລະ Room)</option>
                    <option value="NONE">ບໍ່ປ່ຽນ (None) — ບໍ່ສາມາດປ່ຽນເວລາ ຫຼື ຫ້ອງໄດ້</option>
                  </select>
                  <p className={`text-xs ${!flexChoice ? 'text-red-600' : 'text-gray-500'}`}>
                    {!flexChoice
                      ? 'ກະລຸນາເລືອກຄຳຕອບກ່ອນຈອງ'
                      : `ຄຳຕອບຂອງທ່ານ: ${flexLabel(flexValue())} — ຜູ້ອະນຸມັດຈະໃຊ້ຂໍ້ມູນນີ້ເພື່ອແນະນຳຕົວເລືອກທີ່ເໝາະສົມທີ່ສຸດ`}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">ຈອງແບບຊ້ຳໆ (Recurring Booking)</span>
                  </label>

                  {isRecurring && (
                    <div className="grid grid-cols-2 gap-3 pl-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ຄວາມຖີ່</label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs"
                        >
                          <option value="daily">ທຸກໆມື້ (Daily)</option>
                          <option value="weekly">ທຸກໆອາທິດ (Weekly)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ຈົນເຖິງວັນທີ (Until)</label>
                        <input
                          type="date"
                          value={untilDate}
                          onChange={(e) => setUntilDate(e.target.value)}
                          required={isRecurring}
                          className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setIsModalOpen(false); setPickStart(null); setStartAt(''); setEndAt(''); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium">ຍົກເລີກ</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {submitting ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນການຈອງ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {confirmBookingOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800">ຢືນຢັນການຈອງ</h3>
              <div className="text-sm text-gray-600 space-y-0.5" translate="no">
                <p>ຫ້ອງ: <span className="font-medium text-gray-800">{(rooms.find(r => String(r.roomId || r._id) === String(selectedRoom)) || {}).name || selectedRoom}</span></p>
                <p>ຫົວຂໍ້: <span className="font-medium text-gray-800">{meetingTitle}</span></p>
                <p>ເວລາ: <span className="font-medium text-gray-800">{new Date(startAt).toLocaleString()} — {new Date(endAt).toLocaleString()}</span></p>
                {isRecurring && <p className="text-xs text-gray-500">ຈອງແບບຊ້ຳ — ຄຳຕອບນີ້ໃຊ້ກັບທຸກຄັ້ງໃນຊຸດ</p>}
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={16} /> ຄຳຕອບຂອງທ່ານ: {flexLabel(flexValue())}</p>
                {flexValue() === 'BOTH' && (
                  <p className="text-xs leading-relaxed">ຖ້າເວລານີ້ຊົ່ວກັບຄຳຮ້ອງອື່ນ ຜູ້ອະນຸມັດອາດຂໍໃຫ້ທ່ານ <b>ປ່ຽນເວລາ ຫຼື ປ່ຽນຫ້ອງ</b> ຢ່າງໃດຢ່າງໜຶ່ງ. ຕົວເລືອກນີ້ໃຫ້ໂອກາດໄດ້ຮັບອະນຸມັດສູງສຸດ.</p>
                )}
                {flexValue() === 'NONE' && (
                  <p className="text-xs leading-relaxed">ຖ້າເວລານີ້ຊົ່ວກັບຄຳຮ້ອງອື່ນ ທ່ານ<b>ບໍ່ຍອມປ່ຽນທັງເວລາ ແລະ ຫ້ອງ</b>. ຄຳຮ້ອງຂອງທ່ານອາດຖືກ <b>ປະຕິເສດ</b> ຖ້າມີການຊົ່ວກັນ.</p>
                )}
                {flexValue() === 'TIME' && (
                  <p className="text-xs leading-relaxed">ຖ້າເວລານີ້ຊົ່ວກັບຄຳຮ້ອງອື່ນ ທ່ານອາດຖືກຂໍໃຫ້ <b>ເລື່ອນເວລາ</b> ເທົ່ານັ້ນ (ຫ້ອງເດີມ). ຖ້າບໍ່ມີຊ່ວງເວລາທີ່ວ່າງ ຄຳຮ້ອງອາດຖືກ <b>ປະຕິເສດ</b> ເພາະທ່ານບໍ່ຍອມປ່ຽນຫ້ອງ.</p>
                )}
                {flexValue() === 'ROOM' && (
                  <p className="text-xs leading-relaxed">ຖ້າເວລານີ້ຊົ່ວກັບຄຳຮ້ອງອື່ນ ທ່ານອາດຖືກຂໍໃຫ້ <b>ຍ້າຍໄປຫ້ອງອື່ນ</b> ເທົ່ານັ້ນ (ເວລາເດີມ) ຊຶ່ງອາດມີຂະໜາດ/ສະຖານທີ່ຕ່າງຈາກທີ່ເລືອກ. ຖ້າບໍ່ມີຫ້ອງວ່າງ ຄຳຮ້ອງອາດຖືກ <b>ປະຕິເສດ</b> ເພາະທ່ານບໍ່ຍອມປ່ຽນເວລາ.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setConfirmBookingOpen(false)} disabled={submitting} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium">ກັບໄປແກ້ໄຂ</button>
                <button type="button" onClick={performBookingSubmit} disabled={submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {submitting ? 'ກຳລັງບັນທຶກ...' : 'ເຂົ້າໃຈແລ້ວ — ຢືນຢັນການຈອງ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {rescheduleModalOpen && currentBookingToReschedule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ເລື່ອນເວລາ / ປ່ຽນຫ້ອງ</h2>
                <button onClick={() => { setRescheduleModalOpen(false); setReschedulePickStart(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                ຫ້ອງ: <span className="font-medium text-gray-700">{currentBookingToReschedule.room?.name || currentBookingToReschedule.roomId?.name || bookingRoomLabel(currentBookingToReschedule)}</span>
                {' • '}ເວລາເດີມ: {new Date(currentBookingToReschedule.startAt).toLocaleString()} — {new Date(currentBookingToReschedule.endAt).toLocaleString()}
              </div>

              {currentBookingToReschedule.changeRequestedAt && (
                <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-xs text-violet-800 leading-relaxed">
                  ⚠️ ຜູ້ອະນຸມັດຂໍໃຫ້ແກ້ໄຂ: {currentBookingToReschedule.changeRequestMessage}
                  <br />ແຖບສີແດງໃນຕາຕະລາງຄືການຈອງທີ່ຊົ່ວກັບທ່ານ (ຊ່ອງ ⚠ ຄືຊ່ວງທີ່ຊົ່ວກັນ) — ເລືອກເວລາວ່າງໃໝ່ ຫຼື ປ່ຽນໄປຫ້ອງອື່ນ.
                </div>
              )}

              {currentBookingToReschedule.changeRequestedAt && currentBookingToReschedule.changeSuggestedStartAt && currentBookingToReschedule.changeSuggestedEndAt && (() => {
                const sugS = new Date(currentBookingToReschedule.changeSuggestedStartAt);
                const sugE = new Date(currentBookingToReschedule.changeSuggestedEndAt);
                const applied = newStartAt === toDateTimeLocalValue(sugS) && newEndAt === toDateTimeLocalValue(sugE)
                  && String(rescheduleRoomId) === String(bookingRoomId(currentBookingToReschedule));
                return (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-900 flex items-center justify-between gap-3 flex-wrap">
                    <span translate="no">
                      💡 ເວລາທີ່ຜູ້ອະນຸມັດແນະນຳ: <b>{fmtShortDate(sugS)} {fmtHM(sugS)}–{fmtHM(sugE)}</b> ({durationMinutes(sugS, sugE)} ນາທີ)
                    </span>
                    <button
                      type="button"
                      disabled={applied}
                      onClick={() => {
                        setRescheduleRoomId(String(bookingRoomId(currentBookingToReschedule)));
                        setNewStartAt(toDateTimeLocalValue(sugS));
                        setNewEndAt(toDateTimeLocalValue(sugE));
                        setReschedulePickStart(null);
                        setCalendarAnchorDate(sugS);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-60 disabled:cursor-default"
                    >
                      {applied ? '✓ ໃຊ້ເວລານີ້ແລ້ວ' : 'ໃຊ້ເວລານີ້'}
                    </button>
                  </div>
                );
              })()}

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ຫ້ອງ</label>
                  <select
                    value={rescheduleRoomId}
                    onChange={(e) => {
                      const nextRoomId = e.target.value;
                      setRescheduleRoomId(nextRoomId);
                      setReschedulePickStart(null);
                      // ຖ້າເວລາເດີມຂອງການຈອງວ່າງໃນຫ້ອງໃໝ່ (ບໍ່ຊົ່ວກັບການຈອງອື່ນ) → ຕື່ມເວລາໃຫ້ອັດຕະໂນມັດ
                      const bk = currentBookingToReschedule;
                      const os = new Date(bk.pendingStartAt || bk.startAt);
                      const oe = new Date(bk.pendingEndAt || bk.endAt);
                      const isOrigRoom = nextRoomId === String(bookingRoomId(bk));
                      const hitsKnownConflict = isOrigRoom && (bk.changeConflicts || [])
                        .some(c => new Date(c.startAt) < oe && new Date(c.endAt) > os);
                      const canAutoFill = !Number.isNaN(os.getTime()) && !Number.isNaN(oe.getTime())
                        && os > new Date()
                        && !hitsKnownConflict
                        && !isRangeOccupiedForRoom(nextRoomId, os, oe, bk._id);
                      setNewStartAt(canAutoFill ? toDateTimeLocalValue(os) : '');
                      setNewEndAt(canAutoFill ? toDateTimeLocalValue(oe) : '');
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    {rooms
                      .filter(r => r.isActive !== false)
                      .map(r => {
                        const id = String(r.roomId || r._id);
                        const isCurrent = id === String(bookingRoomId(currentBookingToReschedule));
                        const suggestedId = currentBookingToReschedule.changeRequestedAt && currentBookingToReschedule.changeSuggestedRoomId
                          ? String(currentBookingToReschedule.changeSuggestedRoomId)
                          : '';
                        const closed = r.status === 'MAINTENANCE';
                        return (
                          <option key={id} value={id} disabled={closed && !isCurrent}>
                            {r.name}{r.capacity ? ` (${r.capacity} ຄົນ)` : ''}{isCurrent ? ' — ຫ້ອງປັດຈຸບັນ' : ''}{!isCurrent && suggestedId && id === suggestedId ? ' — ⭐ ແນະນຳ (Recommended)' : ''}{closed ? ' — ປິດບຳລຸງ' : ''}
                          </option>
                        );
                      })}
                  </select>
                  {rescheduleRoomId && rescheduleRoomId !== String(bookingRoomId(currentBookingToReschedule)) && (
                    <p className="text-xs text-sky-700 mt-1">ກຳລັງຍ້າຍໄປຫ້ອງໃໝ່ — ເລືອກເວລາໃນຕາຕະລາງດ້ານລຸ່ມ (ສະແດງຕາມຫ້ອງທີ່ເລືອກ)</p>
                  )}
                </div>
                <div>
                  <span className="block text-xs text-gray-400 mb-1">
                    ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດໃນຕາຕະລາງ ເພື່ອເລືອກເວລາໃໝ່ (ຊ່ວງຫວ່າງຈະສະແດງສີຂາວ)
                  </span>
                  {renderSlotPicker({
                    pickStart: reschedulePickStart,
                    startVal: newStartAt,
                    endVal: newEndAt,

                    originalStartVal: currentBookingToReschedule.startAt,
                    originalEndVal: currentBookingToReschedule.endAt,
                    conflictRanges: (currentBookingToReschedule.changeRequestedAt
                      && String(rescheduleRoomId) === String(bookingRoomId(currentBookingToReschedule)))
                      ? (currentBookingToReschedule.changeConflicts || [])
                      : [],
                    onSlotClick: handleReschedulePickerClick,
                    roomId: String(rescheduleRoomId || bookingRoomId(currentBookingToReschedule)),
                    excludeId: currentBookingToReschedule._id,
                    onManualChange: (st, en) => { setNewStartAt(st); setNewEndAt(en); setReschedulePickStart(null); },
                    isOccupied: (dayIndex, time) => isSlotOccupiedForRoom(
                      String(rescheduleRoomId || bookingRoomId(currentBookingToReschedule)),
                      dayIndex,
                      time,
                      currentBookingToReschedule._id
                    ),
                  })}
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-4">
                  <p className="text-xs font-medium text-gray-400">ຫຼື ປ້ອນເວລາເອງ (Optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ເວລາເລີ່ມຕົ້ນໃໝ່</label>
                      <input
                        type="datetime-local"
                        value={newStartAt}
                        onChange={(e) => setNewStartAt(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ເວລາສິ້ນສຸດໃໝ່</label>
                      <input
                        type="datetime-local"
                        value={newEndAt}
                        onChange={(e) => setNewEndAt(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setRescheduleModalOpen(false); setReschedulePickStart(null); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm">ຍົກເລີກ</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm">ບັນທຶກ</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {maintenanceDialog && (() => {
          const dlgRoom = maintenanceDialog.room;
          const dlgRoomId = String(dlgRoom.roomId || dlgRoom._id);
          const dlgType = maintenanceDialog.type;
          const reviewList = affectedBookings.filter(b => String(bookingRoomId(b)) === dlgRoomId);
          const closeDialog = () => { setMaintenanceDialog(null); setMaintenanceError(''); setMaintPickStart(null); };
          const renderAffectedRows = (list, canCancel) => (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
              {list.map(b => {
                const st = bookingStatusInfo(b.status);
                return (
                  <div key={b._id} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 truncate">{b.title || 'ບໍ່ມີຫົວຂໍ້'}</div>
                      <div className="text-xs text-gray-500" translate="no">
                        {fmtDT(b.startAt)} – {fmtHM(new Date(b.endAt))} · {roomBookerLabel(b.bookedBy)}
                      </div>
                      <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full ${st.className}`}>{st.label}</span>
                      <span className={`inline-block mt-1 ml-1 text-[11px] px-2 py-0.5 rounded-full ${flexOf(b) === 'BOTH' ? 'bg-emerald-50 text-emerald-700' : flexOf(b) === 'NONE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                        ຜູ້ຈອງ: {flexLabel(flexOf(b))}
                      </span>
                      {b.changeRequestedAt && (
                        <span className="inline-block mt-1 ml-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                          ແຈ້ງໃຫ້ປ່ຽນແລ້ວ — ລໍຖ້າຜູ້ຈອງ
                        </span>
                      )}
                    </div>
                    {canCancel && (
                      <div className="shrink-0 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => requestChangeAffected([b._id])}
                          disabled={maintenanceBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {b.changeRequestedAt ? 'ແຈ້ງຊ້ຳ' : 'ແຈ້ງໃຫ້ປ່ຽນເວລາ/ຫ້ອງ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelAffected([b._id])}
                          disabled={maintenanceBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          ຍົກເລີກການຈອງ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={`bg-white rounded-2xl ${dlgType === 'schedule' ? 'max-w-2xl' : 'max-w-lg'} w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">
                    {dlgType === 'close' && 'ຫ້ອງນີ້ມີການຈອງທີ່ຈະໄດ້ຮັບຜົນກະທົບ'}
                    {dlgType === 'review' && 'ການຈອງທີ່ໄດ້ຮັບຜົນກະທົບຈາກການປິດບຳລຸງ'}
                    {dlgType === 'schedule' && (maintenanceDialog.editing ? 'ແກ້ໄຂຊ່ວງເວລາປິດບຳລຸງ' : 'ກຳນົດຊ່ວງເວລາປິດບຳລຸງ')}
                  </h2>
                  <button onClick={closeDialog} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {dlgType !== 'schedule' && (
                  <p className="text-sm text-gray-500">
                    ຫ້ອງ: <span className="font-medium text-gray-700">{dlgRoom.name}</span> <span className="text-xs text-gray-400">({dlgRoomId})</span>
                  </p>
                )}

                {dlgType === 'close' && (
                  <>
                    <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2 text-xs text-orange-800">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        ການປິດບຳລຸງຕອນນີ້ຈະກະທົບ {maintenanceDialog.bookings.length} ການຈອງ (ກຳລັງໃຊ້ ແລະ ທີ່ຈະມາເຖິງ).
                        ປິດໄດ້ທັນທີ — ການຈອງເຫຼົ່ານີ້ຈະຍັງຢູ່ຈົນກວ່າທ່ານຈະຍົກເລີກ ແລະ ເບິ່ງໄດ້ພາຍຫຼັງຜ່ານປຸ່ມສີສົ້ມຂອງຫ້ອງ.
                      </span>
                    </div>
                    {renderAffectedRows(maintenanceDialog.bookings, false)}
                  </>
                )}

                {dlgType === 'review' && (
                  reviewList.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-400">ບໍ່ມີການຈອງທີ່ໄດ້ຮັບຜົນກະທົບແລ້ວ</div>
                  ) : (
                    <>
                      <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2 text-xs text-orange-800">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          {reviewList.length} ການຈອງຢູ່ໃນຊ່ວງທີ່ຫ້ອງປິດບຳລຸງ. ແນະນຳໃຫ້ <b>ແຈ້ງຜູ້ຈອງປ່ຽນເວລາ / ປ່ຽນຫ້ອງ</b> (ຕາມທີ່ຜູ້ຈອງຕອບໄວ້) ກ່ອນ — ຫຼື ຍົກເລີກທີ່ລະອັນ / ທັງໝົດ.
                        </span>
                      </div>
                      {renderAffectedRows(reviewList, true)}
                    </>
                  )
                )}

                {dlgType === 'schedule' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ເລືອກຫ້ອງປະຊຸມ</label>
                      <select
                        value={dlgRoomId}
                        disabled={!!maintenanceDialog.editing}
                        onChange={(e) => {
                          const r = rooms.find(x => String(x.roomId || x._id) === e.target.value);
                          if (r) { setMaintenanceDialog({ type: 'schedule', room: r, editing: null }); setMaintenanceError(''); setMaintPickStart(null); }
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        {rooms.map(room => {
                          const rId = room.roomId || room._id;
                          return <option key={rId} value={rId}>{room.name} ({rId})</option>;
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ເຫດຜົນ (ບໍ່ບັງຄັບ)</label>
                      <input
                        type="text"
                        value={scheduleForm.reason}
                        onChange={(e) => setScheduleForm(f => ({ ...f, reason: e.target.value }))}
                        placeholder="ຕົວຢ່າງ: ສ້ອມແປງລະບົບແອ"
                        maxLength={300}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    {renderMaintenancePicker(dlgRoomId)}

                    {scheduleImpact.length > 0 && (
                      <>
                        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2 text-xs text-orange-800">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span className="leading-relaxed">
                            ຊ່ວງເວລານີ້ມີ {scheduleImpact.length} ການຈອງທີ່ຈະໄດ້ຮັບຜົນກະທົບ. ບັນທຶກໄດ້ທັນທີ ແລ້ວໃນຂັ້ນຕອນຕໍ່ໄປທ່ານສາມາດແຈ້ງຜູ້ຈອງໃຫ້ປ່ຽນເວລາ / ຫ້ອງ ຫຼື ຍົກເລີກການຈອງ.
                          </span>
                        </div>
                        {renderAffectedRows(scheduleImpact, false)}
                      </>
                    )}
                  </>
                )}

                {maintenanceError && <p className="text-xs text-red-500">{maintenanceError}</p>}

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  {dlgType === 'close' && (
                    <>
                      <button onClick={closeDialog} disabled={maintenanceBusy} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">ຍົກເລີກ</button>
                      <button onClick={() => confirmCloseRoom(true)} disabled={maintenanceBusy} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                        ປິດ ແລະ ຍົກເລີກການຈອງທັງໝົດ
                      </button>
                      <button onClick={() => confirmCloseRoom(false, true)} disabled={maintenanceBusy} className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                        ປິດ ແລະ ແຈ້ງໃຫ້ປ່ຽນເວລາ/ຫ້ອງ
                      </button>
                      <button onClick={() => confirmCloseRoom(false)} disabled={maintenanceBusy} className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                        ປິດບຳລຸງທັນທີ
                      </button>
                    </>
                  )}
                  {dlgType === 'review' && (
                    <>
                      <button onClick={closeDialog} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">ປິດໜ້າຕ່າງ</button>
                      {reviewList.length > 0 && (
                        <button
                          onClick={() => requestChangeAffected(reviewList.map(b => b._id))}
                          disabled={maintenanceBusy}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {maintenanceBusy ? 'ກຳລັງສົ່ງ...' : `ແຈ້ງໃຫ້ປ່ຽນທັງໝົດ (${reviewList.length})`}
                        </button>
                      )}
                      {reviewList.length > 0 && (
                        <button
                          onClick={() => cancelAffected(reviewList.map(b => b._id))}
                          disabled={maintenanceBusy}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {maintenanceBusy ? 'ກຳລັງຍົກເລີກ...' : `ຍົກເລີກທັງໝົດ (${reviewList.length})`}
                        </button>
                      )}
                    </>
                  )}
                  {dlgType === 'schedule' && (
                    <>
                      <button type="button" onClick={closeDialog} disabled={maintenanceBusy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-50">ຍົກເລີກ</button>
                      <button type="button" onClick={saveMaintenanceWindow} disabled={maintenanceBusy} className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                        {maintenanceBusy ? 'ກຳລັງບັນທຶກ...' : (maintenanceDialog.editing ? 'ບັນທຶກການແກ້ໄຂ' : 'ບັນທຶກການປິດບຳລຸງ')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {changeModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ຂໍໃຫ້ຜູ້ຈອງປ່ຽນເວລາ / ຫ້ອງ</h2>
                <button onClick={closeChangeModal} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {bookingToChange && (
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p>ຫ້ອງ: <span className="font-medium text-gray-700">{bookingToChange.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ'}</span></p>
                  <p>ຜູ້ຈອງ: <span className="font-medium text-gray-700">{[bookingToChange.bookedBy?.firstName, bookingToChange.bookedBy?.lastName].filter(Boolean).join(' ') || bookingToChange.bookedBy?.email || '-'}</span></p>
                  <p>ເວລາ: {new Date(bookingToChange.startAt).toLocaleString()} — {new Date(bookingToChange.endAt).toLocaleString()}</p>
                </div>
              )}

              <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-xs text-violet-800 leading-relaxed">
                ລະບົບຈະສົ່ງແຈ້ງເຕືອນໃຫ້ຜູ້ຈອງ ແລະ ຄຳຮ້ອງຈະຍັງລໍຖ້າຢູ່ (ບໍ່ຖືກປະຕິເສດ) ຈົນກວ່າຜູ້ຈອງຈະປ່ຽນເວລາ ຫຼື ຍົກເລີກແລ້ວຈອງຫ້ອງອື່ນ.
              </div>

              {bookingToChange && (() => {
                const flex = flexOf(bookingToChange);
                const rs = changeSuggestions.rooms;
                const loadingRooms = changeSuggestions.loading;
                let reco = '';
                if (flex === 'NONE') {
                  reco = 'ຜູ້ຈອງຕອບວ່າ "ບໍ່ສາມາດປ່ຽນໄດ້" → ບໍ່ມີຕົວເລືອກປ່ຽນ ພິຈາລະນາປະຕິເສດຄຳຮ້ອງນີ້ ຫຼື ຄຳຮ້ອງອື່ນທີ່ຊົ່ວກັນ';
                } else if (flex === 'TIME') {
                  reco = 'ຜູ້ຈອງຕອບວ່າ "ປ່ຽນໄດ້ສະເພາະເວລາ" → ແນະນຳເວລາໃໝ່ໃນຫ້ອງເດີມ (ໃຊ້ປຸ່ມ ⇄ ແນະນຳເວລາ ດ້ານລຸ່ມ)';
                } else if (loadingRooms) {
                  reco = 'ກຳລັງວິເຄາະຕົວເລືອກທີ່ດີທີ່ສຸດ...';
                } else if (flex === 'ROOM') {
                  reco = rs.length > 0
                    ? `ຜູ້ຈອງຕອບວ່າ "ປ່ຽນໄດ້ສະເພາະຫ້ອງ" → ແນະນຳຫ້ອງ ${rs[0].name} (${rs[0].capacity} ຄົນ) ທີ່ວ່າງໃນເວລາເດີມ`
                    : 'ຜູ້ຈອງປ່ຽນໄດ້ສະເພາະຫ້ອງ ແຕ່ບໍ່ມີຫ້ອງວ່າງໃນເວລານີ້ → ບໍ່ມີຕົວເລືອກ ພິຈາລະນາປະຕິເສດ ຫຼື ປິດຄຳຮ້ອງອື່ນ';
                } else {
                  reco = rs.length > 0
                    ? `ຜູ້ຈອງປ່ຽນໄດ້ທັງເວລາ ແລະ ຫ້ອງ — ມີ ${rs.length} ຫ້ອງວ່າງໃນເວລາເດີມ → ແນະນຳປ່ຽນຫ້ອງເປັນ ${rs[0].name} (ຜູ້ຈອງຮັກສາເວລາເດີມ)`
                    : 'ຜູ້ຈອງປ່ຽນໄດ້ທັງເວລາ ແລະ ຫ້ອງ ແຕ່ບໍ່ມີຫ້ອງວ່າງໃນເວລານີ້ → ແນະນຳປ່ຽນເວລາ (ຫ້ອງເດີມ)';
                }
                const bestType = flex === 'NONE' ? null : flex === 'TIME' ? 'TIME' : flex === 'ROOM' ? 'ROOM' : (rs.length > 0 ? 'ROOM' : 'TIME');
                const allowed = (v) => (v === 'TIME' ? ['TIME', 'BOTH'].includes(flex) : v === 'ROOM' ? ['ROOM', 'BOTH'].includes(flex) : flex === 'BOTH');
                return (
                  <>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
                      <p className="font-semibold">ຜູ້ຈອງຕອບຕອນຈອງ: {flexLabel(flex)}</p>
                      <p>💡 ຄຳແນະນຳ: {reco}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ໃຫ້ຜູ້ຈອງ</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { v: 'TIME', l: 'ປ່ຽນເວລາ' },
                          { v: 'ROOM', l: 'ປ່ຽນຫ້ອງ' },
                          { v: 'EITHER', l: 'ອັນໃດກໍໄດ້' },
                        ].map(o => {
                          const ok = allowed(o.v);
                          return (
                            <button
                              key={o.v}
                              type="button"
                              disabled={!ok}
                              title={ok ? '' : 'ຜູ້ຈອງບໍ່ຍອມໃຫ້ປ່ຽນໃນຮູບແບບນີ້'}
                              onClick={() => { setChangeType(o.v); setChangePickedRoomId(null); setChangeMessage(buildChangeSuggestion(bookingToChange, o.v)); }}
                              className={`px-2 py-2 rounded-xl text-sm border transition ${!ok ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400' : changeType === o.v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                            >
                              {o.l}
                              {ok && o.v === bestType && <span className="block text-[10px] font-normal">⭐ ແນະນຳ</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {changeType !== 'ROOM' && bookingToChange && canMoveTime(bookingToChange) && (
                <button
                  type="button"
                  onClick={openSuggestFromChange}
                  className="w-full px-3 py-2 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-medium transition"
                >
                  ⇄ ແນະນຳເວລາໃໝ່ — ລາກໃນຕາຕະລາງ ຫຼື ປ້ອນເອງ (ສົ່ງໃຫ້ທຸກຄຳຮ້ອງທີ່ຊົ່ວກັນ)
                </button>
              )}

              {changeType !== 'TIME' && bookingToChange && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-700">ຫ້ອງວ່າງທີ່ແນະນຳ</p>
                    <span className="text-[11px] text-gray-400">ເວລາດຽວກັນ · ຄວາມຈຸ ≥ ຫ້ອງເດີມ</span>
                  </div>
                  {changeSuggestions.loading && <p className="text-xs text-gray-500">ກຳລັງຄົ້ນຫາຫ້ອງວ່າງ...</p>}
                  {changeSuggestions.error && <p className="text-xs text-red-500">{changeSuggestions.error}</p>}
                  {!changeSuggestions.loading && !changeSuggestions.error && changeSuggestions.rooms.length === 0 && (
                    <p className="text-xs text-gray-500">ບໍ່ມີຫ້ອງວ່າງໃນເວລານີ້ທີ່ມີຄວາມຈຸເທົ່າກັນ ຫຼື ຫຼາຍກວ່າ</p>
                  )}
                  {changeSuggestions.rooms.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-1.5">
                      {changeSuggestions.rooms.map((r, ridx) => {
                        const rid = String(r.roomId || r._id);
                        const picked = changePickedRoomId === rid;
                        return (
                          <button
                            type="button"
                            key={rid}
                            aria-pressed={picked}
                            onClick={() => {
                              const next = picked ? null : rid;
                              setChangePickedRoomId(next);
                              setChangeMessage(buildChangeSuggestion(bookingToChange, changeType, next ? r : null));
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-3 transition ${picked ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-300' : 'border-gray-200 hover:bg-gray-50'}`}
                          >
                            <span className="min-w-0">
                              <span className="block font-medium text-gray-800 truncate">{r.name}</span>
                              <span className="block text-xs text-gray-500 truncate">
                                {roomFloor(r)}{roomSpot(r) ? ` — ${roomSpot(r)}` : ''}
                              </span>
                              {ridx === 0 && <span className="block text-[11px] text-emerald-700">⭐ ເໝາະທີ່ສຸດ (ຄວາມຈຸໃກ້ຄຽງຫ້ອງເດີມ)</span>}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-gray-600">{r.capacity} ຄົນ{picked ? ' ✓' : ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ຂໍ້ຄວາມເຖິງຜູ້ຈອງ <span className="text-red-500">*</span></label>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
                {changeError && <p className="text-xs text-red-500 mt-1">{changeError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeChangeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm">ຍົກເລີກ</button>
                <button
                  type="button"
                  onClick={submitChangeRequest}
                  disabled={changeSubmitting || changeMessage.trim().length < 3}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm disabled:opacity-50"
                >
                  {changeSubmitting ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳຂໍ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">
                  {bookingToReject?.isReschedule ? 'ປະຕິເສດຄຳຮ້ອງເລື່ອນເວລາ' : 'ປະຕິເສດຄຳຮ້ອງຂໍຈອງ'}
                </h2>
                <button onClick={closeRejectModal} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {bookingToReject?.isReschedule && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 flex items-start gap-2 text-xs text-sky-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    ການປະຕິເສດນີ້ຈະລຶບພຽງ "ຄຳຮ້ອງເລື່ອນເວລາ" ເທົ່ານັ້ນ —
                    ການຈອງທີ່ອະນຸມັດແລ້ວຈະຄົງຢູ່ຕາມເວລາເດີມ
                    {bookingToReject?.originalStartAt && (
                      <> ({new Date(bookingToReject.originalStartAt).toLocaleString()} — {new Date(bookingToReject.originalEndAt).toLocaleString()})</>
                    )}.
                  </span>
                </div>
              )}

              {bookingToReject && (
                <p className="text-sm text-gray-500">
                  ຫ້ອງ: <span className="font-medium text-gray-700">{bookingToReject.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ'}</span>
                </p>
              )}

              {bookingToReject && buildRejectSuggestion(bookingToReject) && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      ເວລານີ້ມີການຈອງແລ້ວ ຫຼື ຊົ່ວກັນຄຳຮ້ອງອື່ນ —
                      ຄັດລອກເຫດຜົນການປະຕິເສດໃຫ້ພ້ອມແລ້ວ ສາມາດແກ້ໄຂໄດ້
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRejectReason(buildRejectSuggestion(bookingToReject))}
                    className="text-xs font-medium text-amber-800 underline hover:text-amber-900"
                  >
                    ໃສ່ຂໍ້ຄຳແນະນຳໃຫ້ອີກ
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ເຫດຜົນການປະຕິເສດ <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="ຕົວຢ່າງ: ຫ້ອງຖືກຈອງໄວ້ແລ້ວສຳລັບກອງປະຊຸມອື່ນ..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  autoFocus
                />
                {rejectError && <p className="text-xs text-red-500 mt-1">{rejectError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeRejectModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm">ຍົກເລີກ</button>
                <button
                  type="button"
                  onClick={submitReject}
                  disabled={rejectSubmitting || rejectReason.trim().length < 3}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm disabled:opacity-50"
                >
                  {rejectSubmitting ? 'ກຳລັງປະຕິເສດ...' : 'ຢືນຢັນປະຕິເສດ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {detailBooking && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailBooking(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ລາຍລະອຽດການຈອງ</h2>
                <button onClick={() => setDetailBooking(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-800 text-base">
                  ຫ້ອງ: {detailBooking.room?.name || detailBooking.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ'}
                </span>
                {detailBooking.title && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{detailBooking.title}</span>
                )}
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${bookingStatusInfo(detailBooking.status).className}`}>
                  {bookingStatusInfo(detailBooking.status).label}
                </span>
                {detailBooking.pendingStartAt && detailBooking.pendingEndAt && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">
                    ລໍຖ້າອະນຸມັດການເລື່ອນເວລາ
                  </span>
                )}
                {isBookingPast(detailBooking) && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                    {detailBooking.checkedOutAt ? 'Check-out ແລ້ວ' : 'ຜ່ານໄປແລ້ວ'}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">ເລີ່ມ</span>
                  <span className="text-gray-700 font-medium text-right">{new Date(detailBooking.startAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">ສິ້ນສຸດ</span>
                  <span className="text-gray-700 font-medium text-right">{new Date(detailBooking.endAt).toLocaleString()}</span>
                </div>
              </div>

              {detailTimeline.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-3">ປະຫວັດການປ່ຽນແປງ</p>
                  <ol className="space-y-3">
                    {detailTimeline.map((e, idx) => {
                      const info = bookingHistoryInfo(e.action);
                      const hasRange = e.fromStartAt || e.toStartAt;
                      return (
                        <li key={idx} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${info.dot}`} />
                            {idx < detailTimeline.length - 1 && <span className="w-px flex-1 bg-gray-200 my-1" />}
                          </div>
                          <div className="text-xs pb-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-700">{info.label}</span>
                              {e.isPending && (
                                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">ລໍຖ້າອະນຸມັດ</span>
                              )}
                            </div>
                            {e.at && <p className="text-gray-400 mt-0.5">{new Date(e.at).toLocaleString()}</p>}
                            {hasRange && (
                              <p className="text-gray-600 mt-1 leading-relaxed">
                                {e.fromStartAt && e.toStartAt ? (
                                  <>
                                    <span className="text-gray-400">ເວລາເດີມ: </span>
                                    {new Date(e.fromStartAt).toLocaleString()} — {new Date(e.fromEndAt).toLocaleString()}
                                    <br />
                                    <span className="text-gray-400">ເວລາໃໝ່: </span>
                                    <span className="text-sky-700 font-medium">{new Date(e.toStartAt).toLocaleString()} — {new Date(e.toEndAt).toLocaleString()}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-gray-400">ເວລາ: </span>
                                    {new Date(e.toStartAt).toLocaleString()} — {new Date(e.toEndAt).toLocaleString()}
                                  </>
                                )}
                              </p>
                            )}
                            {e.actor && <p className="text-gray-500 mt-0.5">ໂດຍ: {e.actor}</p>}
                            {e.note && (
                              <p className="text-orange-700 bg-orange-50 rounded px-1.5 py-0.5 mt-1 inline-block">ເຫດຜົນ: {e.note}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {detailBooking.recurrence && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-400">ຈອງແບບຊ້ຳ</span>
                  <span className="text-gray-700 font-medium text-right">
                    {detailBooking.recurrence.frequency === 'daily' ? 'ປະຈຳວັນ' : 'ປະຈຳອາທິດ'}
                    {detailBooking.recurrence.until ? ` • ຮອດ ${new Date(detailBooking.recurrence.until).toLocaleDateString()}` : ''}
                  </span>
                </div>
              )}

              {Array.isArray(detailBooking.attendees) && detailBooking.attendees.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400">ຜູ້ເຂົ້າຮ່ວມ ({detailBooking.attendees.length})</span>
                  <p className="text-gray-700 mt-1">{detailBooking.attendees.join(', ')}</p>
                </div>
              )}

              {detailBooking.status === 'CONFIRMED' && isBookingPast(detailBooking) && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">ລາຍງານສະຫຼຸບການປະຊຸມ</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ເວລາປະຊຸມ, ຈຳນວນຄົນມາ/ບໍ່ມາ, ເວລາມາຮອດ, ໄລຍະເວລາທີ່ໃຊ້ຈິງ, ການຕໍ່ເວລາ ແລະ ເວລາສິ້ນສຸດ
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!reportBusy}
                      onClick={() => downloadMeetingReport(detailBooking, 'csv')}
                      className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <FileSpreadsheet size={14} />
                      {reportBusy === 'csv' ? 'ກຳລັງສ້າງ...' : 'ດາວໂຫຼດ CSV'}
                    </button>
                    <button
                      type="button"
                      disabled={!!reportBusy}
                      onClick={() => downloadMeetingReport(detailBooking, 'pdf')}
                      className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <FileDown size={14} />
                      {reportBusy === 'pdf' ? 'ກຳລັງສ້າງ...' : 'ດາວໂຫຼດ PDF'}
                    </button>
                  </div>
                  {reportError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reportError}</p>
                  )}
                </div>
              )}

              {detailBooking.status === 'CONFIRMED' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = detailBooking._id;
                    setDetailBooking(null);
                    navigate(`/room-status?invite=${encodeURIComponent(id)}`);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2">
                    <QrCode size={16} />
                    ເຊີນຄົນເຂົ້າຫ້ອງດ້ວຍ QR
                  </span>
                  <ChevronRight size={16} />
                </button>
              )}

              {(detailBooking.createdAt || detailBooking.updatedAt) && (
                <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-400">
                  {detailBooking.createdAt && (
                    <div className="flex justify-between gap-3">
                      <span>ສ້າງເມື່ອ</span>
                      <span className="text-right">{new Date(detailBooking.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                  {detailBooking.updatedAt && (
                    <div className="flex justify-between gap-3">
                      <span>ແກ້ໄຂຫຼ້າສຸດ</span>
                      <span className="text-right">{new Date(detailBooking.updatedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-3 pt-2">
                {detailBooking.status !== 'REJECTED' && detailBooking.status !== 'CANCELLED' && !isBookingPast(detailBooking) ? (
                  <button
                    type="button"
                    onClick={() => {

                      const id = detailBooking._id;
                      setDetailBooking(null);
                      handleCancelBooking(id);
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-1.5"
                  >
                    <Trash2 size={16} />
                    <span>ຍົກເລີກການຈອງ</span>
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setDetailBooking(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm"
                >
                  ປິດ
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}