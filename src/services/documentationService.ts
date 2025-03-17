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
  private baseUrl: string;

  constructor() {
    // In production, we'll use the public docs directory
    this.baseUrl = import.meta.env.PROD 
      ? '/docs'  // This will be the public URL path where docs are served
      : '/docs';  // Local development path
  }

  async getDocContent(slug: string): Promise<DocContent> {
    try {
      // Try to fetch from the docs directory
      const response = await fetch(`${this.baseUrl}/${slug}.md`);
      
      if (!response.ok) {
        throw new Error(`Documentation not found for slug: ${slug}`);
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

  async searchDocs(query: string): Promise<DocContent[]> {
    try {
      // Fetch all docs and perform client-side search
      const allDocs = await this.getAllDocs();
      const searchQuery = query.toLowerCase();
      
      return allDocs.filter(doc => 
        doc.metadata.title.toLowerCase().includes(searchQuery) ||
        doc.metadata.description.toLowerCase().includes(searchQuery) ||
        doc.content.toLowerCase().includes(searchQuery)
      );
    } catch (error) {
      console.error('Error searching docs:', error);
      throw error;
    }
  }

  async getAllDocs(): Promise<DocContent[]> {
    try {
      // Get the list of documentation files from the public directory
      const docFiles = [
        'introduction',
        'getting-started',
        'quick-start',
        'core-concepts',
        'blox-development',
        'blox-library',
        'security-guidelines',
        'account-abstraction',
        'particle-account-abstraction',
        'secure-operations',
        'troubleshooting',
        'faq',
        'reporting-issues',
        'best-practices'
      ];

      console.log(`[DocumentationService] Fetching ${docFiles.length} documentation files`);

      const docs = await Promise.all(
        docFiles.map(async (slug) => {
          try {
            const doc = await this.getDocContent(slug);
            console.log(`[DocumentationService] Successfully loaded: ${slug}`);
            return doc;
          } catch (error) {
            console.error(`[DocumentationService] Error loading doc ${slug}:`, error);
            return null;
          }
        })
      );

      const validDocs = docs.filter((doc): doc is DocContent => doc !== null);
      console.log(`[DocumentationService] Successfully loaded ${validDocs.length} of ${docFiles.length} docs`);

      return validDocs;
    } catch (error) {
      console.error('[DocumentationService] Error fetching all docs:', error);
      throw error;
    }
  }

  private extractFrontmatter(content: string): DocMetadata {
    try {
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);
      
      if (!match) {
        console.warn('[DocumentationService] No frontmatter found, using default metadata');
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
    } catch (error) {
      console.error('[DocumentationService] Error extracting frontmatter:', error);
      return this.getDefaultMetadata();
    }
  }

  private getDefaultMetadata(): DocMetadata {
    return {
      title: 'Untitled',
      description: '',
      author: 'Particle Team',
      lastUpdated: new Date().toISOString(),
      tags: [],
      category: 'Uncategorized'
    };
  }

  private removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }
}

export const documentationService = new DocumentationService(); 
