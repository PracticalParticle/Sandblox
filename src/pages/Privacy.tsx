import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Privacy() {
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch('/PRIVACY.md');
        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Error loading privacy policy:', error);
      }
    };

    fetchContent();
  }, []);

  return (
    <div className="container py-4">
      <article className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&>h1]:mb-2 [&>h2]:mb-2 [&>h2]:mt-3">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, href, children, ...props }) => {
              const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
              if (isExternal) {
                return (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }
              return <a href={href} {...props}>{children}</a>;
            },
            p: ({ children }) => (
              <p className="my-1">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="my-1 space-y-1">{children}</ul>
            ),
            li: ({ children }) => (
              <li className="my-0">{children}</li>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
} 