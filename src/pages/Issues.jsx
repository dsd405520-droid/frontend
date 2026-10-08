import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Plus, Loader2, X, ChevronDown, UserCheck, Clock as ClockIcon, MessageSquare, AlertTriangle, Camera } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useBranch } from '../contexts/BranchContext';
import CsvImportButton from '../components/CsvImportButton';
import CsvExportButton from '../components/CsvExportButton';
import { getSocket } from '../utils/socket';
import { hasPermission, canCreateFromMenu } from '../utils/permissions';
import TicketProgressBar, { TICKET_STEPS } from '../components/TicketProgressBar';
import { API_BASE_URL, API_ORIGIN } from '../config';

const PRIORITY_LABELS = {
  low: 'ຕ່ຳ',
  medium: 'ປານກາງ',
  high: 'ສູງ',
  urgent: 'ດ່ວນ',
};

export default function Issues() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedBranchId } = useBranch();
  const [issues, setIssues] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const toggleStatusFilter = (status) => {
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const PRIORITY_LEVELS = [
    { key: 'low', label: 'ຕ່ຳ' },
    { key: 'medium', label: 'ປານກາງ' },
    { key: 'high', label: 'ສູງ' },
    { key: 'urgent', label: 'ດ່ວນ' },
  ];
  const [priorityFilter, setPriorityFilter] = useState([]);

  const togglePriorityFilter = (priority) => {
    setPriorityFilter((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  const PRIORITY_ORDER = { low: 0, medium: 1, high: 2, urgent: 3 };
  const SORT_OPTIONS = [
    { key: 'date', label: 'ວັນທີ' },
    { key: 'priority_asc', label: 'ຄວາມສຳຄັນ: ຕ່ຳ → ດ່ວນ' },
    { key: 'priority_desc', label: 'ຄວາມສຳຄັນ: ດ່ວນ → ຕ່ຳ' },
  ];
  const [sortBy, setSortBy] = useState('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);

  // Modal & Form States (ຕັດ files ອອກແລ້ວ)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ticketTypeId: '',
    priority: 'medium',
    branchId: '',
    departmentId: '',
  });

  // State ສຳລັບ Real-time Search ຂອງ Ticket Type
  const [typeSearchQuery, setTypeSearchQuery] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [selectedTypeName, setSelectedTypeName] = useState('');

  // Live KB suggestions while typing the ticket title
  const [suggestedArticles, setSuggestedArticles] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [availablePriorities, setAvailablePriorities] = useState(null); // null = not checked yet
  const [slaNotice, setSlaNotice] = useState('');
  const [formError, setFormError] = useState('');

  // ລະດັບຄວາມສຳຄັງປັດຈຸບັນ ໃຊ້ອ່ານໃນ fetch SLA ຂອງ ticket type ໃໝ່ (ກັນບໍ່ re-fetch ທຸກເທື່ອທີ່ priority ປ່ຽນ)
  const priorityRef = useRef('medium');

  // State ສຳລັບ Modal ລາຍລະອຽດ Ticket
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [unreadByTicket, setUnreadByTicket] = useState({});

  // ຮັບ/ມອບໝາຍບັນຫາ
  const [isAssignPanelOpen, setIsAssignPanelOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('self');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  // ລາຍຊື່ຜູ້ທີ່ມອບໝາຍໄດ້ (ຈາກເຊີບເວີ: ສະເພາະ AGENT ໃນພະແນກ/ສາຂາຂອງ ticket) ພ້ອມຈຳນວນວຽກຄ້າງ
  const [assignCandidates, setAssignCandidates] = useState([]);
  const [assignCandidatesLoading, setAssignCandidatesLoading] = useState(false);
  const [assignCandidatesError, setAssignCandidatesError] = useState('');

  // ປ່ຽນສະຖານະ
  const [statusChangeSubmitting, setStatusChangeSubmitting] = useState(false);
  const [pendingStatusNote, setPendingStatusNote] = useState('');
  const [pendingStatusTarget, setPendingStatusTarget] = useState(null);
  // ຮູບຢັ້ງຢືນການແກ້ໄຂ — ອັບໂຫລດກ່ອນ (ໄດ້ URL ກັບມາ) ແລ້ວຄ່ອຍແນບ URL ໄປພ້ອມຕອນຢືນຢັນ RESOLVED
  const [pendingStatusFiles, setPendingStatusFiles] = useState([]);
  const [statusFileUploading, setStatusFileUploading] = useState(false);

  // re-render ທຸກ 30 ວິນາທີ ເພື່ອໃຫ້ ticket ທີ່ເກີນ SLA ເລີ່ມກະພິບເອງ ໂດຍບໍ່ຕ້ອງ refresh
  const [, setSlaTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSlaTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const token = localStorage.getItem('token');

  // ກວດສິດສິດຈາກ utils/permissions (ຕົວດຽວກັບທຸກໜ້າ) — ລວມການໃຫ້ bypass ADMIN/SUPER_ADMIN ດ້ວຍ
  const canCreateTicketType = canCreateFromMenu('ticket-types');
  const canAssign = hasPermission('tickets', 'assign');
  const canUpdateStatus = hasPermission('tickets', 'update');
  const canCreateTicket = hasPermission('tickets', 'create');
  const canImportTickets = hasPermission('tickets', 'import');

  const ALLOWED_TRANSITIONS = {
    OPEN: ['ASSIGNED', 'IN_PROGRESS'],
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['WAITING_ON_USER', 'RESOLVED'],
    WAITING_ON_USER: ['IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: [],
  };

  const STATUS_LABELS = {
    OPEN: 'ເປີດ (ລໍຖ້າຮັບ)',
    ASSIGNED: 'ມອບໝາຍແລ້ວ',
    IN_PROGRESS: 'ກຳລັງແກ້ໄຂ',
    WAITING_ON_USER: 'ລໍຖ້າຂໍ້ມູນຈາກຜູ້ໃຊ້',
    RESOLVED: 'ແກ້ໄຂແລ້ວ',
    CLOSED: 'ປິດແລ້ວ',
  };

  const getUserDisplayName = (u) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '';

  // ລະດັບຄວາມຫວ່າງຂອງ agent ຕາມຈຳນວນ ticket ທີ່ຍັງຄ້າງ (ປັບຄ່າໄດ້ທີ່ນີ້)
  const BUSY_THRESHOLD = 5;
  const getWorkloadInfo = (count) => {
    if (count === 0) return { label: 'ວ່າງ', cls: 'bg-emerald-50 text-emerald-700' };
    if (count < BUSY_THRESHOLD) return { label: 'ມີວຽກ', cls: 'bg-amber-50 text-amber-700' };
    return { label: 'ຫຍຸ້ງ', cls: 'bg-red-50 text-red-700' };
  };

  const getAgentDisplayName = (agent) => {
    if (!agent) return 'ຍັງບໍ່ມີຜູ້ຮັບຜິດຊອບ';
    if (typeof agent === 'object') {
      return getUserDisplayName(agent) || 'ບໍ່ລະບຸຊື່';
    }
    // API ຄືນມາເປັນ id ດິບ (ບໍ່ໄດ້ populate) — ຫາຊື່ຈາກ users ທີ່ໂຫຼດໄວ້ແລ້ວ (ໃຊ້ຮ່ວມກັບ dropdown ມອບໝາຍ)
    const matched = users.find((u) => (u._id || u.id) === agent);
    return matched ? getUserDisplayName(matched) || 'ບໍ່ລະບຸຊື່' : agent;
  };

  const branchName = (id) => branches.find((b) => b._id === id)?.name || id || '-';
  const departmentName = (id) => departments.find((d) => d._id === id)?.name || id || '-';
  const ticketTypeName = (id) => ticketTypes.find((t) => t._id === id)?.name || id || '-';

  const extractArrayData = (resData) => {
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    if (resData && Array.isArray(resData.tickets)) return resData.tickets;
    if (resData && Array.isArray(resData.items)) return resData.items;
    return [];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const ticketsUrl = selectedBranchId
        ? `${API_BASE_URL}/tickets?branchId=${encodeURIComponent(selectedBranchId)}`
        : `${API_BASE_URL}/tickets`;

      const [issuesRes, typesRes, branchesRes, deptsRes] = await Promise.all([
        fetch(ticketsUrl, { headers }),
        fetch(`${API_BASE_URL}/ticket-types`, { headers }),
        fetch(`${API_BASE_URL}/branches`, { headers }),
        fetch(`${API_BASE_URL}/departments`, { headers })
      ]);

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(extractArrayData(data));
      }

      if (typesRes.ok) {
        const data = await typesRes.json();
        setTicketTypes(extractArrayData(data));
      }

      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(extractArrayData(data));
      }

      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(extractArrayData(data));
      }

      if (canAssign) {
        const [meRes, usersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/me`, { headers }),
          fetch(`${API_BASE_URL}/users`, { headers }),
        ]);
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData?.data || meData?.user || meData);
        }
        if (usersRes.ok) setUsers(extractArrayData(await usersRes.json()));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const openCreateModal = () => {
    setIsModalOpen(true);
    setFormError('');
    setSlaNotice('');
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setFormError('');
    setSlaNotice('');
  };

  // Navbar "ສ້າງໃໝ່" ສົ່ງມາທີ່ /issues?create=1 ໃຫ້ເປີດ Modal ສ້າງ Ticket ອັດຕະໂນມັດ
  const shouldOpenCreate = searchParams.get('create') === '1';
  useEffect(() => {
    if (shouldOpenCreate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsModalOpen(true);
      setFormError('');
      setSlaNotice('');
    }
  }, [shouldOpenCreate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isModalOpen || formData.title.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestedArticles([]);
      return;
    }
    const delay = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/kb-articles/suggest?q=${encodeURIComponent(formData.title)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestedArticles(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setSuggestLoading(false);
      }
    }, 400);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.title, isModalOpen]);

  useEffect(() => {
    priorityRef.current = formData.priority;
  }, [formData.priority]);

  useEffect(() => {
    if (!formData.ticketTypeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailablePriorities(null);
      setSlaNotice('');
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}/sla-policies/ticket-type/${formData.ticketTypeId}/available-priorities`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        const levels = Array.isArray(data?.data) ? data.data : [];
        setAvailablePriorities(levels);

        // ລະດັບທີ່ຄາດຢູ່ (default ຂອງ ticket type ຫຼື medium ຈາກ state ເດີມ) ອາດເປັນບໍ່ມີ SLA — ປ່ຽນໄປໃຊ້ລະດັບທີ່ມີ SLA ແທນ ແລ້ວແຈ້ງລາຍງານ
        const chosen = priorityRef.current;
        if (levels.length > 0 && !levels.includes(chosen)) {
          const fallback = levels[0];
          setFormData(prev => ({ ...prev, priority: fallback }));
          setSlaNotice(
            `ລະດັບຄວາມສຳຄັງ "${PRIORITY_LABELS[chosen] || chosen}" ບໍ່ມີ SLA ສຳລັບຫົວຂໍ້ບັນຫານີ້ — ປ່ຽນເປັນ "${PRIORITY_LABELS[fallback] || fallback}" ໃຫ້ອັດຕະໂນມັດ (ລະດັບທີ່ມີ SLA: ${levels.map(l => PRIORITY_LABELS[l] || l).join(', ')})`
          );
        }
      })
      .catch(err => console.error('Error fetching available priorities:', err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.ticketTypeId]);

  // ຄຳນະນຶກ: ລະດັບທີ່ເລືອກຢູ່ໃນຟອມຕ້ອງມີ SLA ຈຶ່ງຈະສ້າງລາຍການໄດ້
  const hasTicketType = !!formData.ticketTypeId;
  const slaChecked = hasTicketType && availablePriorities !== null;
  const noSlaForType = slaChecked && availablePriorities.length === 0;
  const priorityHasNoSla = slaChecked && !noSlaForType && !availablePriorities.includes(formData.priority);
  const handleSelectTicketType = (type) => {
    setSelectedTypeName(type.name);
    setSlaNotice('');
    setFormError('');
    setFormData(prev => ({
      ...prev,
      ticketTypeId: type._id || type.id,
      priority: type.defaultPriority || prev.priority,
      title: type.name,
      departmentId: type.defaultDepartmentId?._id || type.defaultDepartmentId || prev.departmentId
    }));
    setIsTypeDropdownOpen(false);
    setTypeSearchQuery('');
  };

  const filteredTicketTypes = ticketTypes.filter(type =>
    type.name?.toLowerCase().includes(typeSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ກວດສອບກ່ອນສ້າງ — ຢ່າງໜ້ອຍໃຫ້ບານຫົວຂໍ້ບັນຫາ ຫຼື ລະດັບຄວາມສຳຄັງທີ່ບໍ່ມີ SLA ຜ່ານໄປ API
    if (!formData.ticketTypeId) {
      setFormError('ກະລຸນາເລືອກຫົວຂໍ້ບັນຫາ (ປະເພດບັນຫາ) ກ່ອນ');
      return;
    }
    if (noSlaForType) {
      setFormError('ຫົວຂໍ້ບັນຫານີ້ຍັງບໍ່ມີ SLA ໃດໆ — ກະລຸນາໃຫ້ຜູ້ດູແລກຕັ້ງ SLA ກ່ອນ ຫຼື ເລືອກຫົວຂໍ້ບັນຫາອື່ນ');
      return;
    }
    if (priorityHasNoSla) {
      setFormError(
        `ລະດັບຄວາມສຳຄັງ "${PRIORITY_LABELS[formData.priority] || formData.priority}" ບໍ່ມີ SLA ສຳລັບຫົວຂໍ້ບັນຫານີ້ — ກະລຸນາເລືອກໃນລະດັບທີ່ມີ SLA: ${availablePriorities.map(l => PRIORITY_LABELS[l] || l).join(', ')}`
      );
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setFormData({
          title: '',
          description: '',
          ticketTypeId: '',
          priority: 'medium',
          branchId: '',
          departmentId: '',
        });
        setSelectedTypeName('');
        setSuggestedArticles([]);
        setSlaNotice('');
        setAvailablePriorities(null);
        fetchData();
      } else {
        const errData = await response.json().catch(() => ({}));
        // ຄ່າຂອງເຊີບເວີໃຊ້ `msg` (http-exception.filter) ແຕ່ `message` ເປັນ fallback
        setFormError(errData?.msg || errData?.message || 'ເກີດຂໍ້ຜິດພາດໃນການສ້າງລາຍການ');
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
      setFormError('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = (item) => {
    const unreadIds = unreadByTicket[item._id];
    if (unreadIds && unreadIds.length > 0) {
      setUnreadByTicket((prev) => {
        const next = { ...prev };
        delete next[item._id];
        return next;
      });
      markNotificationsRead(unreadIds);
    }
    setSelectedTicket(item);
    setIsDetailModalOpen(true);
    setIsAssignPanelOpen(false);
    setAssignMode('self');
    setAssignSearchQuery('');
    setSelectedAssignee(null);
    setPendingStatusTarget(null);
    setPendingStatusNote('');
  };

  const refreshTicketInDetail = async (ticketId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        // Every backend response is wrapped as { response, msg, data, time } —
        // the actual ticket lives at body.data.
        const updated = body?.data ?? body;
        setSelectedTicket(updated);
        setIssues(prev => prev.map(t => (t._id === ticketId ? updated : t)));
      }
    } catch (err) {
      console.error('Error refreshing ticket:', err);
    }
  };

  const markNotificationsRead = async (ids) => {
    try {
      await Promise.all(
        ids.map((nid) =>
          fetch(`${API_BASE_URL}/notifications/${nid}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` },
          })
        )
      );
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  };

  const refreshUnread = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/my?unreadOnly=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const map = {};
      extractArrayData(await res.json()).forEach((n) => {
        if (n.refModel !== 'Ticket') return;
        if (!map[n.refId]) map[n.refId] = [];
        map[n.refId].push(n._id);
      });
      const openId = openTicketIdRef.current;
      if (openId && map[openId]) {
        markNotificationsRead(map[openId]);
        delete map[openId];
      }
      setUnreadByTicket(map);
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  };

  useEffect(() => {
    refreshUnread();
    window.addEventListener('notifications:changed', refreshUnread);
    return () => window.removeEventListener('notifications:changed', refreshUnread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTickets = async () => {
    try {
      const url = selectedBranchId
        ? `${API_BASE_URL}/tickets?branchId=${encodeURIComponent(selectedBranchId)}`
        : `${API_BASE_URL}/tickets`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setIssues(extractArrayData(await res.json()));
    } catch (error) {
      console.error('Error refreshing tickets:', error);
    }
  };

  const openTicketIdRef = useRef(null);
  useEffect(() => {
    openTicketIdRef.current = isDetailModalOpen ? selectedTicket?._id : null;
  }, [selectedTicket, isDetailModalOpen]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let timer = null;
    let openTicketChanged = false;

    const onTicketChanged = (payload) => {
      if (payload?.id && payload.id === openTicketIdRef.current) openTicketChanged = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        refreshTickets();
        refreshUnread();
        if (openTicketChanged && openTicketIdRef.current) {
          openTicketChanged = false;
          refreshTicketInDetail(openTicketIdRef.current);
        }
      }, 300);
    };

    socket.on('ticket:changed', onTicketChanged);
    return () => {
      clearTimeout(timer);
      socket.off('ticket:changed', onTicketChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const loadAssignCandidates = async (ticketId) => {
    setAssignCandidatesLoading(true);
    setAssignCandidatesError('');
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/assignable-agents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAssignCandidates(extractArrayData(body));
      } else {
        setAssignCandidates([]);
        setAssignCandidatesError(body?.msg || body?.message || 'ບໍ່ສາມາດໂຫຼດລາຍຊື່ຜູ້ຮັບຜິດຊອບໄດ້');
      }
    } catch (err) {
      console.error('Error loading assignable agents:', err);
      setAssignCandidates([]);
      setAssignCandidatesError('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setAssignCandidatesLoading(false);
    }
  };

  // ໂຫຼດລາຍຊື່ໃໝ່ທຸກເທື່ອທີ່ເປີດແຜງມອບໝາຍ ເພື່ອໃຫ້ຈຳນວນວຽກຄ້າງເປັນປັດຈຸບັນສະເໝີ
  useEffect(() => {
    if (isAssignPanelOpen && selectedTicket?._id) {
      loadAssignCandidates(selectedTicket._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssignPanelOpen, selectedTicket?._id]);

  const currentUserId = currentUser?._id || currentUser?.id;
  const selfCandidate = assignCandidates.find((c) => c._id === currentUserId);

  const handleAssign = async () => {
    if (!selectedTicket) return;
    const agentId = assignMode === 'self' ? currentUserId : selectedAssignee?._id;
    if (!agentId) {
      alert('ກະລຸນາເລືອກຜູ້ຮັບຜິດຊອບກ່ອນ');
      return;
    }
    setAssignSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${selectedTicket._id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ agentId }),
      });
      if (res.ok) {
        await refreshTicketInDetail(selectedTicket._id);
        setIsAssignPanelOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.msg || err.message || 'ບໍ່ສາມາດມອບໝາຍໄດ້');
      }
    } catch (err) {
      console.error('Error assigning ticket:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // ອັບໂຫລດຮູບຢັ້ງຢືນການແກ້ໄຂ — ຄືຮູບແບບດຽວກັບ TicketChat.jsx (ອັບຜ່ານ /api/uploads ກ່ອນ, ເກັບແຄ່ URL ໄວ້ລໍ)
  const deleteUploadedFile = (url) => {
    const filename = url.split('/').pop();
    fetch(`${API_BASE_URL}/uploads/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {}); // ຖ້າລຶບບໍ່ສຳເລັດກໍບໍ່ຕ້ອງລົບກວນຜູ້ໃຊ້
  };

  const handleStatusFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowedExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExt.includes(ext)) {
      alert('ຮອງຮັບສະເພາະຮູບພາບ (PNG/JPG/GIF/WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('ໄຟລ໌ໃຫຍ່ເກີນໄປ (ຈຳກັດ 10MB)');
      return;
    }

    setStatusFileUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPendingStatusFiles((prev) => [...prev, data.data.url]);
      } else {
        alert('ອັບໂຫລດຮູບບໍ່ສຳເລັດ');
      }
    } catch (err) {
      console.error('Error uploading status image:', err);
      alert('ບໍ່ສາມາດອັບໂຫລດຮູບໄດ້');
    } finally {
      setStatusFileUploading(false);
    }
  };

  const removePendingStatusFile = (url) => {
    deleteUploadedFile(url);
    setPendingStatusFiles((prev) => prev.filter((u) => u !== url));
  };

  // ລຶບຮູບທີ່ອັບໄວ້ແລ້ວອອກຈາກ server (best-effort) — ໃຊ້ເວລາຍກເລີກ ຫຼື ປ່ຽນໄປທາງອື່ນ
  // ໂດຍບໍ່ແຕະຮູບທີ່ຖືກສົ່ງໄປກັບ ticket ແລ້ວ (ບໍ່ຕ້ອງເອີ໵ນີ້ີ)
  const clearPendingStatusFiles = (removeRemote = false) => {
    if (removeRemote) pendingStatusFiles.forEach(deleteUploadedFile);
    setPendingStatusFiles([]);
  };

  const submitStatusChange = async (status, note, attachments) => {
    if (!selectedTicket) return;
    setStatusChangeSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${selectedTicket._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, note: note || undefined, attachments: attachments?.length ? attachments : undefined }),
      });
      if (res.ok) {
        await refreshTicketInDetail(selectedTicket._id);
        setPendingStatusTarget(null);
        setPendingStatusNote('');
        setPendingStatusFiles([]);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'ປ່ຽນສະຖານະບໍ່ສຳເລັດ');
      }
    } catch (err) {
      console.error('Error changing status:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setStatusChangeSubmitting(false);
    }
  };

  const handleStatusButtonClick = (status) => {
    if (status === 'RESOLVED') {
      setPendingStatusTarget(status);
      setPendingStatusNote('');
      return;
    }
    // ຖ້າກຳລັງເປີດ panel RESOLVED ຢູ່ແລ້ວປ່ຽນໄປສະຖານະອື່ນ — ຮູບທີ່ແນບໄວ້ຈະບໍ່ຖືກສົ່ງໄປກັບ ticket
    // ກໍລະນີນີ້ ລຶບອອກຈາກ server ເລີຍກ່ອນເພື່ອບໍ່ໃຫ້ເປັນຂີ້ເຜົ່າ
    if (pendingStatusTarget === 'RESOLVED' && pendingStatusFiles.length > 0) {
      clearPendingStatusFiles(true);
    }
    submitStatusChange(status);
  };

  const filteredUsersForAssign = assignCandidates.filter(u =>
    getUserDisplayName(u).toLowerCase().includes(assignSearchQuery.toLowerCase())
  );

  const filteredIssues = Array.isArray(issues) ? issues.filter(item => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item._id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.status);
    const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(item.priority);
    return matchesSearch && matchesStatus && matchesPriority;
  }) : [];

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === 'priority_asc') {
      return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
    }
    if (sortBy === 'priority_desc') {
      return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
    }
    // date: newest first
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const getSlaIndicator = (item) => {
    const sla = item.sla;
    if (!sla || !sla.resolutionDueAt) {
      return { color: 'bg-gray-300', label: 'ບໍ່ມີ SLA ຄຸ້ມຄອງ' };
    }
    if (item.status === 'WAITING_ON_USER') {
      return { color: 'bg-blue-400', label: 'ຢຸດຊົ່ວຄາວ' };
    }
    const isFixed = item.status === 'RESOLVED' || item.status === 'CLOSED';
    // ເກີນ SLA ແລ້ວ ແລະ ຍັງບໍ່ແກ້ໄຂ → ກະພິບເຕືອນ; ແກ້ໄຂແລ້ວ → ກັບເປັນຈຸດແດງທຳມະດາ
    if (sla.breached) {
      return { color: 'bg-red-500', label: 'ເກີນ SLA ແລ້ວ', beacon: !isFixed };
    }
    if (isFixed) {
      return { color: 'bg-green-500', label: 'ແກ້ໄຂແລ້ວ' };
    }
    // eslint-disable-next-line react-hooks/purity
    const remainingMs = new Date(sla.resolutionDueAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      return { color: 'bg-red-500', label: 'ເກີນ SLA ແລ້ວ', beacon: true };
    }
    if (remainingMs < 30 * 60 * 1000) {
      return { color: 'bg-yellow-400', label: 'ໃກ້ຄົບກຳນົດ SLA' };
    }
    return { color: 'bg-green-500', label: 'ຍັງທັນເວລາ SLA' };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ແກ້ໄຂບັນຫາ</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການ ແລະ ຕິດຕາມສະຖານະການແຈ້ງບັນຫາຕ່າງໆໃນລະບົບ</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CsvImportButton
              endpoint="/tickets/bulk-import"
              refresh={fetchData}
              permitted={canImportTickets}
              csvHint="CSV ຖັນ: title, description, ticketTypeId (TT###), branchId (BX###) — ຈຳເປັນ; departmentId (DX###), priority (low/medium/high/urgent) — ເພີ່ມໄດ້"
            />
            <CsvExportButton
              data={sortedIssues}
              filename="tickets.csv"
              label="Export CSV"
              permitted={hasPermission('tickets', 'read')}
              columns={[
                { key: 'title', label: 'title' },
                { key: 'description', label: 'description' },
                { key: 'ticketTypeId', label: 'ticketTypeId' },
                { label: 'ticketType', value: (r) => ticketTypeName(r.ticketTypeId) },
                { key: 'branchId', label: 'branchId' },
                { label: 'branch', value: (r) => branchName(r.branchId) },
                { key: 'departmentId', label: 'departmentId' },
                { label: 'department', value: (r) => departmentName(r.departmentId) },
                { key: 'priority', label: 'priority' },
                { label: 'status', value: (r) => STATUS_LABELS[r.status] || r.status || '' },
                { label: 'assignedAgent', value: (r) => (typeof r.assignedAgent === 'string' ? r.assignedAgent : '') },
                { label: 'createdAt', value: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '') },
                { key: 'ticketNumber', label: 'ticketNumber' },
              ]}
            />
            {canCreateTicket && (
              <button
                onClick={openCreateModal}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus size={18} />
                <span>ສ້າງລາຍການໃໝ່</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາລະຫັດ, ຫົວຂໍ້..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">

            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
              >
                <Filter size={16} />
                <span>FILTER</span>
                {(statusFilter.length + priorityFilter.length) > 0 && (
                  <span key={statusFilter.length + priorityFilter.length}>{` (${statusFilter.length + priorityFilter.length})`}</span>
                )}
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ສະຖານະ</p>
                      {TICKET_STEPS.concat({ key: 'WAITING_ON_USER', label: 'ລໍຖ້າຜູ້ໃຊ້' }).map(step => (
                        <label key={step.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={statusFilter.includes(step.key)} onChange={() => toggleStatusFilter(step.key)} className="rounded" />
                          {step.label}
                        </label>
                      ))}
                    </div>

                    <div className="border-l border-gray-100 pl-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-1">ຄວາມສຳຄັນ</p>
                      {PRIORITY_LEVELS.map(level => (
                        <label key={level.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={priorityFilter.includes(level.key)} onChange={() => togglePriorityFilter(level.key)} className="rounded" />
                          {level.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {(statusFilter.length + priorityFilter.length) > 0 && (
                    <button
                      onClick={() => { setStatusFilter([]); setPriorityFilter([]); }}
                      className="w-full text-center text-xs text-amber-600 hover:text-amber-700 mt-3 pt-2 border-t border-gray-100"
                    >
                      ລ້າງການກອງ
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 transition"
              >
                <span>ຈັດຮຽງຕາມ</span>
              </button>

              {isSortOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-2">
                  {SORT_OPTIONS.map(opt => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                    >
                      <input
                        type="radio"
                        name="sortBy"
                        checked={sortBy === opt.key}
                        onChange={() => { setSortBy(opt.key); setIsSortOpen(false); }}
                        className="rounded-full"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>



        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                  <th className="p-4 font-medium">SLA</th>
                  <th className="p-4 font-medium">ລະຫັດ / Ticket Number</th>
                  <th className="p-4 font-medium">ຫົວຂໍ້ບັນຫາ</th>
                  <th className="p-4 font-medium">ຄວາມສຳຄັນ</th>
                  <th className="p-4 font-medium">ສະຖານະ</th>
                  <th className="p-4 font-medium">ເຈົ້າໜ້າທີ່ຮັບຜິດຊອບ</th>
                  <th className="p-4 font-medium">ສ້າງເມື່ອ</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>ກຳລັງໂຫລດຂໍ້ມູນ...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedIssues.length > 0 ? (
                  sortedIssues.map((item) => {
                    const slaIndicator = getSlaIndicator(item);
                    const showProgress = item.status !== 'CLOSED';
                    const isNew = !!unreadByTicket[item._id];
                    return (
                      <React.Fragment key={item._id || item.id}>
                        <tr
                          onClick={() => openDetailModal(item)}
                          className={`cursor-pointer ${isNew ? 'bg-amber-50' : 'hover:bg-gray-50'} ${showProgress ? (isNew ? '' : 'has-[+tr:hover]:bg-gray-50') : 'border-b border-gray-100 last:border-b-0'}`}
                        >
                          <td className={`p-4 ${isNew ? 'shadow-[inset_4px_0_0_0_#f59e0b]' : ''}`}>
                            {slaIndicator.beacon ? (
                              <span
                                className="relative inline-flex items-center justify-center w-5 h-5 align-middle"
                                title={slaIndicator.label}
                                role="img"
                                aria-label={slaIndicator.label}
                              >
                                <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75 animate-ping motion-reduce:animate-none"></span>
                                <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white shadow-[0_0_8px_2px_rgba(239,68,68,0.6)] animate-pulse motion-reduce:animate-none">
                                  <AlertTriangle size={12} strokeWidth={2.5} />
                                </span>
                              </span>
                            ) : (
                              <span
                                className={`w-3 h-3 rounded-full inline-block ${slaIndicator.color}`}
                                title={slaIndicator.label}
                              ></span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-gray-900">{item.ticketNumber || item._id}</td>
                          <td className="p-4">
                            {item.title}
                            {isNew && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold align-middle">ໃໝ່</span>
                            )}
                          </td>
                          <td className="p-4 uppercase">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${item.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                              item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                              {STATUS_LABELS[item.status] || item.status || 'OPEN'}
                            </span>
                          </td>
                          <td className="p-4">
                            {getAgentDisplayName(item.assignedAgent)}
                          </td>
                          <td className="p-4 text-xs text-gray-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                        {showProgress && (
                          <tr
                            onClick={() => openDetailModal(item)}
                            className={`cursor-pointer border-b border-gray-100 last:border-b-0 ${isNew ? 'bg-amber-50' : 'hover:bg-gray-50 [tr:hover+&]:bg-gray-50'}`}
                          >
                            <td colSpan="7" className={`px-4 pb-3 pt-0 ${isNew ? 'shadow-[inset_4px_0_0_0_#f59e0b]' : ''}`}>
                              <TicketProgressBar status={item.status} compact />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-sm text-gray-400">
                      ຍັງບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: ສ້າງ Ticket ໃໝ່ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">ສ້າງລາຍການແຈ້ງບັນຫາໃໝ່</h3>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">ປະເພດບັນຫາ (Ticket Type)</label>
                  {canCreateTicketType && (
                    <a
                      href="/ticket-types"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                      title="ໄປໜ້າຈັດການປະເພດບັນຫາ"
                    >
                      <Plus size={14} />
                      <span>ເພີ່ມປະເພດໃໝ່</span>
                    </a>
                  )}
                </div>
                <div
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white flex items-center justify-between cursor-pointer"
                >
                  <span className={selectedTypeName ? "text-gray-800" : "text-gray-400"}>
                    {selectedTypeName || "-- ຄົ້ນຫາ ຫຼື ເລືອກປະເພດບັນຫາ --"}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>

                {isTypeDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <input
                        type="text"
                        autoFocus
                        value={typeSearchQuery}
                        onChange={(e) => setTypeSearchQuery(e.target.value)}
                        placeholder="ພິມຄົ້ນຫາຫົວຂໍ້ບັນຫາ..."
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      />
                    </div>
                    <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {filteredTicketTypes.length > 0 ? (
                        filteredTicketTypes.map(type => (
                          <li
                            key={type._id || type.id}
                            onClick={() => handleSelectTicketType(type)}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 cursor-pointer transition"
                          >
                            {type.name}
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-4 text-center text-xs text-gray-400">
                          ບໍ່ພົບຫົວຂໍ້ທີ່ຄົ້ນຫາ
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ຫົວຂໍ້ບັນຫາ</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="ລະບຸຫົວຂໍ້ບັນຫາ..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />

                {suggestLoading && (
                  <p className="text-xs text-gray-400 mt-1.5">ກຳລັງຄົ້ນຫາຄູ່ມືທີ່ກ່ຽວຂ້ອງ...</p>
                )}

                {!suggestLoading && suggestedArticles.length > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-medium text-amber-800">ລອງເບິ່ງຄູ່ມືເຫຼົ່ານີ້ກ່ອນແຈ້ງບັນຫາ:</p>
                    {suggestedArticles.map(article => (
                      <div key={article._id} className="text-xs text-amber-700 flex items-center justify-between">
                        <span>{article.title}</span>
                        <span className="text-amber-500">{article.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ລາຍລະອຽດເພີ່ມຕື່ມ</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="ອະທິບາຍອາການ ຫຼື ບັນຫາທີ່ພົບ..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ລະດັບຄວາມສຳຄັນ</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => {
                      setFormData({ ...formData, priority: e.target.value });
                      setSlaNotice('');
                      setFormError('');
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white ${priorityHasNoSla || noSlaForType ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-amber-500'}`}
                  >
                    {['low', 'medium', 'high', 'urgent'].map(p => {
                      const hasSla = !slaChecked || availablePriorities.includes(p);
                      return (
                        <option key={p} value={p} disabled={slaChecked && !hasSla}>
                          {PRIORITY_LABELS[p] || p.charAt(0).toUpperCase() + p.slice(1)}{slaChecked && !hasSla ? ' (ບໍ່ມີ SLA)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {noSlaForType && (
                    <p className="text-xs text-red-600 mt-1.5">
                      ຫົວຂໍ້ບັນຫານີ້ບໍ່ມີ SLA ໃດໆ — ຕ້ອງໃຫ້ຜູ້ດູແລກຕັ້ງ SLA ກ່ອນ ຈຶ່ງຈະສ້າງລາຍການໄດ້
                    </p>
                  )}
                  {slaNotice && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-1.5">
                      {slaNotice}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ສາຂາ (Branch)</label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="">-- ເລືອກສາຂາ --</option>
                    {branches.map(branch => (
                      <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ພະແນກ (Department)</label>
                <select
                  required
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  <option value="">-- ເລືອກພະແນກ --</option>
                  {departments.map(dept => (
                    <option key={dept._id || dept.id} value={dept._id || dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <X size={14} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={submitting || noSlaForType || priorityHasNoSla}
                  title={noSlaForType || priorityHasNoSla ? 'ຕ້ອງເລືອກລະດັບຄວາມສຳຄັງທີ່ມີ SLA ກ່ອນ' : undefined}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  <span>ສ້າງລາຍການ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ລາຍລະອຽດ Ticket — ຄລິກແຖວໃນຕາຕະລາງເພື່ອເປີດ */}
      {isDetailModalOpen && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{selectedTicket.title}</h3>
                <p className="text-xs text-gray-400">{selectedTicket.ticketNumber || selectedTicket._id}</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* ຄວາມຄືບໜ້າຂອງ Ticket */}
              <TicketProgressBar status={selectedTicket.status} />

              {/* ຂໍ້ມູນພື້ນຖານ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">ຄວາມສຳຄັນ</div>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium uppercase ${selectedTicket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedTicket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      selectedTicket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>{selectedTicket.priority}</span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">ສະຖານະ</div>
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                    {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">ຜູ້ແຈ້ງ</div>
                  <div className="text-gray-700">{getAgentDisplayName(selectedTicket.raisedBy)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">ຜູ້ຮັບຜິດຊອບ</div>
                  <div className="text-gray-700">{getAgentDisplayName(selectedTicket.assignedAgent)}</div>
                </div>
              </div>

              {/* ລາຍລະອຽດຈາກຜູ້ແຈ້ງ */}
              <div>
                <div className="text-xs text-gray-400 mb-1">ລາຍລະອຽດຈາກຜູ້ແຈ້ງ</div>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">
                  {selectedTicket.description || 'ບໍ່ມີລາຍລະອຽດເພີ່ມຕື່ມ'}
                </p>
              </div>

              {/* ປຸ່ມໄປໜ້າແຊັດ — ຕິດຕໍ່ປະສານງານກັບຜູ້ແຈ້ງບັນຫາ */}
              <button
                onClick={() => navigate(`/issues/${selectedTicket._id}/chat`)}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-sm font-medium transition"
              >
                <MessageSquare size={16} />
                <span>ໄປໜ້າແຊັດກັບຜູ້ແຈ້ງບັນຫາ</span>
              </button>

              {/* ປຸ່ມຮັບບັນຫາ / ມອບໝາຍ */}
              {canAssign && selectedTicket.status !== 'CLOSED' && (
                <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                  {!isAssignPanelOpen ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setAssignMode('self'); setIsAssignPanelOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-xl text-sm font-medium transition"
                      >
                        <UserCheck size={16} />
                        <span>ຮັບບັນຫານີ້</span>
                      </button>
                      <button
                        onClick={() => { setAssignMode('other'); setIsAssignPanelOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium transition"
                      >
                        <UserCheck size={16} />
                        <span>ມອບໝາຍໃຫ້ຄົນອື່ນ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2 text-xs font-medium">
                        <button
                          onClick={() => setAssignMode('self')}
                          className={`px-3 py-1.5 rounded-lg ${assignMode === 'self' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          ຕົນເອງກົດຮັບ
                        </button>
                        <button
                          onClick={() => setAssignMode('other')}
                          className={`px-3 py-1.5 rounded-lg ${assignMode === 'other' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          ມອບໝາຍໃຫ້ຄົນອື່ນ
                        </button>
                      </div>

                      {assignMode === 'self' ? (
                        <div className="text-sm bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs mb-1">ຢືນຢັນຕົວຕົນຜູ້ຮັບ:</p>
                          <p className="font-semibold text-gray-800">
                            {[currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.email || 'ກຳລັງໂຫຼດ...'}
                          </p>
                          <p className="text-xs text-gray-500">{currentUser?.email}</p>
                          {currentUser?.departmentId?.name && (
                            <p className="text-xs text-gray-500">ພະແນກ: {currentUser.departmentId.name}</p>
                          )}
                          {!assignCandidatesLoading && !assignCandidatesError && currentUser && !selfCandidate && (
                            <p className="text-xs text-red-600 mt-2">
                              ທ່ານຮັບບັນຫານີ້ເອງບໍ່ໄດ້ — ຕ້ອງເປັນ AGENT ໃນພະແນກ/ສາຂາດຽວກັນກັບ ticket ເທົ່ານັ້ນ
                            </p>
                          )}
                          {selfCandidate && (
                            <p className="text-xs text-gray-500 mt-2">
                              ວຽກຄ້າງປັດຈຸບັນ: <span className="font-semibold text-gray-700">{selfCandidate.activeTickets}</span> ບັນຫາ
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={assignSearchQuery}
                            onChange={(e) => setAssignSearchQuery(e.target.value)}
                            placeholder="ຄົ້ນຫາຊື່ພະນັກງານ..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
                            {assignCandidatesLoading && (
                              <div className="px-3 py-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                                <Loader2 className="animate-spin" size={12} /> ກຳລັງໂຫຼດ...
                              </div>
                            )}
                            {!assignCandidatesLoading && assignCandidatesError && (
                              <div className="px-3 py-3 text-xs text-red-600 text-center">{assignCandidatesError}</div>
                            )}
                            {!assignCandidatesLoading && !assignCandidatesError && filteredUsersForAssign.map(u => {
                              const workload = getWorkloadInfo(u.activeTickets);
                              const isSelected = selectedAssignee?._id === u._id;
                              return (
                                <div
                                  key={u._id}
                                  onClick={() => !u.isCurrentAssignee && setSelectedAssignee(u)}
                                  className={`px-3 py-2 text-sm flex items-center justify-between gap-2 ${u.isCurrentAssignee ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-amber-50'} ${isSelected ? 'bg-amber-50 text-amber-800 font-medium' : 'text-gray-700'}`}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate">{getUserDisplayName(u)}</div>
                                    <div className="text-[11px] text-gray-400 truncate">
                                      {u.employeeCode}{u.isCurrentAssignee ? ' · ຜູ້ຮັບຜິດຊອບປັດຈຸບັນ' : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-xs">
                                    <span className="text-gray-500">ຄ້າງ {u.activeTickets}</span>
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${workload.cls}`}>{workload.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {!assignCandidatesLoading && !assignCandidatesError && filteredUsersForAssign.length === 0 && (
                              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                                {assignCandidates.length === 0 ? 'ບໍ່ມີ AGENT ໃນພະແນກນີ້ທີ່ມອບໝາຍໄດ້' : 'ບໍ່ພົບ'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsAssignPanelOpen(false)}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          ຍົກເລີກ
                        </button>
                        <button
                          onClick={handleAssign}
                          disabled={
                            assignSubmitting ||
                            (assignMode === 'self' ? !selfCandidate : !selectedAssignee)
                          }
                          className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {assignSubmitting && <Loader2 className="animate-spin" size={14} />}
                          <span>ຢືນຢັນ</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ປຸ່ມປ່ຽນສະຖານະ */}
              {canUpdateStatus && (ALLOWED_TRANSITIONS[selectedTicket.status] || []).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">ປ່ຽນສະຖານະ</div>
                  <div className="flex flex-wrap gap-2">
                    {ALLOWED_TRANSITIONS[selectedTicket.status].map(target => (
                      <button
                        key={target}
                        onClick={() => handleStatusButtonClick(target)}
                        disabled={statusChangeSubmitting}
                        className="px-3 py-1.5 text-xs border border-gray-200 hover:border-amber-400 hover:text-amber-700 rounded-lg font-medium transition disabled:opacity-50"
                      >
                        → {STATUS_LABELS[target]}
                      </button>
                    ))}
                  </div>

                  {pendingStatusTarget === 'RESOLVED' && (
                    <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
                      <label className="block text-xs font-medium text-gray-700">
                        ໄດ້ແກ້ໄຂຫຍັງໄປແດ່? (ຈຳເປັນຕ້ອງໃສ່)
                      </label>
                      <textarea
                        rows="2"
                        value={pendingStatusNote}
                        onChange={(e) => setPendingStatusNote(e.target.value)}
                        placeholder="ອະທິບາຍວິທີແກ້ໄຂ ຫຼືສາເຫດ..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />

                      {/* ຮູບຢັ້ງຢືນການແກ້ໄຂ — ບໍ່ບັງຄັບ, ຊ່ວຍໃຫ້ຮູ້ຈຸດທີ່ແກ້ໄຂແທ້ຈິງ ນອກເໜືອຈາກຂໍ້ຄວາມ */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          ຮູບຢັ້ງຢືນການແກ້ໄຂ (ບໍ່ບັງຄັບ)
                        </label>
                        {pendingStatusFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {pendingStatusFiles.map((url) => (
                              <div key={url} className="relative group">
                                <img
                                  src={`${API_ORIGIN}${url}`}
                                  alt="ຮູບຢັ້ງຢືນ"
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => removePendingStatusFile(url)}
                                  className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 opacity-80 hover:opacity-100"
                                  title="ລຶບຮູບ"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer">
                          {statusFileUploading ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
                          <span>{statusFileUploading ? 'ກຳລັງອັບໂຫລດ...' : 'ແນບຮູບ'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={handleStatusFileSelect}
                            disabled={statusFileUploading}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setPendingStatusTarget(null); setPendingStatusNote(''); clearPendingStatusFiles(true); }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          ຍົກເລີກ
                        </button>
                        <button
                          onClick={() => {
                            if (!pendingStatusNote.trim()) { alert('ກະລຸນາໃສ່ລາຍລະອຽດການແກ້ໄຂກ່ອນ'); return; }
                            submitStatusChange('RESOLVED', pendingStatusNote.trim(), pendingStatusFiles);
                          }}
                          disabled={statusChangeSubmitting || statusFileUploading}
                          className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {statusChangeSubmitting && <Loader2 className="animate-spin" size={14} />}
                          <span>ຢືນຢັນແກ້ໄຂແລ້ວ</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ປະຫວັດ */}
              {Array.isArray(selectedTicket.history) && selectedTicket.history.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                    <ClockIcon size={14} />
                    <span>ປະຫວັດການດຳເນີນການ</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {[...selectedTicket.history].reverse().map((h, idx) => (
                      <div key={idx} className="text-xs bg-gray-50 rounded-lg p-2.5">
                        <div className="flex justify-between text-gray-500">
                          <span className="font-medium text-gray-700">{h.action}</span>
                          <span>{h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</span>
                        </div>
                        <div className="text-gray-500 mt-0.5">ໂດຍ: {getAgentDisplayName(h.actorId)}</div>
                        {h.note && <div className="text-gray-600 mt-1">{h.note}</div>}
                        {Array.isArray(h.attachments) && h.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {h.attachments.map((url) => (
                              <a key={url} href={`${API_ORIGIN}${url}`} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={`${API_ORIGIN}${url}`}
                                  alt="ຮູບຢັ້ງຢືນ"
                                  className="w-14 h-14 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}