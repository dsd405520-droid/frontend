import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Shield, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  /* 
  useEffect(() => {
    // ດຶງຂໍ້ມູນຈາກ NestJS API: GET /api/users
    fetch('http://localhost:3000/api/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ຈັດການຜູ້ໃຊ້</h1>
            <p className="text-sm text-gray-500 mt-1">ຈັດການສິດທິ ແລະ ຂໍ້ມູນພະນັກງານໃນອົງກອນ</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <UserPlus size={18} />
            <span>ເພີ່ມຜູ້ໃຊ້ໃໝ່</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs">
                <th className="p-4 font-medium">ຊື່-ນາມສະກຸນ (_id)</th>
                <th className="p-4 font-medium">ອີເມວ</th>
                <th className="p-4 font-medium">ພະແນກ</th>
                <th className="p-4 font-medium">ສິດທິ (Role)</th>
                <th className="p-4 font-medium">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-900">{user.name}</td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">{user.department}</td>
                    <td className="p-4">{user.role}</td>
                    <td className="p-4">{user.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-400">
                    ຍັງບໍ່ມີข้อมูลຜູ້ໃຊ້ (ໂຄງສ້າງພ້ອມຕໍ່ NestJS + MongoDB ແລ້ວ)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}