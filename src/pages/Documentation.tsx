import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Sidebar as SidebarIcon, List, X } from 'lucide-react';
import Sidebar from '../components/documentation/Sidebar';
import DocContent from '../components/documentation/DocContent';
import SearchBar from '../components/documentation/SearchBar';
import TableOfContents from '../components/documentation/TableOfContents';
import type { TOCItem } from '../types/documentation';

const Documentation: React.FC = () => {
  const { slug } = useParams();
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Initialize isMobile after component mount
  useEffect(() => {
    const checkMobile = () => window.innerWidth < 768;
    setIsMobile(checkMobile());

    const handleResize = () => {
      setIsMobile(checkMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset state when slug changes
  useEffect(() => {
    setHeadings([]);
    setIsSidebarOpen(false);
    setIsTocOpen(false);
  }, [slug]);

  const breadcrumbs = [
    { label: 'Documentation', path: '/docs' },
    ...(slug ? [{ label: slug.replace(/-/g, ' '), path: `/docs/${slug}` }] : []),
  ];

  return (
    <div className="flex w-full min-h-screen text-start bg-white dark:bg-gray-900 relative">
      {/* Mobile Navigation Controls */}
      {isMobile && (
        <div className="fixed top-16 left-0 right-0 z-20 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Open sidebar"
              >
                <SidebarIcon className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-semibold">Documentation</h1>
            </div>
          </div>
          <div className="px-4 pb-4">
            <SearchBar />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar className="w-64 h-[calc(100vh-4rem)] sticky top-16" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 top-16 bg-black bg-opacity-50 z-30" 
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 h-[calc(100vh-4rem)] w-[280px] max-w-[80vw] bg-white dark:bg-gray-800" 
            onClick={e => e.stopPropagation()}
          >
            <Sidebar className="w-full h-full" onClose={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0 overflow-hidden" ref={contentRef}>
        <div className={`px-4 py-4 md:py-6 ${isMobile ? 'mt-[4.5rem]' : 'mt-2'}`}>
          <div className="max-w-7xl mx-auto">
            {/* Desktop Search */}
            {!isMobile && (
              <div className="mb-6">
                <SearchBar />
              </div>
            )}

            {/* Content Header */}
            <div className="flex items-center justify-between mb-4 mt-16">
              <nav>
                <ol className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.path}>
                      {index > 0 && <ChevronRight className="w-4 h-4" />}
                      <li>
                        <Link
                          to={crumb.path}
                          className="hover:text-gray-900 dark:hover:text-gray-200 capitalize"
                        >
                          {crumb.label}
                        </Link>
                      </li>
                    </React.Fragment>
                  ))}
                </ol>
              </nav>

              {headings.length > 0 && (
                <button
                  onClick={() => setIsTocOpen(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
                  aria-label="Show table of contents"
                >
                  <List className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Content and TOC */}
            <div className="flex gap-8">
              <div className="flex-1 min-w-0">
                <DocContent slug={slug} setHeadings={setHeadings} />
              </div>

              {headings.length > 0 && (
                <TableOfContents 
                  className="w-64 hidden lg:block sticky top-32" 
                  headings={headings} 
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile TOC */}
      {isTocOpen && headings.length > 0 && (
        <div 
          className="fixed inset-0 top-16 bg-black bg-opacity-50 z-30 lg:hidden" 
          onClick={() => setIsTocOpen(false)}
        >
          <div 
            className="absolute right-0 top-0 h-[calc(100vh-4rem)] w-[280px] max-w-[80vw] bg-white dark:bg-gray-800" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Contents</h2>
                <button
                  onClick={() => setIsTocOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <TableOfContents className="w-full" headings={headings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documentation; 