import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  // ຖ້າບໍ່ມີ Token ໃຫ້ສົ່ງກັບໄປໜ້າ Login ທັນທີ
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ຖ້າມີ Token ໃຫ້ສະແດງຜົນ Component ປົກກະຕິ
  return children;
}