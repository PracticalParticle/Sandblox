---
title: Reporting Issues & Requesting Features
description: How to report bugs and request new features for SandBlox
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, support, Guardian AA]
category: Support
---

## Reporting Issues & Requesting Features

This guide explains how to effectively report issues and request new features for the SandBlox platform. Your feedback is essential for improving the platform and helping the community.

## Issue Reporting

### Before Reporting an Issue

Before submitting a new issue, please take the following steps:

1. **Check the Documentation**: Ensure you're following the recommended practices in our [documentation](/docs).
2. **Search Existing Issues**: Check if the issue has already been reported in our [GitHub Issues](https://github.com/particle-security/sandblox/issues).
3. **Check the Troubleshooting Guide**: Review our [Troubleshooting Guide](/docs/troubleshooting) for common solutions.
4. **Verify Your Environment**: Ensure you're using compatible versions of Node.js, npm/yarn, and other dependencies.
5. **Reproduce the Issue**: Try to reproduce the issue in a minimal environment to isolate the problem.

### How to Report an Issue

When you're ready to report an issue, please use our [GitHub Issues](https://github.com/particle-security/sandblox/issues) page and follow these guidelines:

1. **Use the Issue Template**: Select the appropriate issue template for your report.
2. **Provide a Clear Title**: Write a concise title that summarizes the issue.
3. **Describe the Issue**: Provide a detailed description of the problem, including:
   - What you were trying to do
   - What you expected to happen
   - What actually happened
   - Any error messages or logs
4. **Include Reproduction Steps**: List the exact steps to reproduce the issue.
5. **Provide Environment Information**:
   - SandBlox version
   - Node.js version
   - npm/yarn version
   - Operating system
   - Browser (if applicable)
   - Wallet provider (if applicable)
6. **Add Code Samples**: Include minimal code samples that demonstrate the issue.
7. **Attach Screenshots or Videos**: If applicable, include visual evidence of the issue.
8. **Tag the Issue**: Use appropriate labels to categorize the issue.

### Issue Reporting Example

Here's an example of a well-structured issue report:

```markdown
## Description
When attempting to deploy a SimpleVault contract using the CLI, the deployment fails with a gas estimation error.

## Steps to Reproduce
1. Create a new project using `sandblox init --template basic my-project`
2. Navigate to the project directory: `cd my-project`
3. Install dependencies: `npm install`
4. Run the deployment script: `npm run deploy:goerli`

## Expected Behavior
The SimpleVault contract should deploy successfully to the Goerli testnet.

## Actual Behavior
Deployment fails with the following error:
```
Error: Error during contract deployment: Gas estimation failed
at SimpleVaultDeployer.deploy (/my-project/scripts/deploy.js:25:10)
...
```

## Environment Information
- SandBlox version: 1.2.0
- Node.js version: 18.12.1
- npm version: 8.19.2
- Operating system: macOS 13.4
- Network: Goerli testnet

## Additional Information
I've verified that my account has sufficient ETH for deployment.
```

### Issue Lifecycle

Once you've submitted an issue, here's what happens next:

1. **Triage**: The SandBlox team will review and triage the issue.
2. **Prioritization**: Issues are prioritized based on severity, impact, and community needs.
3. **Assignment**: The issue will be assigned to a team member or community contributor.
4. **Resolution**: The assignee will work on resolving the issue.
5. **Review**: The solution will be reviewed by the team.
6. **Merge**: Once approved, the solution will be merged into the codebase.
7. **Release**: The fix will be included in the next release.
8. **Closure**: The issue will be closed once the fix is released.

## Feature Requests

### Before Requesting a Feature

Before submitting a new feature request, please take the following steps:

1. **Check the Roadmap**: Review our [public roadmap](https://github.com/particle-security/sandblox/projects/1) to see if the feature is already planned.
2. **Search Existing Requests**: Check if the feature has already been requested in our [GitHub Issues](https://github.com/particle-security/sandblox/issues).
3. **Consider Alternatives**: Explore if there are existing features or workarounds that could meet your needs.
4. **Gauge Community Interest**: Discuss your idea in our [Discord community](https://discord.gg/sandblox) to gather feedback.

### How to Request a Feature

When you're ready to request a feature, please use our [GitHub Issues](https://github.com/particle-security/sandblox/issues) page and follow these guidelines:

1. **Use the Feature Request Template**: Select the feature request template.
2. **Provide a Clear Title**: Write a concise title that summarizes the feature.
3. **Describe the Feature**: Provide a detailed description of the proposed feature, including:
   - What the feature should do
   - Why the feature is valuable
   - How the feature should work
   - Any alternatives you've considered
4. **Use Cases**: Describe specific use cases for the feature.
5. **Implementation Ideas**: If you have ideas about how to implement the feature, share them.
6. **Mockups or Diagrams**: If applicable, include visual representations of the feature.
7. **Tag the Request**: Use appropriate labels to categorize the request.

### Feature Request Example

Here's an example of a well-structured feature request:

```markdown
## Feature Description
Add support for batch transactions in the SimpleVault blox to allow users to execute multiple operations in a single transaction, reducing gas costs and improving UX.

## Use Cases
1. Users want to withdraw multiple tokens at once
2. Administrators need to update multiple configuration parameters
3. DeFi applications need to perform complex operations efficiently

## Why This Feature Is Valuable
- Reduces gas costs by batching multiple operations
- Improves user experience by reducing the number of wallet interactions
- Enables more complex workflows in applications built with SandBlox

## Proposed Implementation
The SimpleVault contract could be extended with a new `batchExecute` function that takes an array of operation data and executes them in sequence. Each operation would include:
- Operation type (withdraw, deposit, etc.)
- Target token address
- Amount
- Recipient address (if applicable)

## Mockup
Here's a simple mockup of how the UI might look:
[Attached mockup image]

## Alternatives Considered
I considered using separate transactions for each operation, but this increases gas costs and requires multiple user confirmations.
```

### Feature Request Lifecycle

Once you've submitted a feature request, here's what happens next:

1. **Triage**: The SandBlox team will review and triage the request.
2. **Community Feedback**: The request may be opened for community discussion and voting.
3. **Prioritization**: Features are prioritized based on community interest, strategic alignment, and implementation complexity.
4. **Roadmap Addition**: If approved, the feature will be added to the roadmap.
5. **Implementation**: The feature will be implemented by the team or community contributors.
6. **Review**: The implementation will be reviewed by the team.
7. **Merge**: Once approved, the implementation will be merged into the codebase.
8. **Release**: The feature will be included in the next release.
9. **Closure**: The feature request will be closed once the feature is released.

## Contributing to SandBlox

If you're interested in contributing to SandBlox by fixing issues or implementing features yourself, please refer to our [Contributing Guide](https://github.com/particle-security/sandblox/blob/main/CONTRIBUTING.md).

We welcome contributions from the community, including:

- Bug fixes
- Feature implementations
- Documentation improvements
- Test coverage enhancements
- Performance optimizations

## Security Vulnerabilities

If you discover a security vulnerability in SandBlox, please do **NOT** report it through public GitHub issues. Instead, please send an email to security@particle.security with details about the vulnerability.

We take security issues very seriously and will respond promptly to fix verified vulnerabilities. You can expect:

1. Acknowledgment of your report within 24 hours
2. Regular updates on our progress
3. Credit for your discovery (unless you prefer to remain anonymous)
4. A security advisory once the vulnerability is fixed

## Community Support

For general questions and discussions, please join our [Discord community](https://discord.gg/sandblox). This is a great place to:

- Ask questions about using SandBlox
- Share your projects built with SandBlox
- Connect with other developers
- Discuss ideas for improvements
- Get help with issues

## Contact Information

For other inquiries, you can reach us through:

- **Email**: support@prtcl.atlassian.net
- **X (Twitter)**: [@Particle_CS](https://twitter.com/Particle_CS)
- **Website**: [Particle CS](https://particlecs.com)

---

*Developed by Particle Crypto Security* 