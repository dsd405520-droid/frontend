import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  
  // ຖ້າບໍ່มี Token ໃຫ້ redirect ไปໜ້າ Login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}