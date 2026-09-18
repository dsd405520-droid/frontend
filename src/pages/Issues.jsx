import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Loader2, X, ChevronDown, UserCheck, Clock as ClockIcon, Check, MessageSquare } from 'lucide-react';
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
          <React.Fragment key={step.key}>
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
            {!isLast && (
              <div className={`flex-1 h-0.5 mt-4 ${idx < currentIndex ? 'bg-emerald-500' : 'bg-gray-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Issues() {
  const navigate = useNavigate();
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

  // State ສຳລັບ Modal ລາຍລະອຽດ Ticket
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);

  // ຮັບ/ມອບໝາຍບັນຫາ
  const [isAssignPanelOpen, setIsAssignPanelOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('self');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // ປ່ຽນສະຖານະ
  const [statusChangeSubmitting, setStatusChangeSubmitting] = useState(false);
  const [pendingStatusNote, setPendingStatusNote] = useState('');
  const [pendingStatusTarget, setPendingStatusTarget] = useState(null);

  const token = localStorage.getItem('token');

  const hasPermission = (module, action) => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const perms = payload.permissions || [];
      const entry = perms.find(p => p.module === module);
      return !!entry?.actions?.includes(action);
    } catch {
      return false;
    }
  };
  const canCreateTicketType = hasPermission('ticket-types', 'create');
  const canAssign = hasPermission('tickets', 'assign');
  const canUpdateStatus = hasPermission('tickets', 'update');

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

  const getAgentDisplayName = (agent) => {
    if (!agent) return 'ຍັງບໍ່ມີຜູ້ຮັບຜິດຊອບ';
    if (typeof agent === 'object') {
      return getUserDisplayName(agent) || 'ບໍ່ລະບຸຊື່';
    }
    // API ຄືນມາເປັນ id ດິບ (ບໍ່ໄດ້ populate) — ຫາຊື່ຈາກ users ທີ່ໂຫຼດໄວ້ແລ້ວ (ໃຊ້ຮ່ວມກັບ dropdown ມອບໝາຍ)
    const matched = users.find((u) => (u._id || u.id) === agent);
    return matched ? getUserDisplayName(matched) || 'ບໍ່ລະບຸຊື່' : agent;
  };

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

      const [issuesRes, typesRes, branchesRes, deptsRes] = await Promise.all([
        fetch('http://localhost:3000/api/tickets', { headers }),
        fetch('http://localhost:3000/api/ticket-types', { headers }),
        fetch('http://localhost:3000/api/branches', { headers }),
        fetch('http://localhost:3000/api/departments', { headers })
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
          fetch('http://localhost:3000/api/auth/me', { headers }),
          fetch('http://localhost:3000/api/users', { headers }),
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
  }, []);

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
        const res = await fetch(`http://localhost:3000/api/kb-articles/suggest?q=${encodeURIComponent(formData.title)}`, {
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
    if (!formData.ticketTypeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailablePriorities(null);
      return;
    }
    fetch(`http://localhost:3000/api/sla-policies/ticket-type/${formData.ticketTypeId}/available-priorities`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setAvailablePriorities(data.data || []))
      .catch(err => console.error('Error fetching available priorities:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.ticketTypeId]);
  const handleSelectTicketType = (type) => {
    setSelectedTypeName(type.name);
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
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3000/api/tickets', {
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
        fetchData();
      } else {
        const errData = await response.json();
        alert(errData.message || 'ເກີດຂໍ້ຜິດພາດໃນການສ້າງລາຍການ');
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = (item) => {
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
      const res = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
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

  const handleAssign = async () => {
    if (!selectedTicket) return;
    const agentId = assignMode === 'self' ? (currentUser?._id || currentUser?.id) : selectedAssignee?._id;
    if (!agentId) {
      alert('ກະລຸນາເລືອກຜູ້ຮັບຜິດຊອບກ່ອນ');
      return;
    }
    setAssignSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket._id}/assign`, {
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
        alert(err.message || 'ບໍ່ສາມາດມອບໝາຍໄດ້');
      }
    } catch (err) {
      console.error('Error assigning ticket:', err);
      alert('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const submitStatusChange = async (status, note) => {
    if (!selectedTicket) return;
    setStatusChangeSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3000/api/tickets/${selectedTicket._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      if (res.ok) {
        await refreshTicketInDetail(selectedTicket._id);
        setPendingStatusTarget(null);
        setPendingStatusNote('');
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
    submitStatusChange(status);
  };

  const filteredUsersForAssign = users.filter(u =>
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
    if (sla.breached) {
      return { color: 'bg-red-500', label: 'ເກີນ SLA ແລ້ວ' };
    }
    if (item.status === 'RESOLVED' || item.status === 'CLOSED') {
      return { color: 'bg-green-500', label: 'ແກ້ໄຂແລ້ວ' };
    }
    // eslint-disable-next-line react-hooks/purity
    const remainingMs = new Date(sla.resolutionDueAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      return { color: 'bg-red-500', label: 'ເກີນ SLA ແລ້ວ' };
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            <span>ສ້າງລາຍການໃໝ່</span>
          </button>
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
              <tbody className="divide-y divide-gray-100 text-gray-600">
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
                    return (
                      <tr
                        key={item._id || item.id}
                        onClick={() => openDetailModal(item)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="p-4">
                          <span
                            className={`w-3 h-3 rounded-full inline-block ${slaIndicator.color}`}
                            title={slaIndicator.label}
                          ></span>
                        </td>
                        <td className="p-4 font-semibold text-gray-900">{item.ticketNumber || item._id}</td>
                        <td className="p-4">{item.title}</td>
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
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
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
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p} disabled={availablePriorities !== null && !availablePriorities.includes(p)}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}{availablePriorities !== null && !availablePriorities.includes(p) ? ' (ບໍ່ມີ SLA)' : ''}
                      </option>
                    ))}
                  </select>
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50"
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
                          <div className="max-h-32 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
                            {filteredUsersForAssign.slice(0, 20).map(u => (
                              <div
                                key={u._id || u.id}
                                onClick={() => setSelectedAssignee(u)}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 ${(selectedAssignee?._id || selectedAssignee?.id) === (u._id || u.id) ? 'bg-amber-50 text-amber-800 font-medium' : 'text-gray-700'
                                  }`}
                              >
                                {getUserDisplayName(u)}
                              </div>
                            ))}
                            {filteredUsersForAssign.length === 0 && (
                              <div className="px-3 py-3 text-xs text-gray-400 text-center">ບໍ່ພົບ</div>
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
                          disabled={assignSubmitting}
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
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setPendingStatusTarget(null); setPendingStatusNote(''); }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          ຍົກເລີກ
                        </button>
                        <button
                          onClick={() => {
                            if (!pendingStatusNote.trim()) { alert('ກະລຸນາໃສ່ລາຍລະອຽດການແກ້ໄຂກ່ອນ'); return; }
                            submitStatusChange('RESOLVED', pendingStatusNote.trim());
                          }}
                          disabled={statusChangeSubmitting}
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