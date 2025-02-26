import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { documentationService } from '../../services/documentationService';
import type { DocContent as DocContentType, TOCItem } from '../../types/documentation';
import { CodeBlock } from './CodeBlock';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import '../../styles/mermaid.css';

interface DocContentProps {
  slug?: string;
  setHeadings: React.Dispatch<React.SetStateAction<TOCItem[]>>;
}

// Define the code component props interface
interface CodeComponentProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Update the mermaid initialization config
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  logLevel: 'error',
  flowchart: {
    htmlLabels: true,
    curve: 'linear',
    nodeSpacing: 80,
    rankSpacing: 80,
    padding: 0,
    useMaxWidth: true,
  }
});
  

// Update the MermaidDiagram component
const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        setRenderError(null);
        await mermaid.run({
          querySelector: '.mermaid',
          suppressErrors: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to render diagram';
        setRenderError(errorMessage);
        console.error('Mermaid rendering error:', error);
      }
    };

    const timer = setTimeout(renderDiagram, 100);
    return () => clearTimeout(timer);
  }, [code, isExpanded]);

  return (
    <div className={`mermaid-wrapper ${isExpanded ? 'expanded' : ''}`}>
      <div className="relative w-full">
        {renderError ? (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            Failed to render diagram: {renderError}
          </div>
        ) : (
          <div className="mermaid mb-0 pb-0">{code}</div>
        )}
        <button
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse diagram' : 'Expand diagram'}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  );
};
  

const DocContentComponent: React.FC<DocContentProps> = ({ slug, setHeadings }) => {
  const [doc, setDoc] = useState<DocContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!slug) {
          setDoc(null);
          return;
        }
        const docContent = await documentationService.getDocContent(slug);
        setDoc(docContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [slug]);

  useEffect(() => {
    if (doc) {
      const articleHeadings = Array.from(document.querySelectorAll('article h2, article h3'))
        .map((element) => ({
          id: element.id,
          text: element.textContent || '',
          level: Number(element.tagName.charAt(1)),
        }))
        .filter(heading => heading.id);
      setHeadings(articleHeadings);
    }
  }, [doc, setHeadings]);

  useEffect(() => {
    if (doc) {
      setTimeout(async () => {
        try {
          mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 'error',
            flowchart: {
              htmlLabels: true,
              curve: 'linear',
              nodeSpacing: 80,
              rankSpacing: 80,
              padding: 20,
              useMaxWidth: false,
            },
            themeVariables: {
              fontSize: '16px',
              nodeTextColor: 'currentColor',
              mainBkg: 'transparent',
              nodeBorder: '#6366f1',
              clusterBkg: 'transparent',
              clusterBorder: '#6366f1',
              lineColor: '#6366f1',
            }
          });
          await mermaid.run({
            querySelector: '.mermaid',
          });
        } catch (error) {
          console.error('Mermaid initialization error:', error);
        }
      }, 100);
    }
  }, [doc]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <article className="prose prose-lg dark:prose-invert max-w-none">
        <h1>Welcome to Particle Documentation</h1>
        <p>Select a topic from the sidebar to get started.</p>
        <h2>Getting Started</h2>
        <p>
          This documentation provides comprehensive guides and references for using our platform.
          Explore the topics on the left to find detailed information on various features and functionalities.
        </p>
        <h2>Need Help?</h2>
        <p>
          If you have any questions, feel free to reach out to our support team or check our FAQ section.
        </p>
      </article>
    );
  }

  return (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <div className="mb-8">
        <h1 className="mb-2 ">{doc.metadata.title}</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span>By {doc.metadata.author}</span>
          <span className="mx-2">•</span>
          <span>Last updated: {new Date(doc.metadata.lastUpdated).toLocaleDateString()}</span>
        </div>
        <div className="mt-2 flex gap-2">
          {doc.metadata.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex gap-8">
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const id = children ? children.toString().toLowerCase().replace(/\s+/g, '-') : '';
                return <h2 id={id} className="my-4">{children || ''}</h2>;
              },
              h3: ({ children }) => {
                const id = children ? children.toString().toLowerCase().replace(/\s+/g, '-') : '';
                return <h3 id={id} className="my-3">{children || ''}</h3>;
              },
              pre: ({ children }) => <div className="not-prose max-w-full overflow-x-auto">{children}</div>,
              code: function CodeComponent({ inline, className, children }: CodeComponentProps) {
                const match = /language-(\w+)/.exec(className || '');
                const code = String(children).replace(/\n$/, '');

                if (!inline && match) {
                  if (match[1] === 'mermaid') {
                    return <MermaidDiagram code={code} />;
                  }
                  return <CodeBlock language={match[1]} code={code} />;
                }
                return <code className={className}>{children}</code>;
              }
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
};

export default DocContentComponent; 