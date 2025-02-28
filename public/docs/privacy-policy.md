---
title: Privacy Policy
description: Privacy policy and data handling practices for SandBlox
author:  Particle CS Team
lastUpdated: 2024-03-15
tags: [privacy, data protection, security]
category: Security & Compliance
---

## Privacy Policy

### 1. Web3 Data Handling

```typescript
const web3DataPractices = {
  onChain: {
    public: ['Transaction data', 'Smart contract state', 'Wallet addresses'],
    indexed: ['Contract events', 'Transaction history'],
    searchable: true
  },
  offChain: {
    encrypted: ['User preferences', 'Application state'],
    temporary: ['Session data', 'Cache'],
    protected: true
  }
};
```

### 2. Data Collection & Usage

1. **Blockchain Data**
   - Public blockchain transactions
   - Smart contract interactions
   - Wallet addresses
   - Network metadata

2. **Application Data**
   ```typescript
   const dataCollection = {
     required: {
       technical: ['IP address', 'Device info', 'Network data'],
       functional: ['Account settings', 'Usage metrics']
     },
     optional: {
       preferences: ['UI settings', 'Notification preferences'],
       development: ['Error reports', 'Performance data']
     }
   };
   ```

### 3. Security Measures

```typescript
const securityProtocols = {
  encryption: {
    standards: ['AES-256', 'RSA-2048'],
    implementation: 'Industry best practices'
  },
  access: {
    controls: 'Role-based',
    authentication: 'Multi-factor',
    monitoring: '24/7 automated'
  }
};
```

### 4. Open Source Considerations

1. **Transparency**
   - Code is publicly auditable
   - Security measures are documented
   - Community review encouraged

2. **Data Minimization**
   - Only essential data collected
   - Automatic data pruning
   - User control over data

### 5. User Rights & Controls

```typescript
const userRights = {
  access: 'View collected data',
  modify: 'Update personal information',
  delete: 'Remove non-blockchain data',
  export: 'Download personal data',
  restrict: 'Limit data processing'
};
```

### 6. Third-Party Interactions

1. **Service Providers**
   - Security auditors
   - Infrastructure providers
   - Analytics services

2. **Data Sharing**
   ```typescript
   const dataSharing = {
     required: ['Legal compliance', 'Service provision'],
     optional: ['Analytics', 'Improvement'],
     prohibited: ['Data selling', 'Unauthorized sharing']
   };
   ```

### 7. Compliance Framework

```typescript
const complianceStandards = {
  global: ['GDPR', 'CCPA'],
  industry: ['ISO 27001', 'SOC 2'],
  blockchain: ['Chain-specific standards']
};
```

### 8. Updates & Notifications

- Policy changes will be announced
- User consent required for material changes
- 30-day notice for significant updates

## Contact Information

Privacy concerns:
- DPO: privacy@sandblox.org
- Support: support@sandblox.org 