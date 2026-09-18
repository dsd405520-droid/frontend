import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Plus, DoorClosed, Clock, MapPin, Edit3, Trash2, Search, X } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import MainLayout from '../layouts/MainLayout';
import { getSocket } from '../utils/socket';

export default function MeetingRooms() {
  const canApproveBookings = hasPermission('rooms', 'approve'); // ຄວບຄຸມການເຫັນ tab 'ຈັດການຫ້ອງ (Admin)'

  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'my-bookings' | 'admin'

  // States ສຳລັບ Rooms
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // States ສຳລັບ Reschedule Modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [currentBookingToReschedule, setCurrentBookingToReschedule] = useState(null);
  const [newStartAt, setNewStartAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');

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

  // States ສຳລັບ popup ໃສ່ເຫດຜົນຕອນປະຕິເສດຄຳຮ້ອງຂໍຈອງ
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [bookingToReject, setBookingToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const fetchRooms = (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    fetch('http://localhost:3000/api/rooms', {
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

    fetch(`http://localhost:3000/api/room-bookings?${params.toString()}`, {
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

  const fetchMyBookings = () => {
    setLoadingMyBookings(true);
    fetch('http://localhost:3000/api/room-bookings/my', {
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
  const fetchUtilization = () => {
    setLoadingUtilization(true);
    const from = new Date(utilFrom + 'T00:00:00').toISOString();
    const to = new Date(utilTo + 'T23:59:59').toISOString();
    const params = new URLSearchParams({ from, to });

    fetch(`http://localhost:3000/api/rooms/utilization?${params.toString()}`, {
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
  const fetchPendingApprovals = () => {
    setLoadingPending(true);
    setPendingApprovalsError('');
    fetch('http://localhost:3000/api/room-bookings/pending', {
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

  // ຟັງເຫດການ real-time ຈາກ Backend (WebSocket):
  // ພໍມີການຈອງ ຫຼື ແກ້ໄຂຫ້ອງຈາກໜ້າຈໍອື່ນ/ຜູ້ອື່ນ →
  // ດຶງຂໍ້ມູນມາສະແດງໃໝ່ທັນທີ ໂດຍບໍ່ຕ້ອງ reload ໜ້າ
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const refreshFromServer = () => {
      fetchRooms(true);
      fetchCalendarBookings();
      if (activeTabRef.current === 'my-bookings') {
        fetchMyBookings();
      }
      if (activeTabRef.current === 'admin') {
        fetchPendingApprovals();
        fetchUtilization();
      }
    };

    socket.on('room-bookings:changed', refreshFromServer);
    socket.on('room:changed', refreshFromServer);

    return () => {
      socket.off('room-bookings:changed', refreshFromServer);
      socket.off('room:changed', refreshFromServer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewBooking = (id, action, body) => {
    setReviewingId(id);
    return fetch(`http://localhost:3000/api/room-bookings/${id}/${action}`, {
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

  const openRejectModal = (booking) => {
    setBookingToReject(booking);
    setRejectReason('');
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

    fetch(`http://localhost:3000/api/rooms/${roomId}/status`, {
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

    fetch('http://localhost:3000/api/room-bookings', {
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

    fetch(`http://localhost:3000/api/room-bookings/${id}`, {
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

    fetch(`http://localhost:3000/api/room-bookings/series/${seriesId}`, {
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

    fetch(`http://localhost:3000/api/room-bookings/${currentBookingToReschedule._id}/reschedule`, {
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
      .then(() => {
        setRescheduleModalOpen(false);
        setCurrentBookingToReschedule(null);
        fetchMyBookings();
        fetchCalendarBookings();
        alert('ເລື່ອນເວລາຈອງສຳເລັດແລ້ວ!');
      })
      .catch(err => alert(err.message));
  };

  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
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

  // ແປສະຖານະຫ້ອງ (ຄ່າ enum ຈາກ Backend, 3 ຄ່າ: AVAILABLE / BOOKED / MAINTENANCE) ໃຫ້ເປັນຄຳລາວທີ່ອ່ານງ່າຍ
  const roomStatusLabel = (status) => {
    switch (status) {
      case 'BOOKED': return 'ກຳລັງໃຊ້ງານ';
      case 'MAINTENANCE': return 'ປິດບຳລຸງ';
      case 'AVAILABLE':
      default: return 'ວ່າງ';
    }
  };

  // ກັ່ນຕອງຫ້ອງຕາມຄຳຄົ້ນຫາ (ຊື່ / ລະຫັດ / ສະຖານທີ່)
  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (room.name || '').toLowerCase();
    const code = String(room.roomId || room._id || '').toLowerCase();
    const location = (room.location || '').toLowerCase();
    return name.includes(q) || code.includes(q) || location.includes(q);
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

  // ຊື່ຫ້ອງຂອງ booking ນັ້ນ — ໃຊ້ສະແດງໃສ່ກ່ອງ booking ໃນຕາຕະລາງລວມ (ເພາະບໍ່ມີສ່ວນແຍກຕໍ່ຫ້ອງແລ້ວ)
  const bookingRoomLabel = (b) => {
    const id = String(bookingRoomId(b));
    const room = rooms.find((r) => String(r.roomId || r._id) === id);
    if (room) return `${room.name} (${id})`;
    return id || 'ບໍ່ລະບຸຫ້ອງ';
  };

  // ແປງເວລາໃຫ້ເປັນ HH:MM ເພື່ອສະແດງໃນ chip
  const fmtTime = (d) => {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // ກວດວ່າ booking ນີ້ເປັນຂອງຫ້ອງທີ່ກຳລັງສະແດງຢູ່ໃນຕາຕະລາງ (calendarRooms) ບໍ່
  const isBookingInCalendar = (b) => {
    const id = String(bookingRoomId(b));
    return calendarRooms.some((r) => String(r.roomId || r._id) === id);
  };

  const slotHours = timeSlots.map(t => parseInt(t, 10));

  // ຄຳນວນຈຳນວນຊົ່ວໂມງທີ່ booking ກິນເວລາ (ໃຊ້ stretch ຂໍ້ຄວາມຕາມເວລາເລີ່ມ–ສິ້ນສຸດ)
  const getBookingSlotSpan = (b) => {
    const start = new Date(b.startAt);
    const end = new Date(b.endAt);
    const startIdx = slotHours.indexOf(start.getHours());
    if (startIdx === -1) return 1;
    const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    let endIdx = slotHours.findIndex(h => h >= endHour);
    if (endIdx === -1) endIdx = slotHours.length;
    return Math.max(1, endIdx - startIdx);
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

  const isSlotOccupied = (dayIndex, time) => {
    const hour = parseInt(time, 10);
    return calendarBookings.some(b => {
      const bStart = new Date(b.startAt);
      const bEnd = new Date(b.endAt);
      const bRoomId = typeof b.roomId === 'object' ? (b.roomId?._id || b.roomId?.roomId) : b.roomId;
      if (String(bRoomId) !== String(selectedRoom) || bStart.getDay() !== dayIndex) return false;

      const startHour = bStart.getHours();
      const endHour = bEnd.getHours() + (bEnd.getMinutes() > 0 ? 1 : 0);
      return hour >= startHour && hour < endHour;
    });
  };

  const isSlotInSelectedRange = (dayIndex, time) => {
    if (!startAt || !endAt) return false;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start.getDay() !== dayIndex) return false;
    const hour = parseInt(time, 10);
    return hour >= start.getHours() && hour < end.getHours();
  };

  // ກົດເລືອກຈຸດເລີ່ມ ແລ້ວກົດອີກເທື່ອເພື່ອເລືອກຈຸດສິ້ນສຸດ — ແທນທີ່ຈະພິມວັນ/ເວລາເອງ
  const handlePickerClick = (dayIndex, time) => {
    const isPickingEnd = pickStart && pickStart.dayIndex === dayIndex &&
      slotHours.indexOf(parseInt(time, 10)) > slotHours.indexOf(parseInt(pickStart.time, 10));

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

    if (isSlotOccupied(dayIndex, time) && !isPickingEnd) return;

    if (!pickStart || pickStart.dayIndex !== dayIndex) {
      setPickStart({ dayIndex, time });
      setStartAt('');
      setEndAt('');
      return;
    }

    const startIdx = slotHours.indexOf(parseInt(pickStart.time, 10));
    const clickedIdx = slotHours.indexOf(parseInt(time, 10));

    if (clickedIdx === startIdx) {
      setPickStart(null);
      return;
    }

    if (clickedIdx < startIdx) {
      setPickStart({ dayIndex, time });
      return;
    }

    const rangeHasConflict = slotHours.slice(startIdx, clickedIdx).some(h =>
      isSlotOccupied(dayIndex, `${String(h).padStart(2, '0')}:00`)
    );

    if (rangeHasConflict) {
      alert('ຊ່ວງເວລານີ້ຊ້ອນກັບການຈອງທີ່ມີຢູ່ແລ້ວ ກະລຸນາເລືອກໃໝ່');
      setPickStart(null);
      return;
    }

    const startVal = toDateTimeLocalValue(getSlotDateTime(dayIndex, pickStart.time));
    const endVal = toDateTimeLocalValue(getSlotDateTime(dayIndex, time));
    setStartAt(startVal);
    setEndAt(endVal);
    setPickStart(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ລະບົບຈອງຫ້ອງປະຊຸມ</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການ, ກວດສອບສະຖານະ ແລະ ຈອງຫ້ອງປະຊຸມອອນໄລນ໌</p>
          </div>
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
          {canApproveBookings && (
            <button
              onClick={() => { setActiveTab('admin'); fetchUtilization(); fetchPendingApprovals(); }}
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
            <div className="relative w-full">
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

            <p className="text-xs text-gray-400 -mt-4">
              ຄລິກທີ່ບັດຫ້ອງເພື່ອເພີ່ມ/ຖອດອອກຈາກຕາຕະລາງ — ຖ້າຍັງບໍ່ເລືອກຫ້ອງໃດ, ຕາຕະລາງຈະສະແດງທຸກຫ້ອງ
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
                            <MapPin size={16} className="text-gray-400" />
                            <span>ສະຖານທີ່: {room.location || 'ຊັ້ນ 2, ອາຄານຫຼັກ'}</span>
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
                  {searchQuery.trim() ? 'ບໍ່ພົບຫ້ອງທີ່ກົງກັບການຄົ້ນຫາ' : 'ຍັງບໍ່ມີຂໍ້ມູນຫ້ອງປະຊຸມ'}
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
                      <div className="min-w-[900px] grid grid-cols-9 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 text-center py-2.5">
                        <div>ວັນ / ເວລາ</div>
                        {timeSlots.map(time => (
                          <div key={time}>{time}</div>
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
                            <div key={day.key} className="min-w-[900px] relative" style={{ height: rowHeight }}>
                              {/* ຕາຂ່າຍພື້ນຖານ: ຊື່ມື້ + ເສັ້ນແບ່ງຊົ່ວໂມງ */}
                              <div className="absolute inset-0 grid grid-cols-9 text-xs text-gray-500">
                                <div className="text-center font-medium text-gray-400 border-r border-gray-100 py-1 flex flex-col items-center justify-center gap-0.5">
                                  <span>{day.label}</span>
                                  <span className="text-[10px] font-normal text-gray-400">
                                    {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {timeSlots.map(time => (
                                  <div key={time} className="border-r border-gray-100" />
                                ))}
                              </div>

                              {/* ການຈອງ — stretch ຕາມຊົ່ວໂມງ ແລະ ແຍກ lane ບໍ່ໃຫ້ທັບກັນ */}
                              {dayBookings.map((booking, idx) => {
                                const startIdx = slotHours.indexOf(new Date(booking.startAt).getHours());
                                if (startIdx === -1) return null;
                                const span = getBookingSlotSpan(booking);
                                return (
                                  <div
                                    key={booking._id || idx}
                                    className="absolute bg-amber-50 border border-amber-200 text-amber-800 px-1.5 rounded text-[10px] font-medium truncate z-10 flex items-center"
                                    style={{
                                      left: `calc(${(1 + startIdx) * (100 / 9)}% + 4px)`,
                                      width: `calc(${span * (100 / 9)}% - 8px)`,
                                      top: 4 + laneOf[idx] * 26,
                                      height: 22,
                                      lineHeight: '20px',
                                    }}
                                    title={`${bookingRoomLabel(booking)} — ${booking.title || 'ບໍ່ມີຫົວຂໍ້'} (${fmtTime(booking.startAt)}–${fmtTime(booking.endAt)})`}
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
                        <div className="divide-y divide-gray-100">
                          {timeSlots.map(time => (
                            <div key={time} className="min-w-[300px] grid grid-cols-2 text-xs text-gray-500 h-[60px]">
                              <div className="text-center font-medium text-gray-400 border-r border-gray-100 py-2">
                                {time}
                              </div>
                              <div className="border-r border-gray-100" />
                            </div>
                          ))}
                        </div>

                        {/* ການຈອງ — overlay ຢູ່ຄໍລໍາເບື້ອງຂວາ (ເຂດເວລາ), stretch ຕາມຊົ່ວໂມງ ແລະ ແຍກ lane ຂ້າງກັນ */}
                        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none">
                          {dayViewBookings.map((booking, idx) => {
                            const startIdx = slotHours.indexOf(new Date(booking.startAt).getHours());
                            if (startIdx === -1) return null;
                            const span = getBookingSlotSpan(booking);
                            const lane = dayViewLaneOf[idx];
                            return (
                              <div
                                key={booking._id || idx}
                                className="absolute bg-amber-50 border border-amber-200 text-amber-800 px-1.5 rounded text-[10px] font-medium truncate pointer-events-auto flex items-center"
                                style={{
                                  top: startIdx * 60 + 4,
                                  height: span * 60 - 8,
                                  left: `calc(${lane} * ${100 / dayViewMaxLanes}% + 4px)`,
                                  width: `calc(${100 / dayViewMaxLanes}% - 8px)`,
                                }}
                                title={`${bookingRoomLabel(booking)} — ${booking.title || 'ບໍ່ມີຫົວຂໍ້'} (${fmtTime(booking.startAt)}–${fmtTime(booking.endAt)})`}
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
                  return (
                    <div key={b._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-base">ຫ້ອງ: {roomName}</span>
                          {b.title && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{b.title}</span>}
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${bookingStatusInfo(b.status).className}`}>
                            {bookingStatusInfo(b.status).label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>ເລີ່ມ: {new Date(b.startAt).toLocaleString()} — ສິ້ນສຸດ: {new Date(b.endAt).toLocaleString()}</span>
                        </p>
                        {b.rejectionReason && (
                          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 mt-1">
                            {b.status === 'REJECTED' ? 'ເຫດຜົນທີ່ປະຕິເສດ: ' : 'ເຫດຜົນທີ່ຍົກເລີກ: '}{b.rejectionReason}
                          </p>
                        )}
                      </div>

                      {(b.status === 'PENDING' || b.status === 'CONFIRMED' || !b.status) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setCurrentBookingToReschedule(b);
                              setNewStartAt(b.startAt ? b.startAt.slice(0, 16) : '');
                              setNewEndAt(b.endAt ? b.endAt.slice(0, 16) : '');
                              setRescheduleModalOpen(true);
                            }}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition flex items-center gap-1"
                          >
                            <Edit3 size={14} />
                            <span>ເລື່ອນເວລາ</span>
                          </button>
                          <button
                            onClick={() => handleCancelBooking(b._id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            <span>ຍົກເລີກ</span>
                          </button>
                          {b.seriesId && (
                            <button
                              onClick={() => handleCancelSeries(b.seriesId)}
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition"
                              title="ຍົກເລີກທຸກຄັ້ງໃນຊຸດການຈອງແບບຊ້ຳນີ້"
                            >
                              ຍົກເລີກທັງຊຸດ
                            </button>
                          )}
                        </div>
                      )}
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
        {activeTab === 'admin' && canApproveBookings && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="font-bold text-gray-800">ຄຳຮ້ອງຂໍຈອງທີ່ລໍຖ້າອະນຸມັດ</div>
                {pendingApprovals.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                    {pendingApprovals.length} ລາຍການ
                  </span>
                )}
              </div>
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
                    return (
                      <div key={b._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-800">ຫ້ອງ: {roomName}</span>
                            {b.title && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">{b.title}</span>}
                            {b.seriesId && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">ຈອງແບບຊ້ຳ</span>}
                          </div>
                          <p className="text-xs text-gray-500">ຜູ້ຂໍຈອງ: {requesterName}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Clock size={14} />
                            <span>ເລີ່ມ: {new Date(b.startAt).toLocaleString()} — ສິ້ນສຸດ: {new Date(b.endAt).toLocaleString()}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
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

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 font-bold text-gray-800">
                ຈັດການສະຖານະຫ້ອງ (ວ່າງ / ກຳລັງໃຊ້ງານ / ປິດບຳລຸງ)
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
                        <div className="text-xs text-gray-500">{room.location} — ຄວາມຈຸ {room.capacity} ຄົນ</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* ສະຖານະປັດຈຸບັນ (3 ຄ່າ: ວ່າງ / ກຳລັງໃຊ້ງານ / ປິດບຳລຸງ) — ຄົນລະສ່ວນຈາກປຸ່ມຄຳສັ່ງດ້ານລຸ່ມ ເພື່ອບໍ່ໃຫ້ສັບສົນ */}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${liveStatus === 'MAINTENANCE' ? 'bg-red-100 text-red-700' :
                          liveStatus === 'BOOKED' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                          ສະຖານະປັດຈຸບັນ: {roomStatusLabel(liveStatus)}
                        </span>
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
                      </div>
                    </div>
                  );
                })}
                {rooms.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">ບໍ່ມີຫ້ອງໃນລະບົບ</div>
                )}
              </div>
            </div>

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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      ເລືອກເວລາ — ກົດຈຸດເລີ່ມ ແລ້ວກົດຈຸດສິ້ນສຸດ
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const prev = new Date(calendarAnchorDate);
                          prev.setDate(prev.getDate() - 7);
                          setCalendarAnchorDate(prev);
                          setPickStart(null);
                        }}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Date(calendarAnchorDate);
                          next.setDate(next.getDate() + 7);
                          setCalendarAnchorDate(next);
                          setPickStart(null);
                        }}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {!selectedRoom ? (
                    <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      ກະລຸນາເລືອກຫ້ອງກ່ອນ ເພື່ອເບິ່ງເວລາທີ່ວ່າງ
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <div className="min-w-[760px] grid grid-cols-9 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 text-center py-1.5">
                          <div>ວັນ / ເວລາ</div>
                          {timeSlots.map(time => (
                            <div key={time}>{time}</div>
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
                                <div key={day.key} className="min-w-[760px] grid grid-cols-9 items-stretch">
                                  <div className="text-center text-[11px] font-medium text-gray-400 border-r border-gray-100 py-2 flex flex-col items-center justify-center gap-0.5">
                                    <span>{day.label}</span>
                                    <span className="text-[10px] font-normal text-gray-300">
                                      {dayDate.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' })}
                                    </span>
                                  </div>
                                  {timeSlots.map(time => {
                                    const occupied = isSlotOccupied(day.dayIndex, time);
                                    const isPast = isSlotInPast(day.dayIndex, time);
                                    const isChosenStart = pickStart && pickStart.dayIndex === day.dayIndex && pickStart.time === time;
                                    const isPickingEnd = pickStart && pickStart.dayIndex === day.dayIndex &&
                                      slotHours.indexOf(parseInt(time, 10)) > slotHours.indexOf(parseInt(pickStart.time, 10));
                                    const isDisabled = isPast || (occupied && !isPickingEnd);
                                    const isInRange = isSlotInSelectedRange(day.dayIndex, time);
                                    return (
                                      <button
                                        type="button"
                                        key={time}
                                        disabled={isDisabled}
                                        onClick={() => handlePickerClick(day.dayIndex, time)}
                                        className={`h-9 border-r border-gray-100 text-[10px] transition ${isPast
                                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                          : isDisabled
                                            ? 'bg-red-50 text-red-300 cursor-not-allowed'
                                            : occupied
                                              ? 'bg-red-50 text-red-400 hover:bg-red-100 cursor-pointer'
                                              : isChosenStart
                                                ? 'bg-amber-500 text-white font-semibold'
                                                : isInRange
                                                  ? 'bg-amber-100 text-amber-700 font-semibold border-amber-200'
                                                  : 'bg-white hover:bg-amber-50 text-gray-300'
                                            }`}
                                        title={isPast
                                          ? 'ເວລາຜ່ານໄປແລ້ວ'
                                          : isDisabled
                                            ? 'ບໍ່ວ່າງ'
                                            : occupied ? 'ຊົ່ວໂມງນີ້ບໍ່ວ່າງ, ແຕ່ສາມາດເລືອກເປັນຈຸດສິ້ນສຸດໄດ້' : time}
                                      >
                                        {isPast ? '' : occupied ? '✕' : isChosenStart ? '●' : isInRange ? '●' : ''}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs" translate="no">
                    {pickStart ? (
                      <span className="text-amber-600 font-medium">
                        ເລືອກຈຸດເລີ່ມແລ້ວ ({weekDays.find(d => d.dayIndex === pickStart.dayIndex)?.label} {pickStart.time}) — ກົດຈຸດສິ້ນສຸດຕໍ່
                      </span>
                    ) : startAt && endAt ? (
                      <span className="text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                        {new Date(startAt).toLocaleDateString('lo-LA', { weekday: 'long', day: 'numeric', month: 'short' })}
                        {' ⋅ '}
                        {new Date(startAt).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(endAt).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-gray-400">ຍັງບໍ່ໄດ້ເລືອກເວລາ</span>
                    )}
                  </div>
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

        {/* MODAL: RESCHEDULE */}
        {rescheduleModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">ເລື່ອນເວລາຈອງຫ້ອງ</h2>
                <button onClick={() => setRescheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
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
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setRescheduleModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm">ຍົກເລີກ</button>
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
                <h2 className="text-lg font-bold text-gray-800">ປະຕິເສດຄຳຮ້ອງຂໍຈອງ</h2>
                <button onClick={closeRejectModal} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {bookingToReject && (
                <p className="text-sm text-gray-500">
                  ຫ້ອງ: <span className="font-medium text-gray-700">{bookingToReject.roomId?.name || 'ບໍ່ລະບຸຫ້ອງ'}</span>
                </p>
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

      </div>
    </MainLayout>
  );
}