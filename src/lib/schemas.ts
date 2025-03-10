import { z } from 'zod';

// Updated to validate any number as chain ID since we now support dynamic chains
export const ChainIdSchema = z.number().int().positive();

export const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const NamespaceSchema = z.object({
  accounts: z.array(
    z.string().regex(/^eip155:\d+:0x[a-fA-F0-9]{40}$/, 'Invalid account format')
  ),
  chains: z.array(
    z.string().regex(/^eip155:\d+$/, 'Invalid chain format')
  ),
  methods: z.array(z.string()),
  events: z.array(z.string())
});

export const SessionSchema = z.object({
  topic: z.string(),
  namespaces: z.object({
    eip155: NamespaceSchema
  }),
  peer: z.object({
    metadata: z.object({
      name: z.string(),
      description: z.string().optional(),
      url: z.string().url(),
      icons: z.array(z.string().url())
    })
  })
});

export const WalletSessionSchema = z.object({
  topic: z.string(),
  account: EthereumAddressSchema,
  chainId: ChainIdSchema,
  peerMetadata: z.object({
    name: z.string(),
    url: z.string().url(),
    icons: z.array(z.string().url())
  }).optional(),
  lastActivity: z.number().int().positive()
});

export const TransactionRequestSchema = z.object({
  from: EthereumAddressSchema,
  to: EthereumAddressSchema,
  value: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex value').optional(),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex data').optional(),
  gas: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid gas value').optional(),
  gasPrice: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid gas price').optional(),
  maxFeePerGas: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid maxFeePerGas').optional(),
  maxPriorityFeePerGas: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid maxPriorityFeePerGas').optional(),
  nonce: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid nonce').optional()
});

// Type exports
export type ValidSession = z.infer<typeof SessionSchema>;
export type ValidWalletSession = z.infer<typeof WalletSessionSchema>;
export type ValidTransactionRequest = z.infer<typeof TransactionRequestSchema>;

// Validation functions
export function validateSession(session: unknown): ValidSession {
  return SessionSchema.parse(session);
}

export function validateWalletSession(session: unknown): ValidWalletSession {
  return WalletSessionSchema.parse(session);
}

export function validateTransactionRequest(request: unknown): ValidTransactionRequest {
  return TransactionRequestSchema.parse(request);
}

// Safe parsing functions that return null instead of throwing
export function safeParseSession(session: unknown): ValidSession | null {
  const result = SessionSchema.safeParse(session);
  return result.success ? result.data : null;
}

export function safeParseWalletSession(session: unknown): ValidWalletSession | null {
  const result = WalletSessionSchema.safeParse(session);
  return result.success ? result.data : null;
}

export function safeParseTransactionRequest(request: unknown): ValidTransactionRequest | null {
  const result = TransactionRequestSchema.safeParse(request);
  return result.success ? result.data : null;
} 