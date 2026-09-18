import { Search, Bell, HelpCircle, Plus } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-6">
      {/* Search Bar */}
      <div className="relative w-96">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search size={18} />
        </span>
        <input 
          type="text" 
          placeholder="ຄົ້ນຫາ ປີ້, ຜູ້ໃຊ້, ບົດຄວາມ..." 
          className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <Bell size={20} />
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">6</span>
        </button>
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <HelpCircle size={20} />
        </button>
        <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg font-medium text-sm transition">
          <Plus size={18} /> <span>ສ້າງໃໝ່</span>
        </button>
      </div>
    </header>
  );
}