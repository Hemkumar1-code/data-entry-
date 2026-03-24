import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-[#0B1220] text-white">
      <Sidebar />
      <Outlet />
    </div>
  );
}
