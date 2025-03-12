# Open-Blox Documentation

This directory contains the markdown documentation files for the Open-Blox project. These files are served through the application and can be accessed via the `/docs/` routes.

## Organization

The documentation is organized into the following categories:

1. **Getting Started**
   - Introduction
   - Core Concepts
   - Quick Start

2. **Core Features**
   - Guardian Account Abstraction
   - Secure Operation Patterns
   - SandBlox Library

3. **Development Guides**
   - Blox Development Guide
   - Best Practices
   - Security Guidelines

4. **Support**
   - FAQ
   - Troubleshooting
   - Reporting Issues

## File Structure

Each documentation file is a Markdown file with YAML frontmatter for metadata. The frontmatter should include:

```yaml
---
title: Document Title
description: Brief description of the document
author: Author Name
lastUpdated: YYYY-MM-DD
tags: [tag1, tag2, tag3]
category: Category Name
---
```

## Contributing to Documentation

When adding or updating documentation:

1. Follow the existing file naming convention (kebab-case)
2. Include proper frontmatter with all required metadata
3. Use Markdown formatting consistently
4. Link to other documentation pages using relative paths (`/docs/page-name`)
5. Place any images in the appropriate assets directory

## Serving Documentation

These documentation files are served through the application. In development mode, they are accessed directly from this directory. In production, they are included in the build output. 