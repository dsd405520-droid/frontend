import React, { useState, useEffect } from 'react';
import { Shield, Plus } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

export default function RolesManagement() {
  const [roles, setRoles] = useState([]);

  /*
  useEffect(() => {
    fetch('http://localhost:3000/api/roles')
      .then(res => res.json())
      .then(data => setRoles(data));
  }, []);
  */

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ສິດ ແລະ ບົດບາດ (RBAC)</h1>
            <p className="text-sm text-gray-500 mt-1">ກຳນົດສິດທິການເຂົ້າເຖິງໂມດູນຕ່າງໆຕາມບົດບາດຜູ້ໃຊ້</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm">
            <Plus size={18} />
            <span>ເພີ່ມບົດບາດໃໝ່</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.length > 0 ? (
            roles.map((role) => (
              <div key={role._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                  <Shield size={18} />
                  <span>{role.code}</span>
                </div>
                <h3 className="font-bold text-gray-800 text-base">{role.name}</h3>
                <p className="text-sm text-gray-500">{role.description || 'ບໍ່ມີຄຳອະທິບາຍ'}</p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              ຍັງບໍ່ມີຂໍ້ມູນບົດບາດ (ພ້ອມເຊື່ອມຕໍ່ NestJS + MongoDB)
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}