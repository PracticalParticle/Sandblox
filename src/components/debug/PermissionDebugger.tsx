import React from 'react';
import { Address } from 'viem';
import { TxRecord } from '@/Guardian/sdk/typescript';
import { useTransactionPermissions } from '@/hooks/useTransactionPermissions';
import { SecureOwnable } from '@/Guardian/sdk/typescript/contracts/SecureOwnable';
import { DynamicRBAC } from '@/Guardian/sdk/typescript/contracts/DynamicRBAC';
import { Definitions } from '@/Guardian/sdk/typescript/lib/Definition';

interface PermissionDebuggerProps {
  transaction: TxRecord;
  connectedAddress: Address;
  contractAddress: Address;
  secureOwnable?: SecureOwnable;
  dynamicRBAC?: DynamicRBAC;
  definitions?: Definitions;
  timeLockPeriodInMinutes: number;
}

export function PermissionDebugger({
  transaction,
  connectedAddress,
  contractAddress,
  secureOwnable,
  dynamicRBAC,
  definitions,
  timeLockPeriodInMinutes,
}: PermissionDebuggerProps) {
  const permissions = useTransactionPermissions({
    transaction,
    connectedAddress,
    contractAddress,
    secureOwnable,
    dynamicRBAC,
    definitions,
    timeLockPeriodInMinutes,
  });

  const now = Math.floor(Date.now() / 1000);
  const releaseTime = Number(transaction.releaseTime);
  const timeDiff = now - releaseTime;

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="font-semibold mb-2">Permission Debug Information</h3>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>Wallet Information:</strong>
            <div>Connected Address: {connectedAddress}</div>
            <div>Contract Address: {contractAddress}</div>
            <div>Has SecureOwnable: {secureOwnable ? 'Yes' : 'No'}</div>
            <div>Has DynamicRBAC: {dynamicRBAC ? 'Yes' : 'No'}</div>
            <div>Has Definitions: {definitions ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <strong>Time Information:</strong>
            <div>Current Time: {now}</div>
            <div>Release Time: {releaseTime}</div>
            <div>Time Difference: {timeDiff} seconds</div>
            <div>Is Time Delay Expired: {permissions.isTimeDelayExpired ? 'Yes' : 'No'}</div>
          </div>
          
          <div>
            <strong>Transaction Info:</strong>
            <div>Status: {transaction.status}</div>
            <div>Message: {transaction.message ? `${transaction.message.substring(0, 20)}...` : 'None'}</div>
            <div>Message Length: {transaction.message?.length || 0}</div>
          </div>
        </div>
        
        <div>
          <strong>Granular Permissions:</strong>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span>Time Delay Approve:</span>
              <span className={permissions.canApprove ? 'text-green-600' : 'text-red-600'}>
                {permissions.canApprove ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>Time Delay Cancel:</span>
              <span className={permissions.canCancel ? 'text-green-600' : 'text-red-600'}>
                {permissions.canCancel ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>MetaTx Sign:</span>
              <span className={permissions.canSignMetaTx ? 'text-green-600' : 'text-red-600'}>
                {permissions.canSignMetaTx ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>MetaTx Execute:</span>
              <span className={permissions.canExecuteMetaTx ? 'text-green-600' : 'text-red-600'}>
                {permissions.canExecuteMetaTx ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>MetaTx Broadcast:</span>
              <span className={permissions.canBroadcast ? 'text-green-600' : 'text-red-600'}>
                {permissions.canBroadcast ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>Time Delay Expired:</span>
              <span className={permissions.isTimeDelayExpired ? 'text-green-600' : 'text-yellow-600'}>
                {permissions.isTimeDelayExpired ? '✅' : '⏳'}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <strong>User Roles & Permissions:</strong>
          <div className="mt-1">
            <div>Total Roles: {permissions.userRoles.length}</div>
            <div>Roles: {permissions.userRoles.length > 0 ? permissions.userRoles.join(', ') : 'None'}</div>
            <div>Allowed Actions: {permissions.allowedActions.length > 0 ? permissions.allowedActions.join(', ') : 'None'}</div>
            {permissions.roleDetails && permissions.roleDetails.length > 0 && (
              <div className="mt-2">
                <strong>Role Details:</strong>
                {permissions.roleDetails.map((role, index) => (
                  <div key={index} className="ml-2 text-xs">
                    <div>Hash: {role.roleHash}</div>
                    <div>Name: {role.roleName}</div>
                    <div>Protected: {role.isProtected ? 'Yes' : 'No'}</div>
                    {role.authorizedWallets.length > 0 && (
                      <div>Wallets: {role.authorizedWallets.length}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        
        {permissions.permissionErrors.length > 0 && (
          <div>
            <strong>Errors:</strong>
            <div className="text-red-600">
              {permissions.permissionErrors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
