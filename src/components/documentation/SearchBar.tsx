import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentationService } from '../../services/documentationService';
import type { DocContent } from '../../types/documentation';
import debounce from 'lodash/debounce';

interface SearchBarProps {
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocContent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  const debouncedSearch = debounce(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const searchResults = await documentationService.searchDocs(searchQuery);
      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleResultClick = (slug: string) => {
    navigate(`/docs/${slug}`);
    setShowResults(false);
    setQuery('');
    setResults([]);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowResults(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={`search-container relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          onFocus={() => query && setShowResults(true)}
          placeholder="Search documentation..."
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-gray-500 dark:text-gray-400">
              {isSearching ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            results.map((doc) => (
              <button
                key={doc.slug}
                onClick={() => handleResultClick(doc.slug)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {doc.metadata.title}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {doc.metadata.description}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar; 