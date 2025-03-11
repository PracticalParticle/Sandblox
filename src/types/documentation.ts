export interface DocMetadata {
  title: string;
  description: string;
  lastUpdated: string;
  author: string;
  tags: string[];
  version?: string;
  category: string;
}

export interface DocContent {
  metadata: DocMetadata;
  content: string;
  slug: string;
  isInSidebar?: boolean;
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
} 