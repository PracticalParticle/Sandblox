import React from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  React.useEffect(() => {
    Prism.highlightAll();
  }, [code]);

  return (
    <pre className="rounded-md">
      <code className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
}; 