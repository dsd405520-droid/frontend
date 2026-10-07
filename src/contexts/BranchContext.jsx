import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const STORAGE_KEY = 'helpdesk_selectedBranchId';

const BranchContext = createContext(null);

function unwrap(body) {
  if (Array.isArray(body)) return body;
  return body?.data !== undefined ? body.data : body;
}

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  // ຕັ້ງຄ່າເບື້ອງຕົ້ນຈາກ localStorage ໂດຍກົງ ເພື່ອບໍ່ໃຫ້ກະພິບ ຫຼື ດຶງຂໍ້ມູນຊ້ຳຕອນເປີດໃໝ່
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');

  // ດຶງລາຍຊື່ສາຂາຈາກ backend ຄັ້ງດຽວ
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

    fetch(`${API_BASE_URL}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        const list = unwrap(body) || [];
        setBranches(list);
        setLoading(false);

        // ຖ້າສາຂາທີ່ເກັບໄວ້ຖືກລຶບໄປແລ້ວ ໃຫ້ກັບຄືນສູ່ "ທຸກສາຂາ"
        setSelectedBranchId((current) => {
          if (current && !list.some((b) => b._id === current)) {
            localStorage.removeItem(STORAGE_KEY);
            return '';
          }
          return current;
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const changeBranch = useCallback((id) => {
    const value = id || '';
    setSelectedBranchId(value);
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((b) => b._id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  const value = useMemo(() => ({
    branches,
    loading,
    selectedBranchId: selectedBranchId || '',
    selectedBranch,
    changeBranch,
  }), [branches, loading, selectedBranchId, selectedBranch, changeBranch]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
}

export default BranchContext;