import { DocContent, DocMetadata } from '../types/documentation';

interface FrontmatterMetadata {
  title: string;
  description: string;
  author: string;
  lastUpdated: string;
  tags: string[];
  category: string;
  version?: string;
  [key: string]: string | string[] | undefined;
}

class DocumentationService {
  private baseUrl = '/api/docs';
  private useMockData = import.meta.env.DEV;
  private mockDocs: DocContent[] | null = null;

  async getDocContent(slug: string): Promise<DocContent> {
    if (this.useMockData) {
      try {
        const response = await fetch(`/docs/${slug}.md`);
        if (!response.ok) {
          throw new Error('Documentation not found');
        }
        const content = await response.text();
        
        // Extract metadata from frontmatter
        const metadata = this.extractFrontmatter(content);
        
        return {
          slug,
          metadata,
          content: this.removeFrontmatter(content)
        };
      } catch (error) {
        console.error('Error loading documentation:', error);
        throw error;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/${slug}`);
      if (!response.ok) {
        throw new Error('Failed to fetch documentation');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching doc content:', error);
      throw error;
    }
  }

  async searchDocs(query: string): Promise<DocContent[]> {
    if (this.useMockData) {
      const allDocs = await this.getAllMockDocs();
      const searchTerms = query.toLowerCase().split(' ');
      
      return allDocs.filter(doc => {
        const searchableText = [
          doc.metadata.title,
          doc.metadata.description,
          ...doc.metadata.tags,
          doc.content
        ].join(' ').toLowerCase();

        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching docs:', error);
      throw error;
    }
  }

  async getAllDocs(): Promise<DocContent[]> {
 
    try {
      const response = await fetch(`${this.baseUrl}/all`);
      if (!response.ok) {
        throw new Error('Failed to fetch all documentation');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching all docs:', error);
      throw error;
    }
  }

  private extractFrontmatter(content: string): DocMetadata {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) {
      return this.getDefaultMetadata();
    }

    const frontmatter = match[1];
    const metadata: FrontmatterMetadata = {
      title: '',
      description: '',
      author: '',
      lastUpdated: new Date().toISOString(),
      tags: [],
      category: ''
    };
    
    frontmatter.split('\n').forEach(line => {
      const [key, ...values] = line.split(':');
      if (key && values.length) {
        const value = values.join(':').trim();
        if (key === 'tags') {
          metadata.tags = value.replace(/[[\]]/g, '').split(',').map(tag => tag.trim());
        } else {
          metadata[key.trim()] = value;
        }
      }
    });

    return metadata as DocMetadata;
  }

  private getDefaultMetadata(): DocMetadata {
    return {
      title: 'Untitled',
      description: '',
      author: 'Particle CS Team',
      lastUpdated: new Date().toISOString(),
      tags: [],
      category: 'Uncategorized'
    };
  }

  private removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  private async getAllMockDocs(): Promise<DocContent[]> {
    if (this.mockDocs) return this.mockDocs;

    // List of all documentation files
    const docFiles = [
      'overview',
      'supported-blockchains',
      'development-environment',
      'first-integration',
      'installing-sdk-tools',
      'practical-applications',
      'real-world-examples',
      'use-case-scenarios',
      // ... add other doc filenames here
    ];

    const docs = await Promise.all(
      docFiles.map(async (slug) => {
        try {
          const response = await fetch(`/docs/${slug}.md`);
          const content = await response.text();
          const metadata = this.extractFrontmatter(content);
          
          return {
            slug,
            metadata,
            content: this.removeFrontmatter(content)
          };
        } catch (error) {
          console.warn(`Failed to load doc: ${slug}`, error);
          return null;
        }
      })
    );

    this.mockDocs = docs.filter((doc): doc is DocContent => doc !== null);
    return this.mockDocs;
  }
}

export const documentationService = new DocumentationService(); 
