import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();

  const navigation = [
    {
      title: 'Getting Started',
      items: [
        { title: 'Introduction', path: '/docs/introduction' },
        { title: 'Core Concepts', path: '/docs/core-concepts' },
        { title: 'Quick Start', path: '/docs/quick-start' },
      ],
    },
    {
      title: 'Blox Features',
      items: [
        { title: 'Particle Account Abstraction', path: '/docs/particle-account-abstraction' },
        { title: 'Secure Operation Patterns', path: '/docs/secure-operations' },
        { title: 'SandBlox Library', path: '/docs/blox-library' },
      ],
    },
    {
      title: 'Development Guide',
      items: [
        { title: 'Blox Development Guide', path: '/docs/blox-development' },
        { title: 'Best Practices', path: '/docs/best-practices' },
        { title: 'Security Guidelines', path: '/docs/security-guidelines' },
      ],
    },
    {
      title: 'Troubleshooting & Support',
      items: [
        { title: 'FAQ', path: '/docs/faq' },
        { title: 'Troubleshooting', path: '/docs/troubleshooting' },
        { title: 'Reporting Issues', path: '/docs/reporting-issues' },
      ],
    },
   
  ];

  return (
    <div className="h-full min-w-80 sticky top-16">
      <div className="h-full p-6 overflow-y-auto bg-white dark:bg-gray-900">
        {onClose && (
          <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Documentation</h2>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
        <nav>
          {navigation.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="text-sm font-semibold mb-2">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <Link
                      to={item.path}
                      className={`block px-2 py-1 text-sm rounded-md ${
                        location.pathname === item.path
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar; 