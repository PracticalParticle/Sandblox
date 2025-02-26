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
      title: 'Introduction',
      items: [
        { title: 'Overview', path: '/docs/overview' },
        { title: 'Supported Blockchains', path: '/docs/supported-blockchains' },
      ],
    },
    {
      title: 'Getting Started',
      items: [
        { title: 'Development Environment', path: '/docs/development-environment' },
        { title: 'First Integration', path: '/docs/first-integration' },
        { title: 'Installing SDK Tools', path: '/docs/installing-sdk-tools' },
      ],
    },
    {
      title: 'Use Cases',
      items: [
        { title: 'Practical Applications', path: '/docs/practical-applications' },
        { title: 'Real-World Examples', path: '/docs/real-world-examples' },
        { title: 'Use Case Scenarios', path: '/docs/use-case-scenarios' },
      ],
    },
    {
      title: 'Core Components',
      items: [
        { title: 'Security Architecture', path: '/docs/api-reference-endpoints' },
        { title: 'Smart Contract and Deployment Management', path: '/docs/smart-contract-deployment-management' },
        { title: 'Secure Wallet and Transaction Handling', path: '/docs/secure-wallet-transaction-handling' },
       
      ],
    },
    {
      title: 'Developer Guide',
      items: [
        { title: 'Building Dapps', path: '/docs/building-dapps' },
        { title: 'Cross-Chain Interoperability', path: '/docs/cross-chain-interoperability' },
        { title: 'Implementing Blockchain Payments', path: '/docs/implementing-blockchain-payments' },
      ],
    },
    {
      title: 'Enterprise Solutions',
      items: [
        { title: 'Integrating Existing Systems', path: '/docs/integrating-existing-systems' },
        { title: 'Scalability-Performance', path: '/docs/scalability-performance' },
      ],
    },
    {
      title: 'Security & Compliance',
      items: [
        { title: 'Security Measures & Compliance', path: '/docs/security-measures-compliance' },
        { title: 'Privacy Policy', path: '/docs/privacy-policy' },
        { title: 'Terms of Use', path: '/docs/terms-of-use' },
      ],
    },
    {
      title: 'Troubleshooting & Support',
      items: [
      
        { title: 'Community Support', path: '/docs/community-support' },
        { title: 'Debugging & Error Handling', path: '/docs/debugging-error-handling' },
        { title: 'Reporting Issues & Requesting Features', path: '/docs/reporting-issues-requesting-features' },
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