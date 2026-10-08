// ທີ່ຢູ່ backend ຕົວດຽວສຳລັບທັງ app — ປ່ຽນໄດ້ຜ່ານ VITE_API_URL ໂດຍບໍ່ຕ້ອງແກ້ code
// ຕົວຢ່າງ: VITE_API_URL=https://api.example.com npm run build
// DEV: ໃຊ້ path ສຳພັນ (/api) + Vite proxy → ມືຖືເຂົ້າຜ່ານ IP ຂອງ PC ໄດ້ໂດຍບໍ່ຕ້ອງຕັ້ງຄ່າເພີ່ມ
export const API_ORIGIN = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:3000');
export const API_BASE_URL = `${API_ORIGIN}/api`;
