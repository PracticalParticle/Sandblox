import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentationService } from '../../services/documentationService';
import type { DocContent } from '../../types/documentation';
import debounce from 'lodash/debounce';

interface SearchBarProps {
  className?: string;
}

// Function to highlight matched text
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  if (searchTerms.length === 0) return text;
  
  // Create a regex pattern that matches any of the search terms
  const pattern = new RegExp(`(${searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  
  // Split the text by the pattern and create an array of text and highlighted spans
  const parts = text.split(pattern);
  
  if (parts.length <= 1) return text;
  
  const result: React.ReactNode[] = [];
  let i = 0;
  
  // Reconstruct the text with highlighted matches
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j];
    if (part === '') continue;
    
    // Every odd index is a match (after the split)
    if (j % 2 === 1) {
      result.push(
        <span key={i++} className="bg-yellow-200 dark:bg-yellow-800 text-black dark:text-white font-medium px-0.5 rounded">
          {part}
        </span>
      );
    } else {
      result.push(<span key={i++}>{part}</span>);
    }
  }
  
  return result;
};

// Function to extract a snippet of text around the match
const extractSnippet = (content: string, query: string, maxLength: number = 150): string => {
  if (!query.trim()) return content.substring(0, maxLength) + '...';
  
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  if (searchTerms.length === 0) return content.substring(0, maxLength) + '...';
  
  const lowerContent = content.toLowerCase();
  
  // Find all occurrences of search terms
  const matches: { term: string; index: number }[] = [];
  for (const term of searchTerms) {
    let index = lowerContent.indexOf(term);
    while (index !== -1) {
      matches.push({ term, index });
      index = lowerContent.indexOf(term, index + 1);
    }
  }
  
  // If no matches found, return the beginning of the content
  if (matches.length === 0) return content.substring(0, maxLength) + '...';
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);
  
  // Find the best match to center the snippet around
  // For multiple matches, try to find a section with multiple matches close together
  let bestMatchIndex = matches[0].index;
  let bestMatchDensity = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const currentIndex = matches[i].index;
    let matchesInRange = 0;
    
    // Count matches within a window of maxLength around the current match
    for (let j = 0; j < matches.length; j++) {
      if (Math.abs(matches[j].index - currentIndex) <= maxLength / 2) {
        matchesInRange++;
      }
    }
    
    if (matchesInRange > bestMatchDensity) {
      bestMatchDensity = matchesInRange;
      bestMatchIndex = currentIndex;
    }
  }
  
  // Calculate start and end positions for the snippet
  const snippetStart = Math.max(0, bestMatchIndex - maxLength / 3);
  const snippetEnd = Math.min(content.length, snippetStart + maxLength);
  
  // Add ellipsis if needed
  const prefix = snippetStart > 0 ? '...' : '';
  const suffix = snippetEnd < content.length ? '...' : '';
  
  return prefix + content.substring(snippetStart, snippetEnd) + suffix;
};

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
          aria-label="Search documentation"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-[70vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {results.length === 0 
                ? 'No results found' 
                : `${results.length} result${results.length === 1 ? '' : 's'} found`}
            </span>
            {results.length > 0 && (
              <button 
                onClick={() => setShowResults(false)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Close
              </button>
            )}
          </div>
          
          {results.length === 0 ? (
            <div className="p-4 text-gray-500 dark:text-gray-400 text-center">
              {isSearching ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent mb-2"></div>
                  <span>Searching...</span>
                </div>
              ) : (
                <div>
                  <p className="mb-2">No results found for "{query}"</p>
                  <p className="text-xs">Try using different keywords or check for typos</p>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((doc) => (
                <button
                  key={doc.slug}
                  onClick={() => handleResultClick(doc.slug)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 block transition-colors duration-150"
                >
                  <div className="flex items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                        {highlightMatch(doc.metadata.title, query)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {highlightMatch(doc.metadata.description, query)}
                      </div>
                      {/* Content snippet with highlighted matches */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 border-l-2 border-gray-300 dark:border-gray-600 pl-2 mt-1 line-clamp-3">
                        {highlightMatch(extractSnippet(doc.content, query), query)}
                      </div>
                    </div>
                    <div className="ml-2 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {doc.metadata.category}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.metadata.tags.slice(0, 3).map((tag, index) => (
                      <span 
                        key={index} 
                        className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {doc.metadata.tags.length > 3 && (
                      <span className="inline-block px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                        +{doc.metadata.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar; 