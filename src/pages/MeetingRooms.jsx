import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Plus, DoorClosed, Clock, MapPin, Edit3, Trash2, Search, X, Layers, AlertTriangle, ChevronRight } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import BookingInvitePanel from '../components/BookingInvitePanel';
import { getSocket } from '../utils/socket';
import { useBranch } from '../contexts/BranchContext';
import { API_BASE_URL } from '../config';

export default function MeetingRooms() {
  const { selectedBranchId, branches } = useBranch();
  const [searchParams] = useSearchParams();
  const canApproveBookings = hasPermission('rooms', 'approve'); // ຄວບຄຸມການເຫັນ tab 'ຈັດການຫ້ອງ (Admin)'
  const canManageRooms = hasPermission('rooms', 'manage');
  const canUpdateRooms = hasPermission('rooms', 'update');
  const canImportBookings = hasPermission('rooms', 'import');
  const canCreateBooking = hasPermission('rooms', 'create');
  // tab 'admin' ມອກາມແທບຫຼາກ 'ອະນຸມັດ' ແລະ 'ລາຍການນຳໃຊ້ຫ້ອງ (Utilization)' ຈຶ່ງຕ້ອງມີ rooms.manage
  const canSeeAdminTab = canApproveBookings || canManageRooms;

  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'my-bookings' | 'admin'

  // States ສຳລັບ Rooms
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters: ຊັ້ນ (floor) -> ຈຸດໃນຊັ້ນ (position within the floor)
  const [floorFilter, setFloorFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [isFloorOpen, setIsFloorOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const floorRef = useRef(null);
  const locationRef = useRef(null);

  // States ສຳລັບ Modal ເພີ່ມຫ້ອງໃໝ່
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

  // States ສຳລັບ Calendar View
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // ຖ້າບໍ່ເລືອກຫ້ອງໃດ (ເປົ່າ) => ສະແດງທຸກຫ້ອງ
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [calendarViewMode, setCalendarViewMode] = useState('week'); // 'week' | 'day'
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(new Date()); // ວັນ/ອາທິດທີ່ກຳລັງເບິ່ງຢູ່

  // States ສຳລັບ My Bookings
  const [myBookings, setMyBookings] = useState([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(false);

  // States ສຳລັບ Booking Modal
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

  // States ສຳລັບ Filter "ຫ້ອງວ່າງຕາມເວລາ" (ຢູ່ຖັດຈາກ search/filter ໃນແຖບຫ້ອງ)
  const [isAvailOpen, setIsAvailOpen] = useState(false);
  const [availDate, setAvailDate] = useState(''); // 'YYYY-MM-DD' — ຕ້ອງເລືອກວັນທີກ່ອນ
  const [availRange, setAvailRange] = useState({ start: 9 * 60, end: 10 * 60 }); // ນາທີຂອງມື້ (slider)
  const [availFrom, setAvailFrom] = useState(''); // datetime-local ຂອງຊ່ວງທີ່ໃຊ້ filter ຢູ່
  const [availTo, setAvailTo] = useState('');
  const [availRooms, setAvailRooms] = useState(null); // null = ບໍ່ໄດ້ filter ຕາມເວລາ
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState('');

  // States ສຳລັບ Reschedule Modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [currentBookingToReschedule, setCurrentBookingToReschedule] = useState(null);
  const [newStartAt, setNewStartAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');
  const [reschedulePickStart, setReschedulePickStart] = useState(null); // ຈຸດເລີ່ມທີ່ເລືອກໃນຕາຕະລາງຂອງ modal ເລື່ອນເວລາ

  // States ສຳລັບ Admin tab (Maintenance toggle + Utilization report)
  const [utilizationData, setUtilizationData] = useState([]);
  const [loadingUtilization, setLoadingUtilization] = useState(false);
  const [utilFrom, setUtilFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [utilTo, setUtilTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusUpdatingRoomId, setStatusUpdatingRoomId] = useState(null);

  // States ສຳລັບ Admin tab — Pending Approvals
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingApprovalsError, setPendingApprovalsError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  // States ສຳລັບຕາຕະລາງພາບລວມຄຳຮ້ອງ (tab Admin)
  const [adminWeek, setAdminWeek] = useState(new Date());
  const [adminConfirmed, setAdminConfirmed] = useState([]); // ການຈອງທີ່ CONFIRMED ໃນອາທິດທີ່ກຳລັງເບິ່ງ
  const [adminRoomId, setAdminRoomId] = useState('');
  const [adminRoomQuery, setAdminRoomQuery] = useState(''); // ຂໍ້ຄວາມຄົ້ນຫາໃນຊ່ອງເລືອກຫ້ອງ
  const [adminRoomOpen, setAdminRoomOpen] = useState(false);
  const adminRoomRef = useRef(null);
  const [adminSelectedId, setAdminSelectedId] = useState(null); // ຄຳຮ້ອງ (pending) ທີ່ເລືອກ → ພື້ນຫຼັງສີຂຽວ

  // States ສຳລັບ popup ໃສ່ເຫດຜົນຕອນປະຕິເສດຄຳຮ້ອງຂໍຈອງ
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // ສຳລັບ popup ລາຍລະອຽດການຈອງ (ກົດລາຍການໃນ "ການຈອງຂອງຂ້ອຍ" ເພື່ອເບິ່ງຂໍ້ມູນ/ການປ່ຽນແປງ)
  const [detailBooking, setDetailBooking] = useState(null);

  // ສຳລັບ note hover ເທິງກ່ອງການຈອງໃນຕາຕະລາງປະຕິທິນ (ອາທິດ/ວັນ) — { booking, rect }
  const [bookingNote, setBookingNote] = useState(null);

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const fetchRooms = (silent = false, branchId = selectedBranchId) => {
    if (!silent) setLoading(true);
    setError(null);
    const branchParam = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    fetch(`${API_BASE_URL}/rooms${branchParam}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງປະຊຸມໄດ້');
        return res.json();
      })
      .then(data => {
        const roomList = Array.isArray(data) ? data : data.data || [];
        setRooms(roomList);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງປະຊຸມໄດ້');
        setLoading(false);
      });
  };

  // ຄິດໄລ່ຂອບເຂດ (Monday-Friday) ຂອງອາທິດທີ່ "ຈຸດວັນທີ" (anchor) ຢູ່
  const getWeekRange = (anchor) => {
    const day = anchor.getDay(); // 0=ອາທິດ, 1=ຈັນ, ... 6=ເສົາ
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
    // ດຶງການຈອງຂອງທຸກຫ້ອງໃນຊ່ວງເວລາຕາມ mode (ອາທິດ/ວັນ) ແລະ anchor date ທີ່ກຳລັງເບິ່ງຢູ່ —
    // ຖ້າບໍ່ສົ່ງ roomId, Backend ຈະຕອບກັບການຈອງທັງໝົດໃນຊ່ວງນັ້ນ (ໃຊ້ກັ່ນຕອງຕໍ່ຫ້ອງຢູ່ Frontend)
    const { from, to } = calendarViewMode === 'day'
      ? getDayRange(calendarAnchorDate)
      : getWeekRange(calendarAnchorDate);

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    fetch(`${API_BASE_URL}/room-bookings?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        const bookingsList = Array.isArray(data) ? data : data.data || [];
        setCalendarBookings(bookingsList);
      })
      .catch(() => setCalendarBookings([]));
  };

  const fetchMyBookings = (silent = false) => {
    if (!silent) setLoadingMyBookings(true);
    fetch(`${API_BASE_URL}/room-bookings/my`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setMyBookings(Array.isArray(data) ? data : data.data || []);
        setLoadingMyBookings(false);
      })
      .catch(() => setLoadingMyBookings(false));
  };

  // Org-wide room utilization report — ໃຊ້ endpoint GET /rooms/utilization?from=&to=
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

  // ລາຍການຄຳຮ້ອງຂໍຈອງທີ່ລໍຖ້າອະນຸມັດ — ສະເພາະຄົນທີ່ມີສິດ 'rooms:approve' ຈຶ່ງຈະ 200; ຄົນອື່ນຈະ 403
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  // Navbar "ສ້າງໃໝ່" → ເປີດ Modal ຈອງຫ້ອງປະຊຸມ ອັດຕະໂນມັດ
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalendarViewMode('week');
      setIsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('create')]);

  // ປິດ dropdown ຂອງ Filter (ຊັ້ນ / ຈຸດໃນຊັ້ນ) ເມື່ອກົດນອກພື້ນທີ່
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === 'my-bookings') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMyBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ດຶງຂໍ້ມູນການຈອງມາສະແດງໃນຕາຕະລາງ (ໂຫຼດການຈອງທຸກຫ້ອງໃນຊ່ວງເວລານັ້ນ ແລ້ວກັ່ນຕອງຕໍ່ຫ້ອງຢູ່ Frontend)
  useEffect(() => {
    fetchCalendarBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarViewMode, calendarAnchorDate]);

  // ຕາຕະລາງຄຳຮ້ອງໃນ tab Admin — ດຶງການຈອງ CONFIRMED ຂອງອາທິດທີ່ເບິ່ງຢູ່ (ແຍກຈາກຕາຕະລາງຫ້ອງ ເພື່ອບໍ່ຂຶ້ນກັບ mode ວັນ/ອາທິດ)
  // ດຶງໃໝ່ເມື່ອລາຍການ pending ປ່ຽນ (ລວມທັງຕອນ real-time refresh)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, adminWeek, pendingApprovals]);

  // ດຶງຂໍ້ມູນທຸກຢ່າງທີ່ໜ້ານີ້ສະແດງ ແບບ "ງຽບ" (ບໍ່ສະແດງ loading ກະພິບ) — ໃຊ້ໂດຍ WebSocket, polling ແລະ ຕອນກັບມາເບິ່ງ tab
  // ຕ້ອງເປັນ function ທີ່ອ່ານ state ລ່າສຸດສະເໝີ (ຜ່ານ ref ຂ້າງລຸ່ມ) — ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະດຶງອາທິດ/ມື້ເກົ່າທີ່ຄ້າງໃນ closure
  const refreshFromServer = () => {
    fetchRooms(true);
    fetchCalendarBookings();
    fetchMyBookings(true);
    if (activeTabRef.current === 'admin') {
      if (canApproveBookings) fetchPendingApprovals(true);
      if (canManageRooms) fetchUtilization(true);
    }
  };
  const refreshRef = useRef(refreshFromServer);
  refreshRef.current = refreshFromServer;

  // Real-time:
  //  1) WebSocket — ມີການຈອງ/ອະນຸມັດ/ປະຕິເສດ/ຍົກເລີກ/ເລື່ອນເວລາ/check-in/out ຫຼື ແກ້ໄຂຫ້ອງ → ດຶງໃໝ່ທັນທີ
  //  2) ເຊື່ອມຕໍ່ socket ໃໝ່ (reconnect) → ດຶງໃໝ່ ເພື່ອເກັບເຫດການທີ່ພາດໄປຕອນຫຼຸດ
  //  3) Polling ທຸກ 30 ວິນາທີ — ສະຖານະທີ່ປ່ຽນຕາມເວລາ (ກຳລັງໃຊ້ງານ / no-show / ເວລາຜ່ານໄປແລ້ວ) ບໍ່ມີເຫດການຈາກ Backend
  //  4) ກັບມາເບິ່ງ tab ນີ້ອີກຄັ້ງ → ດຶງໃໝ່
  useEffect(() => {
    const run = () => refreshRef.current();
    const socket = getSocket();
    if (socket) {
      socket.on('room-bookings:changed', run);
      socket.on('room:changed', run);
      socket.on('connect', run);
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (socket) {
        socket.off('room-bookings:changed', run);
        socket.off('room:changed', run);
        socket.off('connect', run);
      }
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fetchRooms(); // live status ອາດປ່ຽນຖ້າອະນຸມັດແລ້ວກົງກັບເວລາປັດຈຸບັນ
        fetchCalendarBookings();
        fetchMyBookings();
        return true;
      })
      .finally(() => setReviewingId(null));
  };

  // ຖ້າຄຳຮ້ອງຊົ່ວກັນເວລາ ຈະໃສ່ຂໍ້ຄຳແນະນຳໃຫ້ຢ່າງອັດຕະໂນມັດ (ປົດຊັ່ງຫຼືປ່ຽນໄດ້)
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

  const toggleRoomStatus = (room) => {
    const roomId = room.roomId || room._id;
    const nextStatus = room.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setStatusUpdatingRoomId(roomId);

    fetch(`${API_BASE_URL}/rooms/${roomId}/status`, {
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
      })
      .catch(err => alert(err.message))
      .finally(() => setStatusUpdatingRoomId(null));
  };

  // ຊ່ວງເວລາທຳການທີ່ຕາຕະລາງຮອງຮັບ — ໃຊ້ກວດສອບກ່ອນສົ່ງຟອມ ເພື່ອດັກຈັບກໍລະນີເລືອກ AM/PM ຜິດ
  const WORK_START_HOUR = 8;  // 08:00
  const WORK_END_HOUR = 17;   // 17:00 (ບໍ່ລວມ)

  const isOutsideWorkingHours = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const hour = d.getHours();
    const minutes = d.getMinutes();
    // ຫຼັງ 17:00 ພໍດີ (17:00:00) ຍັງນັບວ່າພາຍໃນຊົ່ວໂມງທຳການ ສຳລັບ endAt
    if (hour < WORK_START_HOUR) return true;
    if (hour > WORK_END_HOUR) return true;
    if (hour === WORK_END_HOUR && minutes > 0) return true;
    return false;
  };

  // Timeline ລາກເລືອກເວລາ: ສະແດງປ້າຍທຸກຊົ່ວໂມງ (08:00 – 17:00) ແຕ່ snap ທຸກ 30 ນາທີ
  const AVAIL_START_MIN = 8 * 60;
  const AVAIL_END_MIN = 17 * 60;
  const AVAIL_STEP = 30;
  const AVAIL_HOUR_LABELS = Array.from({ length: (AVAIL_END_MIN - AVAIL_START_MIN) / 60 + 1 }, (_, i) => 8 + i);

  const availDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  // ນາທີ "ຕອນນີ້" ຖ້າວັນທີທີ່ເລືອກແມ່ນມື້ນີ້ (ເວລາກ່ອນນັ້ນເລືອກບໍ່ໄດ້), ຖ້າເປັນວັນອະນາຄົດ = 0
  const availMinAllowed = () => {
    if (!availDate) return AVAIL_START_MIN;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (availDate < todayKey) return AVAIL_END_MIN; // ມື້ທີ່ຜ່ານໄປ — ເລືອກບໍ່ໄດ້
    if (availDate > todayKey) return AVAIL_START_MIN;
    return Math.max(AVAIL_START_MIN, Math.ceil((now.getHours() * 60 + now.getMinutes()) / AVAIL_STEP) * AVAIL_STEP);
  };

  // ຍ້າຍ slider (ຂະຫຍັບທຸກ 30 ນາທີ) — ມືຈັບຊ້າຍ = ເລີ່ມ, ມືຈັບຂວາ = ສິ້ນສຸດ
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

  // ຄົ້ນຫາຫ້ອງວ່າງອັດຕະໂນມັດ ເມື່ອເລືອກວັນທີ ຫຼື ຂະຫຍັບ slider (ລໍຖ້າ 400ms ຫຼັງຢຸດຂະຫຍັບ)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Fail-safe: ກັນອີກຊັ້ນໜຶ່ງກ່ອນສົ່ງຟອມ — ຖ້າເວລາເລີ່ມຕົ້ນຜ່ານໄປແລ້ວ ຈະບໍ່ອະນຸຍາດໃຫ້ຈອງ
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

    setSubmitting(true);
    setBookingMessage({ type: '', text: '' });

    const payload = {
      roomId: selectedRoom,
      title: meetingTitle,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
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
        setBookingMessage({ type: 'success', text: 'ສົ່ງຄຳຮ້ອງຂໍຈອງຫ້ອງປະຊຸມແລ້ວ — ລໍຖ້າຜູ້ມີສິດອະນຸມັດ' });

        // ສະຫຼັບປະຕິທິນໃຫ້ເຫັນ "ຫ້ອງທີ່ຫາກໍ່ຈອງ" ໂດຍອັດຕະໂນມັດ —
        // ເພີ່ມຫ້ອງນັ້ນເຂົ້າໃນລາຍການຫ້ອງທີ່ເລືອກ (ຖ້າຍັງບໍ່ມີ) ແລ້ວໂຫຼດການຈອງໃໝ່
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
        setBookingMessage({ type: 'error', text: err.message });
      });
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
      endAt: new Date(newEndAt).toISOString()
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
        // ຫຼັງເລື່ອນເວລາ: ຄຳຮ້ອງຈອງໃໝ່ (PENDING) ຫຼື ຄຳຮ້ອງເລື່ອນເວລາຂອງການຈອງທີ່ອະນຸມັດແລ້ວ (pendingStartAt)
        // ຕ້ອງລໍຖ້າຜູ້ມີສິດອະນຸມັດທັງສອງກໍລະນີ
        const needsRescheduleApproval = !!result?.pendingStartAt || result?.status === 'PENDING';
        alert(needsRescheduleApproval
          ? 'ສົ່ງຄຳຮ້ອງເລື່ອນເວລາແລ້ວ — ລໍຖ້າຜູ້ມີສິດອະນຸມັດ'
          : 'ເລື່ອນເວລາຈອງສຳເລັດແລ້ວ!');
      })
      .catch(err => alert(err.message));
  };

  // ຊ່ອງເວລາທຸກ 30 ນາທີ (08:00, 08:30, ... 16:30) — ຂ້າມພັກທ່ຽງ 12:00–13:00; ແຕ່ລະຊ່ອງ = 30 ນາທີ ເລີ່ມທີ່ເວລາທີ່ສະແດງ
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ];
  const SLOT_MINUTES = 30;
  // ປ້າຍຫົວຕາຕະລາງ: ສະແດງສະເພາະຊົ່ວໂມງເຕັມ (08:00, 09:00 ...) ແຕ່ລະປ້າຍກວມ 2 ຊ່ອງ
  const hourHeaderSlots = timeSlots.filter(t => t.endsWith(':00'));
  const SLOT_COLS = timeSlots.length + 1; // +1 = ຄໍລຳຊື່ວັນ
  // ຕຳແໜ່ງ (ໜ່ວຍ = 1 ຊ່ອງ) ຂອງເວລາໜຶ່ງໃນແກນເວລາທີ່ຂ້າມພັກທ່ຽງ — ໃຊ້ວາງ/ຍືດກ່ອງການຈອງຕາມນາທີຈິງ
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

  // ໃຊ້ຮ່ວມກັນລະຫວ່າງ Week view ແລະ Day view — ກວດວ່າ booking ນີ້ຄວນຂຶ້ນຢູ່ slot ນີ້ (ຊົ່ວໂມງ+ວັນ) ຂອງຫ້ອງນີ້ບໍ່
  // ແປສະຖານະການຈອງ (PENDING/CONFIRMED/REJECTED/CANCELLED) ໃຫ້ເປັນ label + ສີ
  const bookingStatusInfo = (status) => {
    switch (status) {
      case 'PENDING': return { label: 'ລໍຖ້າອະນຸມັດ', className: 'bg-amber-100 text-amber-700' };
      case 'CONFIRMED': return { label: 'ອະນຸມັດແລ້ວ', className: 'bg-green-100 text-green-700' };
      case 'REJECTED': return { label: 'ຖືກປະຕິເສດ', className: 'bg-red-100 text-red-700' };
      case 'CANCELLED': return { label: 'ຍົກເລີກແລ້ວ', className: 'bg-gray-100 text-gray-600' };
      default: return { label: status || 'ອະນຸມັດແລ້ວ', className: 'bg-green-100 text-green-700' };
    }
  };

  // ການຈອງທີ່ "ປະຊຸມຈົບແລ້ວ" ບໍ? (ເວລາສິ້ນສຸດຜ່ານໄປ) — ໃຊ້ກຳນົດວ່າເລື່ອນເວລາໄດ້ຫຼືບໍ່ ແລະ ສະແດງສີຈາງ
  const isBookingPast = (b) => {
    if (!b?.endAt) return false;
    return new Date(b.endAt).getTime() <= new Date().getTime();
  };

  // ປ້າຍ ແລະ ສີ ຂອງແຕ່ລະເຫດການໃນປະຫວັດການຈອງ
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

  // ສ້າງ timeline ຂອງການຈອງສຳລັບ popup — ໃຊ້ history ທີ່ເກັບໄວ້;
  // ຖ້າຂໍ້ມູນເກົ່າຍັງບໍ່ມີ history ຈະປະກອບຈາກ field ປັດຈຸບັນໃຫ້
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
    // ຄຳຮ້ອງເລື່ອນເວລາສຸດທ້າຍທີ່ຍັງລໍຖ້າອະນຸມັດ (ຍັງບໍ່ມີຜົນຕັດສິນ)
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

  // ແປສະຖານະຫ້ອງ (ຄ່າ enum ຈາກ Backend, 3 ຄ່າ: AVAILABLE / BOOKED / MAINTENANCE) ໃຫ້ເປັນຄຳລາວທີ່ອ່ານງ່າຍ
  const roomStatusLabel = (status) => {
    switch (status) {
      case 'BOOKED': return 'ກຳລັງໃຊ້ງານ';
      case 'MAINTENANCE': return 'ປິດບຳລຸງ';
      case 'AVAILABLE':
      default: return 'ວ່າງ';
    }
  };

  // ຈຸດຊັ້ນທີ່ຫ້ອງບໍ່ມີຂໍ້ມູນ (ຂໍ້ມູນເດີມທີ່ບໍ່ໄດ້ກອກ floor ໄວ້)
  const UNASSIGNED_FLOOR = 'ບໍ່ລະບຸຊັ້ນ';

  // ແຍກ "ຊັ້ນ" ອອກຈາກ "ຈຸດໃນຊັ້ນ" ຈາກ location ທີ່ມີຢູ່:
  //   ຂໍ້ມູນເດີມ (ບໍ່ມີ field floor) ບ່ອກ "3rd Floor, East Wing"  -> floor = "3rd Floor", spot = "East Wing"
  //   ຂໍ້ມູນໃໝ່  (ມີ field floor) ບ່ອກ "East Wing"              -> floor = "3rd Floor", spot = "East Wing"
  // ຮັກລວງຂໍ້ມູນເດີມໄວ້ໃຫ້ກອກໄດ້ ບໍ່ຕ້ອງແກ້ໄຂຂໍ້ມູນທັງໝົດ
  const splitRoomLocation = (room) => {
    const explicitFloor = String(room.floor || '').trim();
    const parts = String(room.location || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (explicitFloor) {
      // ຖ້າ location ຊ່ວມຊັ້ນໄວ້ເຊັ່ນໜຶ່ງ (ຂໍ້ມູນເດີມ) ໃຫ້ຕັດຊັ້ນອອກ ດຽວຂຶ້ນໄປຖືກວ່າເປັນ "ຈຸດໃນຊັ້ນ"
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

  // ຊື່ຜູ້ຈອງທີ່ຈະສະແດງໃນ note ຕອນ hover ບັດຫ້ອງ —
  // Backend ສົ່ງ booker = null ຖ້າຜູ້ເບິ່ງບໍ່ມີສິດເຫັນ (ສະແດງເປັນ "ຜູ້ໃຊ້ອື່ນ")
  const roomBookerLabel = (booker) => {
    if (!booker) return 'ຜູ້ໃຊ້ອື່ນ';
    const name = [booker.firstName, booker.lastName].filter(Boolean).join(' ').trim();
    return name || booker.email || 'ຜູ້ໃຊ້ອື່ນ';
  };

  // ຈຸດໃນຊັ້ນທີ່ມີຈິງ ສຳລັບຊັ້ນທີ່ເລືອກ (ສະຖານະ Filter ແບບຂຶ້ນລົງ) — ຖ້າຍັງບໍ່ເລືອກຊັ້ນ ໃຫ້ເອົາທຸກຊັ້ນ
  const spotsForFloors = (floorList) => {
    const source = floorList.length > 0
      ? rooms.filter((room) => floorList.includes(roomFloor(room)))
      : rooms;
    return new Set(source.map(roomSpot).filter(Boolean));
  };

  const availableFloors = [...new Set(rooms.map(roomFloor).filter(Boolean))].sort();
  const availableLocations = [...spotsForFloors(floorFilter)].sort();
  const activeLocationFilterCount = floorFilter.length + locationFilter.length;

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

  // POST /api/rooms — Backend ຈະອອກ _id (R001, R002, ...) ໃຫ້ເອງ ແລະ ປະການ room:changed ຈະ refresh ຫ້ອງທັງໜ້າ
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

  // ຊົ່ວງ Filter ຊັ້ນ / ຈຸດໃນຊັ້ນ
  const toggleFloorFilter = (floor) => {
    const next = floorFilter.includes(floor)
      ? floorFilter.filter((f) => f !== floor)
      : [...floorFilter, floor];
    setFloorFilter(next);
    // ລ້າງຈຸດໃນຊັ້ນທີ່ບໍ່ມີໃນຊັ້ນທີ່ເລືອກເພື່ອ ບໍ່ໃຫ້ຄົນເລືອກທີ່ບໍ່ມີຄືນວ່າງ
    const validSpots = spotsForFloors(next);
    setLocationFilter((prev) => prev.filter((s) => validSpots.has(s)));
  };

  const toggleLocationFilter = (spot) => {
    setLocationFilter((prev) => (prev.includes(spot) ? prev.filter((s) => s !== spot) : [...prev, spot]));
  };

  const clearLocationFilters = () => {
    setFloorFilter([]);
    setLocationFilter([]);
  };

  // ຊົ່ວງ Filter ຫ້ອງ — ຊື່ / ລະຫັດ / ສະຖານທີ່ + ຊັ້ນ + ຈຸດໃນຊັ້ນ
  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q
      || [room.name, String(room.roomId || room._id || ''), room.location, room.floor]
        .filter((f) => typeof f === 'string' && f)
        .some((f) => f.toLowerCase().includes(q));
    const matchesFloor = floorFilter.length === 0 || floorFilter.includes(roomFloor(room));
    const matchesLocation = locationFilter.length === 0 || locationFilter.includes(roomSpot(room));
    const matchesAvailability = !availRooms
      || availRooms.some((ar) => String(ar.roomId || ar._id) === String(room.roomId || room._id));
    return matchesSearch && matchesFloor && matchesLocation && matchesAvailability;
  });

  // ຫ້ອງທີ່ຈະສະແດງໃນຕາຕະລາງ — ຖ້າບໍ່ເລືອກຫ້ອງໃດ ຈະເອົາຫ້ອງທັງໝົດມາສະແດງ
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

  // ກວດຊົ່ວກັນໃຫ້ຜູ້ອະນຸມັດເຫັນກ່ອນກົດ "ອະນຸມັດ" —
  // Backend (findPendingApprovals) ຄຳນວນໃຫ້ມາແລ້ວ ເພື່ອໃຫ້ຄືກັນກັບ assertNoOverlap ເຊີ່ງ [startAt, endAt)
  //   conflictWith = ຄຳຮ້ອງ PENDING ອື່ນ ທີ່ຊົ່ວກັນ (ຕ້ອງເລືອກວ່າຈະອະນຸມັດລາຍການໃດ)
  //   blockedBy    = booking ທີ່ CONFIRMED ແລ້ວ ທີ່ຊົ່ວກັນ (ອະນຸມັດຈະໂດນ 409 ທັນທີ)
  const selectPendingRequest = (b) => {
    setAdminSelectedId(b._id);
    setAdminRoomId(String(bookingRoomId(b)));
    setAdminWeek(new Date(b.startAt));
  };

  const conflictWith = (b) => b.conflictWith || [];
  const blockedBy = (b) => b.blockedBy || [];

  const pendingBlockedCount = pendingApprovals.filter((b) => blockedBy(b).length > 0).length;
  const pendingConflictCount = pendingApprovals.filter((b) => conflictWith(b).length > 0).length;

  // ຄຳອະຢາງລະອຽດວ່າຊົ່ວກັນກັບໃຜ — ສະຫັງສະຕິຫ້ອງເວລາໃຫ້ຜູ້ອະນຸມັດຕັດສິນໃຈໄດ້ງ່າຢ
  const conflictDetailText = (b) => {
    const who = (o) => o.bookedBy?.firstName || o.bookedBy?.email || 'ບໍ່ລະບຸຜູ້ຈອງ';
    return [
      ...blockedBy(b).map((o) => `"${o.title || 'ບໍ່ມີຫົວຂໍ້'}" ຢູ່ໃນເວລາທີ່ CONFIRMED ແລ້ວ (${fmtTime(o.startAt)}–${fmtTime(o.endAt)})`),
      ...conflictWith(b).map((o) => `"${o.title || 'ບໍ່ມີຫົວຂໍ້'}" ຂອງ ${who(o)} (${fmtTime(o.startAt)}–${fmtTime(o.endAt)})`),
    ].join('  •  ');
  };

  // ຊື່ຫ້ອງຂອງ booking ນັ້ນ — ໃຊ້ສະແດງໃສ່ກ່ອງ booking ໃນຕາຕະລາງລວມ (ເພາະບໍ່ມີສ່ວນແຍກຕໍ່ຫ້ອງແລ້ວ)
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

  // note hover ເທິງກ່ອງການຈອງໃນປະຕິທິນ — ເກັບກ່ອງນັ້ນ + ຕຳແໜ່ງເທິງໜ້າຈໍ (fixed) ເພື່ອບໍ່ໃຫ້ຖືກ overflow ຂອງຕາຕະລາງຕັດ
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
    // ຖ້າຢູ່ໃກ້ຂອບເທິງ ໃຫ້ສະແດງລຸ່ມກ່ອງແທນ
    if (rect.top < 220) return { left, top: rect.bottom + margin };
    return { left, top: rect.top - margin, transform: 'translateY(-100%)' };
  };

  // ແປງເວລາໃຫ້ເປັນ HH:MM ເພື່ອສະແດງໃນ chip
  const fmtTime = (d) => {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // ຂໍ້ຄຳແນະນຳສຳລັບເຫດຜົນການປະຕິເສດ ໃຫ້ຜູ້ອະນຸມັດມີຂໍ້ຄຳໃຊ້ໄດ້ທັນທີ
  // ຄືນຄືນຂໍ້ວ່າງຫຼາຍຖ້າຄຳຮ້ອງບໍ່ມີການຊົ່ວກັນ (ປົດຊັ່ງໃຫ້ຜູ້ອະນຸມັດຂຽນເອງ)
  //   blockedBy    = ເວລານີ້ຖືກຈອງແລ້ວ (CONFIRMED) — ອະນຸມັດບໍ່ໄດ້ຢູ່ແລ້ວ
  //   conflictWith = ມີຄຳຮ້ອງ PENDING ອື່ນ ແຂ່ງເວລາດຽວກັນ
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

  // ກວດວ່າ booking ນີ້ເປັນຂອງຫ້ອງທີ່ກຳລັງສະແດງຢູ່ໃນຕາຕະລາງ (calendarRooms) ບໍ່
  const isBookingInCalendar = (b) => {
    const id = String(bookingRoomId(b));
    return calendarRooms.some((r) => String(r.roomId || r._id) === id);
  };

  // ຈັດ lane ໃຫ້ບັນດາການຈອງທີ່ເວລາຊ້ອນກັນ — ໃຫ້ lane ດຽວກັນບໍ່ໄດ້ ຈຶ່ງຈະບໍ່ທັບກັນ, ແຕ່ຍັງ stretch ຕາມເວລາເລີ່ມ–ສິ້ນສຸດ
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

  // ການຈອງ + lane ຂອງ Day view (ຄິດໄລ່ລ່ວງໜ້າເພື່ອໃຊ້ໃນ render)
  const dayViewBookings = calendarBookings
    .filter(b => isBookingInCalendar(b) && new Date(b.startAt).getDay() === calendarAnchorDate.getDay())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)
      || bookingRoomLabel(a).localeCompare(bookingRoomLabel(b)));
  const dayViewLaneOf = computeLanes(dayViewBookings.map(b => ({
    start: new Date(b.startAt),
    end: new Date(b.endAt),
  })));
  const dayViewMaxLanes = dayViewBookings.length ? (Math.max(...dayViewLaneOf) + 1) : 1;

  const toDateTimeLocalValue = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // ຫາວັນທີ-ເວລາຕົວຈິງຂອງ slot (dayIndex + time) ໃນອາທິດທີ່ Picker ກຳລັງສະແດງຢູ່
  const getSlotDateTime = (dayIndex, time) => {
    const base = new Date(getWeekRange(calendarAnchorDate).from);
    base.setDate(base.getDate() + (dayIndex - 1));
    const [h, m] = time.split(':').map(Number);
    base.setHours(h, m, 0, 0);
    return base;
  };

  // ກວດວ່າ slot ນີ້ມີວັນ/ເວລາຈິງຜ່ານໄປແລ້ວ (ຈອງບໍ່ໄດ້) — ເພື່ອກັນບໍ່ໃຫ້ກົດເລືອກຊ່ອງທີ່ໝົດເວລາແລ້ວ
  const isSlotInPast = (dayIndex, time) => {
    const slotDate = new Date(getSlotDateTime(dayIndex, time));
    return slotDate.getTime() <= new Date().getTime();
  };

  // ກວດວ່າ slot (ວັນ + ເວລາ) ຂອງຫ້ອງທີ່ລະບຸ ຖືກຈອງໄວ້ແລ້ວບໍ່ — ໃຊ້ຮ່ວມທັງຟອມຈອງຫ້ອງ ແລະ ຟອມເລື່ອນເວລາ
  // excludeBookingId: ຕອນເລື່ອນເວລາ ຕ້ອງບໍ່ນັບການຈອງຂອງໂຕເອງມາເປັນຕົວສະກັດ (ບໍ່ດັ່ງນັ້ນຈະເລືອກຊ່ອງເດີມບໍ່ໄດ້)
  const isRangeOccupiedForRoom = (roomId, rangeStart, rangeEnd, excludeBookingId = null) => (
    calendarBookings.some(b => {
      if (excludeBookingId && b._id === excludeBookingId) return false;
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(roomId)) return false;
      return new Date(b.startAt) < rangeEnd && new Date(b.endAt) > rangeStart;
    })
  );

  const addMinutes = (d, mins) => new Date(d.getTime() + mins * 60000);

  // ຊ່ອງ 30 ນາທີ [ເວລາຊ່ອງ, +30] ຖືກຈອງແລ້ວບໍ່
  const isSlotOccupiedForRoom = (roomId, dayIndex, time, excludeBookingId = null) => {
    const slotStart = getSlotDateTime(dayIndex, time);
    return isRangeOccupiedForRoom(roomId, slotStart, addMinutes(slotStart, SLOT_MINUTES), excludeBookingId);
  };

  const isSlotOccupied = (dayIndex, time) => isSlotOccupiedForRoom(selectedRoom, dayIndex, time);

  const isSlotInSelectedRange = (dayIndex, time, startVal = startAt, endVal = endAt) => {
    if (!startVal || !endVal) return false;
    const slotStart = getSlotDateTime(dayIndex, time);
    return slotStart >= new Date(startVal) && slotStart < new Date(endVal);
  };

  // ກົດເລືອກຈຸດເລີ່ມ ແລ້ວກົດອີກເທື່ອເພື່ອເລືອກຈຸດສິ້ນສຸດ — ແທນທີ່ຈະພິມວັນ/ເວລາເອງ
  // ຊ່ອງທີ່ກົດເປັນຈຸດສິ້ນສຸດ "ລວມຊ່ອງນັ້ນ" — ເວລາສິ້ນສຸດ = ເວລາຂອງຊ່ອງ + 30 ນາທີ (ຈຶ່ງເລືອກຈົບ xx:30 ແລະ 17:00 ໄດ້)
  const handlePickerClick = (dayIndex, time) => {
    if (!canCreateBooking) {
      setBookingMessage({ type: 'error', text: 'ທ່ານບໍ່ມີສິດຈອງຫ້ອງ' });
      return;
    }

    // Fail-safe: ຖ້າສຳເລັດກົດມາໄດ້ (UI ຄວນ disable ແລ້ວ) ໃຫ້ສະແດງຂໍ້ຜິດພາດ ແລະ ລຶບການເລືອກເວລາທີ່ຜ່ານໄປອອກ
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
      setPickStart({ dayIndex, time });
      setStartAt('');
      setEndAt('');
      return;
    }

    const startIdx = timeSlots.indexOf(pickStart.time);
    const clickedIdx = timeSlots.indexOf(time);

    if (clickedIdx < startIdx) {
      setPickStart({ dayIndex, time });
      return;
    }

    const rangeStart = getSlotDateTime(dayIndex, pickStart.time);
    const rangeEnd = addMinutes(getSlotDateTime(dayIndex, time), SLOT_MINUTES);

    if (isRangeOccupiedForRoom(selectedRoom, rangeStart, rangeEnd)) {
      alert('ຊ່ວງເວລານີ້ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ ກະລຸນາເລືອກໃໝ່');
      setPickStart(null);
      return;
    }

    setStartAt(toDateTimeLocalValue(rangeStart));
    setEndAt(toDateTimeLocalValue(rangeEnd));
    setPickStart(null);
  };

  // ປ່ຽນອາທິດທີ່ຕາຕະລາງກຳລັງສະແດງຢູ່ (ໃຊ້ຮ່ວມທັງຟອມຈອງ ແລະ ຟອມເລື່ອນເວລາ)
  // ເພາະທັງສອງໃຊ້ calendarAnchorDate ດຽວກັນ ຂໍ້ມູນ calendarBookings ຈຶ່ງຖືກດຶງມາໃຫ້ແລ້ວ
  const shiftAnchorWeek = (delta) => {
    setCalendarAnchorDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
    setPickStart(null);
    setReschedulePickStart(null);
  };

  // ກົດເລືອກເວລາໃນຟອມເລື່ອນເວລາ — ເຮັດວຽກຄືກັບ handlePickerClick ແຕ່ອັບເດດ newStartAt/newEndAt
  // ແລະ ກວດ slot ວ່າງຂອງຫ້ອງຂອງ booking ນັ້ນ (ຍົກເວັ້ນການຈອງຂອງໂຕເອງ)
  const handleReschedulePickerClick = (dayIndex, time) => {
    const booking = currentBookingToReschedule;
    if (!booking) return;

    const roomId = String(bookingRoomId(booking));
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
      setReschedulePickStart({ dayIndex, time });
      setNewStartAt('');
      setNewEndAt('');
      return;
    }

    const startIdx = timeSlots.indexOf(reschedulePickStart.time);
    const clickedIdx = timeSlots.indexOf(time);

    if (clickedIdx < startIdx) {
      setReschedulePickStart({ dayIndex, time });
      return;
    }

    const rangeStart = getSlotDateTime(dayIndex, reschedulePickStart.time);
    const rangeEnd = addMinutes(getSlotDateTime(dayIndex, time), SLOT_MINUTES);

    if (isRangeOccupiedForRoom(roomId, rangeStart, rangeEnd, excludeId)) {
      alert('ຊ່ວງເວລານີ້ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ ກະລຸນາເລືອກໃໝ່');
      setReschedulePickStart(null);
      return;
    }

    setNewStartAt(toDateTimeLocalValue(rangeStart));
    setNewEndAt(toDateTimeLocalValue(rangeEnd));
    setReschedulePickStart(null);
  };

  // ຕາຕະລາງເລືອກເວລາ (ວັນ x ຊົ່ວໂມງ) — ໃຊ້ຮ່ວມກັນລະຫວ່າງ "ຟອມຈອງຫ້ອງ" ແລະ "ຟອມເລື່ອນເວລາ"
  // ເພື່ອໃຫ້ເຫັນຊ່ອງວ່າງແລະ ເລືອກເວລາໄດ້ຄືກັນໝົດ
  // originalStartVal/originalEndVal = ເວລາເດີມຂອງ booking ທີ່ກຳລັງຈະເລື່ອນ (ສະແດງໄຮໄລ້ແບບຈາງໆ ເພື່ອທຽບກັບເວລາໃໝ່)
  const renderSlotPicker = ({ pickStart, startVal, endVal, onSlotClick, isOccupied, originalStartVal = null, originalEndVal = null }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          ເລືອກເວລາ — ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດ
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
                  <div key={day.key} className="min-w-[1000px] items-stretch" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                    <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-300 py-2 flex flex-col items-center justify-center gap-0.5">
                      <span>{day.label}</span>
                      <span className="text-[10px] font-normal text-gray-300">
                        {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {timeSlots.map(time => {
                      const occupied = isOccupied(day.dayIndex, time);
                      const isPast = isSlotInPast(day.dayIndex, time);
                      const isChosenStart = pickStart && pickStart.dayIndex === day.dayIndex && pickStart.time === time;
                      const isDisabled = isPast || occupied;
                      const isInRange = isSlotInSelectedRange(day.dayIndex, time, startVal, endVal);
                      const isInOriginalRange = isSlotInSelectedRange(day.dayIndex, time, originalStartVal, originalEndVal);
                      return (
                        <button
                          type="button"
                          key={time}
                          disabled={isDisabled}
                          onClick={() => onSlotClick(day.dayIndex, time)}
                          className={`h-9 border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'} text-[10px] transition ${isPast
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                            : isDisabled
                              ? 'bg-red-50 text-red-300 cursor-not-allowed'
                              : occupied
                                ? 'bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer'
                                : isChosenStart
                                  ? 'bg-amber-500 text-white font-semibold'
                                  : isInRange
                                    ? 'bg-amber-100 text-amber-700 font-semibold border-amber-200'
                                    : isInOriginalRange
                                      ? 'bg-sky-50 text-sky-500 ring-1 ring-inset ring-sky-200 hover:bg-sky-100 cursor-pointer'
                                      : 'bg-white hover:bg-amber-50 text-gray-300'
                          }`}
                          title={isPast
                            ? 'ເວລາຜ່ານໄປແລ້ວ'
                            : isDisabled
                              ? 'ບໍ່ວ່າງ'
                              : occupied
                                ? 'ບໍ່ວ່າງ'
                                : isInOriginalRange && !isInRange
                                  ? `${time} — ເວລາເດີມຂອງການຈອງ`
                                  : time}
                        >
                          {isPast ? '' : occupied ? '✕' : isChosenStart ? '●' : isInRange ? '●' : isInOriginalRange ? '○' : ''}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hover note — ລາຍລະອຽດການຈອງ ເມື່ອ hover ກ່ອງໃນຕາຕະລາງປະຕິທິນ (week/day) */}
        {bookingNote && (() => {
          const b = bookingNote.booking;
          const room = roomForBooking(b);
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

        {/* TAB 1: ROOMS LIST & WEEKLY CALENDAR GRID */}
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
                {/* FILTER: ຫ້ອງວ່າງຕາມເວລາ */}
                <div>
                  <button
                    onClick={() => { setIsAvailOpen(!isAvailOpen); setIsFloorOpen(false); setIsLocationOpen(false); }}
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

                {/* FILTER: ຊັ້ນ */}
                <div className="relative" ref={floorRef}>
                  <button
                    onClick={() => { setIsFloorOpen(!isFloorOpen); setIsLocationOpen(false); }}
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

                {/* FILTER: ຈຸດໃນຊັ້ນ (ຂຶ້ນຕາມຊັ້ນທີ່ເລືອກ) */}
                <div className="relative" ref={locationRef}>
                  <button
                    onClick={() => { setIsLocationOpen(!isLocationOpen); setIsFloorOpen(false); }}
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
              const THUMB = 18; // px — ຕ້ອງກົງກັບ CSS ຂ້າງລຸ່ມ
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
                    {/* ຊ້າຍ: ເລືອກວັນທີ */}
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

                    {/* ຂວາ: slider ເລືອກຊ່ວງເວລາ */}
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
                        {/* ປ້າຍສະເພາະທຸກຊົ່ວໂມງ — ບໍ່ສະແດງ :30 */}
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
                            room.liveStatus === 'MAINTENANCE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
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

            {/* CALENDAR GRID (Week / Day) */}
            {calendarRooms.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="font-bold text-gray-800 text-base">
                    {calendarViewMode === 'day' ? 'ປະຕິທິນລາຍວັນ' : 'ປະຕິທິນອາທິດ'} —{' '}
                    {selectedRoomIds.length === 0
                      ? `${calendarRooms.length} ຫ້ອງ (ທັງໝົດ)`
                      : calendarRooms.map(r => r.name).join(', ')}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* ປຸ່ມກັບໄປສະແດງທຸກຫ້ອງ ເມື່ອມີການເລືອກຫ້ອງໃດໜຶ່ງ */}
                    {selectedRoomIds.length > 0 && (
                      <button
                        onClick={() => setSelectedRoomIds([])}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ສະແດງທຸກຫ້ອງ
                      </button>
                    )}

                    {/* ສະຫຼັບ ອາທິດ / ວັນ */}
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

                    {/* ປຸ່ມ ຍ້ອນຫຼັງ / ມື້ນີ້ / ຕໍ່ໄປ */}
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

                      {/* ຕາຕະລາງລວມ — ແຕ່ລະມື້ເປັນ timeline 1 ແຖວ; ການຈອງ stretch ຕາມເວລາເລີ່ມ–ສິ້ນສຸດ, ການຈອງທີ່ເວລາຊ້ອນກັນຖືກຈັດແຍກ lane (ລົງລຸ່ມ) ບໍ່ທັບກັນ */}
                      <div className="divide-y divide-gray-100">
                        {weekDays.map(day => {
                          const dayDate = new Date(getWeekRange(calendarAnchorDate).from);
                          dayDate.setDate(dayDate.getDate() + (day.dayIndex - 1));

                          const dayBookings = calendarBookings
                            .filter(b => isBookingInCalendar(b) && new Date(b.startAt).getDay() === day.dayIndex)
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
                              {/* ຕາຂ່າຍພື້ນຖານ: ຊື່ມື້ + ເສັ້ນແບ່ງຊົ່ວໂມງ */}
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

                              {/* ການຈອງ — stretch ຕາມນາທີຈິງ (ຮອງຮັບ xx:30) ແລະ ແຍກ lane ບໍ່ໃຫ້ທັບກັນ */}
                              {dayBookings.map((booking, idx) => {
                                const startPos = slotPos(new Date(booking.startAt));
                                const span = slotPos(new Date(booking.endAt)) - startPos;
                                if (span <= 0) return null;
                                return (
                                  <div
                                    key={booking._id || idx}
                                    className="absolute bg-amber-50 border border-amber-200 text-amber-800 px-1.5 rounded text-[10px] font-medium truncate z-10 flex items-center"
                                    style={{
                                      left: `calc(${(1 + startPos) * (100 / SLOT_COLS)}% + 2px)`,
                                      width: `calc(${span * (100 / SLOT_COLS)}% - 4px)`,
                                      top: 4 + laneOf[idx] * 26,
                                      height: 22,
                                      lineHeight: '20px',
                                    }}
                                    onMouseEnter={(e) => showBookingNote(e, booking)}
                                    onMouseLeave={hideBookingNote}
                                  >
                                    {bookingRoomLabel(booking)} · {booking.title || 'ບໍ່ມີຫົວຂໍ້'}
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
                      {/* ຕາຕະລາງລາຍວັນ — ແຖວ = ຊົ່ວໂມງ; ການຈອງ stretch ຕາມເວລາເລີ່ມ–ສິ້ນສຸດ, ການຈອງທີ່ເວລາຊ້ອນກັນຖືກຈັດ lane ຂ້າງກັນ ບໍ່ທັບກັນ */}
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

                        {/* ການຈອງ — overlay ຢູ່ຄໍລໍາເບື້ອງຂວາ (ເຂດເວລາ), stretch ຕາມຊົ່ວໂມງ ແລະ ແຍກ lane ຂ້າງກັນ */}
                        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none">
                          {dayViewBookings.map((booking, idx) => {
                            const startPos = slotPos(new Date(booking.startAt));
                            const span = slotPos(new Date(booking.endAt)) - startPos;
                            if (span <= 0) return null;
                            const lane = dayViewLaneOf[idx];
                            return (
                              <div
                                key={booking._id || idx}
                                className="absolute bg-amber-50 border border-amber-200 text-amber-800 px-1.5 rounded text-[10px] font-medium truncate pointer-events-auto flex items-center"
                                style={{
                                  top: startPos * 30 + 2,
                                  height: Math.max(span * 30 - 4, 14),
                                  left: `calc(${lane} * ${100 / dayViewMaxLanes}% + 4px)`,
                                  width: `calc(${100 / dayViewMaxLanes}% - 8px)`,
                                }}
                                onMouseEnter={(e) => showBookingNote(e, booking)}
                                onMouseLeave={hideBookingNote}
                              >
                                {bookingRoomLabel(booking)} · {booking.title || 'ບໍ່ມີຫົວຂໍ້'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY BOOKINGS */}
        {activeTab === 'my-bookings' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800">
              ປະຫວັດ ແລະ ລາຍການການຈອງຫ້ອງປະຊຸມຂອງຂ້ອຍ
            </div>
            {loadingMyBookings ? (
              <div className="py-12 text-center text-sm text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</div>
            ) : myBookings.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {myBookings.map((b) => {
                  const roomName = b.room?.name || b.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ';
                  const past = isBookingPast(b);
                  // ລາຍການທີ່ປະຊຸມຈົບແລ້ວ ຫຼື ຖືກປະຕິເສດ ຈະສະແດງສີຈາງ (light) ເພື່ອບົ່ງບອກວ່າບໍ່ສາມາດດຳເນີນການໄດ້
                  const inactive = past || b.status === 'REJECTED';
                  const canModify = b.status === 'PENDING' || b.status === 'CONFIRMED' || !b.status;
                  return (
                    <div
                      key={b._id}
                      onClick={() => setDetailBooking(b)}
                      title="ກົດເພື່ອເບິ່ງລາຍລະອຽດ"
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition cursor-pointer ${inactive ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-base">ຫ້ອງ: {roomName}</span>
                          {b.title && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{b.title}</span>}
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${bookingStatusInfo(b.status).className}`}>
                            {bookingStatusInfo(b.status).label}
                          </span>
                          {b.pendingStartAt && b.pendingEndAt && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">
                              ລໍຖ້າອະນຸມັດການເລື່ອນເວລາ
                            </span>
                          )}
                          {past && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                              ຜ່ານໄປແລ້ວ
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
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canModify && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // ປະຊຸມທີ່ຈົບໄປແລ້ວ ເລື່ອນເວລາບໍ່ໄດ້
                                if (past) {
                                  alert('ປະຊຸມນີ້ຈົບແລ້ວ ບໍ່ສາມາດເລື່ອນເວລາໄດ້');
                                  return;
                                }
                                setCurrentBookingToReschedule(b);
                                // ຖ້າມີຄຳຮ້ອງເລື່ອນເວລາຄ້າງຢູ່ ໃຫ້ປ້ອນຈາກເວລາທີ່ຂໍປ່ຽນນັ້ນ ເພື່ອປັບແກ້ໄດ້ເລີຍ; ບໍ່ດັ່ງນັ້ນໃຊ້ເວລາເດີມ
                                // ແປງ ISO (UTC) ເປັນເວລາທ້ອງຖິ່ນກ່ອນປ້ອນໃສ່ input/ຕາຕະລາງ (slice ຊື່ໆ ຈະເຮັດໃຫ້ເວລາເຂື່ອນ)
                                const prefillStartAt = b.pendingStartAt || b.startAt;
                                const prefillEndAt = b.pendingEndAt || b.endAt;
                                setNewStartAt(prefillStartAt ? toDateTimeLocalValue(new Date(prefillStartAt)) : '');
                                setNewEndAt(prefillEndAt ? toDateTimeLocalValue(new Date(prefillEndAt)) : '');
                                setReschedulePickStart(null);
                                // ເລື່ອນຕາຕະລາງໄປອາທິດຂອງການຈອງນີ້ ເພື່ອໃຫ້ເຫັນເວລາເດີມທັນທີ
                                if (b.startAt) setCalendarAnchorDate(new Date(b.startAt));
                                setRescheduleModalOpen(true);
                              }}
                              aria-disabled={past}
                              title={past ? 'ປະຊຸມນີ້ຈົບແລ້ວ ເລື່ອນເວລາບໍ່ໄດ້' : 'ເລື່ອນເວລາ'}
                              className={`px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium transition flex items-center gap-1 ${past ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                            >
                              <Edit3 size={14} />
                              <span>ເລື່ອນເວລາ</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // ປະຊຸມທີ່ຈົບໄປແລ້ວ ຍົກເລີກບໍ່ໄດ້ (ເຂົ້າຫ້ອງກໍບໍ່ໄດ້ແລ້ວ)
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

        {/* TAB 3: ADMIN — Pending approvals + Maintenance toggle + Org-wide utilization report */}
        {activeTab === 'admin' && canSeeAdminTab && (
          <div className="space-y-6">
            {canApproveBookings && (() => {
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
              const weekStart = getWeekRange(adminWeek).from;
              const overlaps = (item, a0, a1) => new Date(item.startAt) < a1 && new Date(item.endAt) > a0;
              const selectedRoomObj = rooms.find(r => String(r.roomId || r._id) === effectiveRoomId) || null;
              // ຄົ້ນຫາແບບ "ຄຳທີ່ຂຶ້ນຕົ້ນດ້ວຍ" (word-prefix), ບໍ່ສົນຕົວພິມໃຫຍ່/ນ້ອຍ:
              //   "d"  → Conference Room D, Dinner room, ROOM DINNER   (ມີຄຳໃດຄຳໜຶ່ງຂຶ້ນຕົ້ນດ້ວຍ d)
              //   "di" → Dinner room, DINNER, ROOM DINNER              (ບໍ່ລວມ Conference Room D)
              // ຫຼາຍຄຳ ("room di") → ທຸກຄຳຕ້ອງກົງກັບຕົ້ນຂອງຄຳໃດຄຳໜຶ່ງ (ລຳດັບໃດກໍໄດ້); ຜົນທີ່ຊື່ຂຶ້ນຕົ້ນດ້ວຍຄຳຄົ້ນຫາຈະຢູ່ກ່ອນ
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
                if (fullName.startsWith(roomTokens.join(' '))) return 0; // ຊື່ຂຶ້ນຕົ້ນດ້ວຍຄຳຄົ້ນຫາ
                if (roomTokens.every(t => nameWords.some(w => w.startsWith(t)))) return 1; // ກົງໃນຊື່ (ຄຳກາງ/ທ້າຍ)
                return 2; // ກົງສະເພາະ ລະຫັດ/ຊັ້ນ/ສະຖານທີ່
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
              };
              const pendingCountFor = (id) => pendingApprovals.filter(b => String(bookingRoomId(b)) === String(id)).length;

              const Ring = ({ color, cross }) => (
                <svg viewBox="0 0 16 16" width="16" height="16" className="mx-auto" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="2" />
                  {cross && (
                    <>
                      <line x1="5.2" y1="5.2" x2="10.8" y2="10.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
                      <line x1="10.8" y1="5.2" x2="5.2" y2="10.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              );

              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="font-bold text-gray-800">ຕາຕະລາງພາບລວມຄຳຮ້ອງຂໍຈອງ</div>
                    <div className="flex items-center gap-2 flex-wrap">
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

                  <div className="px-4 pt-3 flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-gray-600">
                    <span className="flex items-center gap-1.5"><span className="font-bold text-black text-sm leading-none">✕</span> ອະນຸມັດແລ້ວ</span>
                    <span className="flex items-center gap-1.5"><Ring color="#2563eb" /> ລໍຖ້າອະນຸມັດ</span>
                    <span className="flex items-center gap-1.5"><Ring color="#dc2626" cross /> ລໍຖ້າອະນຸມັດ ແຕ່ຊົ່ວກັບຄຳຮ້ອງອື່ນ</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded bg-green-300 border border-green-500" /> ຄຳຮ້ອງທີ່ເລືອກ</span>
                  </div>

                  <div className="p-4">
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
                            return (
                              <div key={day.key} className="min-w-[1000px] items-stretch" style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOT_COLS}, minmax(0, 1fr))` }}>
                                <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-300 py-2 flex flex-col items-center justify-center gap-0.5">
                                  <span>{day.label}</span>
                                  <span className="text-[10px] font-normal text-gray-300">
                                    {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {timeSlots.map(time => {
                                  const [h, m] = time.split(':').map(Number);
                                  const slotStart = new Date(dayDate);
                                  slotStart.setHours(h, m, 0, 0);
                                  const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
                                  const confirmedHere = roomConfirmed.filter(b => overlaps(b, slotStart, slotEnd));
                                  const pendingHere = roomPending.filter(b => overlaps(b, slotStart, slotEnd));
                                  const isSelected = !!selectedPending && pendingHere.some(b => b._id === selectedPending._id);
                                  const hasConfirmed = confirmedHere.length > 0;
                                  const clickable = pendingHere.length > 0;
                                  const tip = [
                                    `${day.label} ${time}`,
                                    ...confirmedHere.map(b => `✕ ${b.title || 'ບໍ່ມີຫົວຂໍ້'} (ອະນຸມັດແລ້ວ)`),
                                    ...pendingHere.map(b => `${pendingHere.length > 1 ? '⊗' : '○'} ${b.title || 'ບໍ່ມີຫົວຂໍ້'} (ລໍຖ້າ)`),
                                  ].join('\n');
                                  return (
                                    <button
                                      type="button"
                                      key={time}
                                      disabled={!clickable}
                                      onClick={() => {
                                        const idx = pendingHere.findIndex(b => b._id === adminSelectedId);
                                        selectPendingRequest(pendingHere[(idx + 1) % pendingHere.length]);
                                      }}
                                      title={tip}
                                      className={`h-9 border-r ${time.endsWith(':30') ? 'border-gray-300' : 'border-gray-100'} flex items-center justify-center transition ${isSelected ? 'bg-green-300' : 'bg-white'} ${clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                                    >
                                      {hasConfirmed ? (
                                        <span className="font-bold text-black text-sm leading-none">✕</span>
                                      ) : pendingHere.length >= 2 ? (
                                        <Ring color="#dc2626" cross />
                                      ) : pendingHere.length === 1 ? (
                                        <Ring color="#2563eb" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">
                      ກົດຊ່ອງ ຫຼື ກົດຄຳຮ້ອງໃນລາຍການດ້ານລຸ່ມ ເພື່ອເລືອກ (ພື້ນຫຼັງສີຂຽວ). ຖ້າຊ່ອງໃດມີຫຼາຍຄຳຮ້ອງ ກົດຊ້ຳເພື່ອສະຫຼັບ.
                    </p>
                  </div>
                </div>
              );
            })()}

            {canApproveBookings && (
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

            {canManageRooms && (
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
              <div className="divide-y divide-gray-100">
                {rooms.map(room => {
                  const roomId = room.roomId || room._id;
                  const isMaintenance = room.status === 'MAINTENANCE'; // ໃຊ້ຄວບຄຸມປຸ່ມ toggle (ຕັ້ງຄ່າ static ເທົ່ານັ້ນ)
                  const liveStatus = room.liveStatus || room.status; // ໃຊ້ສະແດງປ້າຍ badge — ອາດເປັນ BOOKED ໄດ້ຖ້າມີການຈອງຄອບຄຸມເວລານີ້
                  return (
                    <div key={roomId} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-gray-800">{room.name} <span className="text-xs text-gray-400">({roomId})</span></div>
                        <div className="text-xs text-gray-500">
                          {roomFloor(room)}{roomSpot(room) ? ` — ${roomSpot(room)}` : ''} — ຄວາມຈຸ {room.capacity} ຄົນ
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* ສະຖານະປັດຈຸບັນ (3 ຄ່າ: ວ່າງ / ກຳລັງໃຊ້ງານ / ປິດບຳລຸງ) — ຄົນລະສ່ວນຈາກປຸ່ມຄຳສັ່ງດ້ານລຸ່ມ ເພື່ອບໍ່ໃຫ້ສັບສົນ */}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${liveStatus === 'MAINTENANCE' ? 'bg-red-100 text-red-700' :
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
                  );
                })}
                {rooms.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">ບໍ່ມີຫ້ອງໃນລະບົບ</div>
                )}
              </div>
            </div>
            )}

            {canManageRooms && (
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

        {/* MODAL: CREATE ROOM */}
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

        {/* MODAL: BOOKING FORM */}
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
                  })}
                </div>

                {(startAt && isOutsideWorkingHours(startAt)) || (endAt && isOutsideWorkingHours(endAt)) ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ ເວລາທີ່ເລືອກຢູ່ນອກຊ່ວງເວລາທຳການ 08:00 - 17:00 — ກະລຸນາກວດ AM/PM ໃຫ້ຖືກຕ້ອງ
                  </div>
                ) : null}

                {/* Recurring Option */}
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

        {/* MODAL: RESCHEDULE — ສະແດງຕາຕະລາງຊ່ອງວ່າງຄືກັນກັບຕອນຈອງຫ້ອງ ເພື່ອໃຫ້ເຫັນ slot ທີ່ຫວ່າງ */}
        {rescheduleModalOpen && currentBookingToReschedule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ເລື່ອນເວລາຈອງຫ້ອງ</h2>
                <button onClick={() => { setRescheduleModalOpen(false); setReschedulePickStart(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                ຫ້ອງ: <span className="font-medium text-gray-700">{currentBookingToReschedule.room?.name || currentBookingToReschedule.roomId?.name || bookingRoomLabel(currentBookingToReschedule)}</span>
                {' • '}ເວລາເດີມ: {new Date(currentBookingToReschedule.startAt).toLocaleString()} — {new Date(currentBookingToReschedule.endAt).toLocaleString()}
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <span className="block text-xs text-gray-400 mb-1">
                    ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດໃນຕາຕະລາງ ເພື່ອເລືອກເວລາໃໝ່ (ຊ່ວງຫວ່າງຈະສະແດງສີຂາວ)
                  </span>
                  {renderSlotPicker({
                    pickStart: reschedulePickStart,
                    startVal: newStartAt,
                    endVal: newEndAt,
                    // ເວລາເດີມທີ່ຮ້ອງຂໍໄວ້ (start–end ຕົ້ນສະບັບ) ຈະຖືກໄຮໄລ້ແບບຈາງໆ ເພື່ອທຽບກັບເວລາໃໝ່
                    originalStartVal: currentBookingToReschedule.startAt,
                    originalEndVal: currentBookingToReschedule.endAt,
                    onSlotClick: handleReschedulePickerClick,
                    isOccupied: (dayIndex, time) => isSlotOccupiedForRoom(
                      String(bookingRoomId(currentBookingToReschedule)),
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
                  <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm">ບັນທຶກການເລື່ອນເວລາ</button>
                </div>
              </form>
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

        {/* popup ລາຍລະອຽດການຈອງ — ເປີດເມື່ອກົດລາຍການໃນ "ການຈອງຂອງຂ້ອຍ" */}
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
                    ຜ່ານໄປແລ້ວ
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

              {/* ເຊີນຄົນເຂົ້າຫ້ອງດ້ວຍ QR (ສ່ວນຕົວ/ສາທາລະນະ) + ລາຍງານຜູ້ເຂົ້າ — ສະເພາະການຈອງທີ່ອະນຸມັດແລ້ວ */}
              {detailBooking.status === 'CONFIRMED' && (<BookingInvitePanel key={detailBooking._id} booking={detailBooking} past={isBookingPast(detailBooking)} />)}

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
                      // ປິດ popup ກ່ອນ ແລ້ວເອີ້ນຂະບວນການຍົກເລີກ (ມີ window.confirm ຢູ່ໃນນັ້ນແລ້ວ)
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