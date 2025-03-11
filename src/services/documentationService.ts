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
      
      // Filter out documents that aren't displayed in the sidebar
      const filteredDocs = allDocs.filter(doc => doc.isInSidebar);
      
      return filteredDocs.filter(doc => {
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

    // List of all documentation files that are displayed in the sidebar
    const sidebarDocFiles = [
      'introduction',
      'core-concepts',
      'quick-start',
      'blox-library',
      'blox-development',
      'particle-account-abstraction',
      'secure-operations',
      'security-guidelines',
      'best-practices',
      'faq',
      'troubleshooting',
      'reporting-issues'
    ];

    // Additional docs that exist but aren't displayed in the sidebar
    const additionalDocFiles = [
      'sandblox-summary',
      'account-abstraction',
      'index'
    ];

    // Combine all doc files for loading
    const allDocFiles = [...sidebarDocFiles, ...additionalDocFiles];

    const docs = await Promise.all(
      allDocFiles.map(async (slug) => {
        try {
          const response = await fetch(`/docs/${slug}.md`);
          if (!response.ok) {
            console.warn(`Failed to load doc: ${slug} - ${response.status} ${response.statusText}`);
            return null;
          }
          const content = await response.text();
          const metadata = this.extractFrontmatter(content);
          
          return {
            slug,
            metadata,
            content: this.removeFrontmatter(content),
            // Add a flag to indicate if this doc is displayed in the sidebar
            isInSidebar: sidebarDocFiles.includes(slug)
          };
        } catch (error) {
          console.warn(`Failed to load doc: ${slug}`, error);
          return null;
        }
      })
    );

    // Use a type assertion to ensure the filter works correctly
    this.mockDocs = docs.filter((doc): doc is NonNullable<typeof doc> => doc !== null);
    return this.mockDocs;
  }

  // Get only the docs that are displayed in the sidebar
  async getSidebarDocs(): Promise<DocContent[]> {
    const allDocs = await this.getAllMockDocs();
    return allDocs.filter(doc => doc.isInSidebar);
  }
}

export const documentationService = new DocumentationService(); 
