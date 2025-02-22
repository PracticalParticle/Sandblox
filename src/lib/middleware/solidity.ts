import fs from 'fs';
import path from 'path';
import type { Connect } from 'vite';

export function createSolidityMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url?.startsWith('/contracts/')) {
      const filePath = path.join(process.cwd(), req.url);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'text/plain');
        res.end(content);
      } catch (error) {
        next(error);
      }
    } else {
      next();
    }
  };
} 