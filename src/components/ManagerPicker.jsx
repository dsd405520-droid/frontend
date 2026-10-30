import { useMemo, useState } from 'react';
import { X, Search, AlertCircle } from 'lucide-react';

const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeCode || u._id;

/**
 * ເລືອກຫົວໜ້າພະແນກຈາກລາຍຊື່ຜູ້ໃຊ້ (ແທນການພິມ ID ເອງ)
 * - value: string[] ຂອງ users._id (ຄ່າດຽວກັບ departments.managerIds)
 * - users: ລາຍຊື່ຜູ້ໃຊ້ທັງໝົດ · usersAvailable=false (ບໍ່ມີສິດ users.read) → ກັບໄປໃຊ້ຊ່ອງພິມ ID ແບບເກົ່າ
 * - ID ທີ່ບໍ່ພົບຜູ້ໃຊ້ (ຂໍ້ມູນເກົ່າ) ຈະຍັງສະແດງ ແລະລົບເອງໄດ້ — ບໍ່ຖືກຕັດຖິ້ມຢ່າງງຽບໆ
 */
export default function ManagerPicker({
  value = [],
  onChange,
  users = [],
  usersAvailable = true,
  departments = [],
  preferDepartmentId = '',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const byId = useMemo(() => new Map(users.map((u) => [String(u._id), u])), [users]);
  const deptName = (id) => departments.find((d) => d._id === id)?.name || '';
  const selected = value.map(String);

  if (!usersAvailable) {
    return (
      <input
        type="text"
        value={selected.join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        placeholder="ບໍ່ມີສິດເບິ່ງລາຍຊື່ຜູ້ໃຊ້ — ພິມ users._id ຂັ້ນດ້ວຍ ,"
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
      />
    );
  }

  const q = query.trim().toLowerCase();
  const candidates = users
    .filter((u) => u.isActive !== false && !selected.includes(String(u._id)))
    .filter(
      (u) =>
        !q ||
        [fullName(u), u.employeeCode, u.email].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      // ຄົນໃນພະແນກດຽວກັນຂຶ້ນກ່ອນ
      const pa = preferDepartmentId && a.departmentId === preferDepartmentId ? 0 : 1;
      const pb = preferDepartmentId && b.departmentId === preferDepartmentId ? 0 : 1;
      return pa - pb || fullName(a).localeCompare(fullName(b));
    })
    .slice(0, 30);

  const add = (u) => {
    onChange([...selected, String(u._id)]);
    setQuery('');
  };
  const remove = (id) => onChange(selected.filter((s) => s !== id));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const u = byId.get(id);
            const unknown = !u;
            const inactive = u && u.isActive === false;
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium border ${
                  unknown || inactive
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
                title={unknown ? 'ບໍ່ພົບຜູ້ໃຊ້ທີ່ມີ ID ນີ້' : inactive ? 'ຜູ້ໃຊ້ຖືກປິດໃຊ້ງານ — ບໍ່ນັບເປັນຫົວໜ້າ' : id}
              >
                {unknown ? (
                  <>
                    <AlertCircle size={12} /> {id} · ບໍ່ພົບຜູ້ໃຊ້
                  </>
                ) : (
                  <>
                    {fullName(u)} <span className="opacity-60">({u.employeeCode})</span>
                    {inactive && <span className="text-red-600">· ປິດໃຊ້ງານ</span>}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="p-0.5 rounded-full hover:bg-black/10"
                  aria-label="ເອົາອອກ"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="ຄົ້ນຫາຊື່, ລະຫັດພະນັກງານ ຫຼື ອີເມລ ເພື່ອເພີ່ມຫົວໜ້າ..."
          className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
            {candidates.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400">ບໍ່ພົບຜູ້ໃຊ້</div>
            ) : (
              candidates.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(u)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-amber-50 flex items-center justify-between gap-3"
                >
                  <span className="truncate">
                    <span className="font-medium text-gray-800">{fullName(u)}</span>{' '}
                    <span className="text-xs text-gray-400">{u.employeeCode}</span>
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0">{deptName(u.departmentId) || '—'}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
