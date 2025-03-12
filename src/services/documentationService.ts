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
  private baseUrl = '/docs';

  async getDocContent(slug: string): Promise<DocContent> {
    try {
      const response = await fetch(`${this.baseUrl}/${slug}.md`);
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
      // This is a static list of all documentation files
      const docFiles = [
        'introduction',
        'getting-started',
        'security-architecture',
        'security-framework',
        'research-insights',
        'product-overview',
        'use-cases',
        'community-support',
        'faqs',
        'updates-releases',
        'glossary'
      ];

      const docs = await Promise.all(
        docFiles.map(async (slug) => {
          try {
            return await this.getDocContent(slug);
          } catch (error) {
            console.error(`Error loading doc ${slug}:`, error);
            return null;
          }
        })
      );

      return docs.filter((doc): doc is DocContent => doc !== null);
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
