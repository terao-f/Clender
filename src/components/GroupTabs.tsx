import { Link, useLocation } from 'react-router-dom';
import { Users } from 'lucide-react';

export default function GroupTabs() {
  const location = useLocation();
  const isBusinessActive = location.pathname.includes('/groups/business') || location.pathname === '/groups';

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        <Link
          to="/groups/business"
          className={`
            group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
            ${isBusinessActive
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
          `}
        >
          <Users className={`
            -ml-0.5 mr-2 h-5 w-5
            ${isBusinessActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
          `} />
          業務グループ
        </Link>
      </nav>
    </div>
  );
}