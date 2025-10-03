import * as React from 'react';
import { Address, Hex } from 'viem';
import { TxRecord, TxAction } from '@/Guardian/sdk/typescript';
import { SecureOwnable } from '@/Guardian/sdk/typescript/contracts/SecureOwnable';
import { DynamicRBAC } from '@/Guardian/sdk/typescript/contracts/DynamicRBAC';
import { Definitions } from '@/Guardian/sdk/typescript/lib/Definition';
import { FUNCTION_SELECTORS } from '@/Guardian/sdk/typescript/types/lib.index';

export interface TransactionPermissionState {
  canApprove: boolean;
  canCancel: boolean;
  canBroadcast: boolean;
  canSignMetaTx: boolean;
  canExecuteMetaTx: boolean;
  requiresTimeDelay: boolean;
  isTimeDelayExpired: boolean;
  allowedActions: TxAction[];
  userRoles: Hex[];
  permissionErrors: string[];
  roleDetails: Array<{
    roleHash: string;
    roleName: string;
    authorizedWallets: string[];
    isProtected: boolean;
  }>;
}

export interface UseTransactionPermissionsProps {
  transaction: TxRecord;
  connectedAddress?: Address;
  contractAddress: Address;
  secureOwnable?: SecureOwnable;
  dynamicRBAC?: DynamicRBAC;
  definitions?: Definitions;
  timeLockPeriodInMinutes: number;
}

export function useTransactionPermissions({
  transaction,
  connectedAddress,
  contractAddress,
  secureOwnable,
  dynamicRBAC,
  definitions,
  timeLockPeriodInMinutes
}: UseTransactionPermissionsProps): TransactionPermissionState {
  
  // Debug logging for SDK instances
  console.log('🔍 useTransactionPermissions received SDK instances:', {
    connectedAddress,
    contractAddress,
    secureOwnable: !!secureOwnable,
    dynamicRBAC: !!dynamicRBAC,
    definitions: !!definitions,
    secureOwnableType: secureOwnable?.constructor.name,
    dynamicRBACType: dynamicRBAC?.constructor.name,
    definitionsType: definitions?.constructor.name,
    timeLockPeriodInMinutes
  });
  
  const [permissionState, setPermissionState] = React.useState<TransactionPermissionState>({
    canApprove: false,
    canCancel: false,
    canBroadcast: false,
    canSignMetaTx: false,
    canExecuteMetaTx: false,
    requiresTimeDelay: false,
    isTimeDelayExpired: false,
    allowedActions: [],
    userRoles: [],
    permissionErrors: [],
    roleDetails: []
  });

  React.useEffect(() => {
    const checkPermissions = async () => {
      const state: TransactionPermissionState = {
        canApprove: false,
        canCancel: false,
        canBroadcast: false,
        canSignMetaTx: false,
        canExecuteMetaTx: false,
        requiresTimeDelay: false,
        isTimeDelayExpired: false,
        allowedActions: [],
        userRoles: [],
        permissionErrors: [],
        roleDetails: []
      };

      if (!connectedAddress) {
        state.permissionErrors.push('No connected address');
        setPermissionState(state);
        return;
      }

      if (!secureOwnable) {
        state.permissionErrors.push('No SecureOwnable contract instance');
        console.log('❌ No SecureOwnable contract instance - cannot check permissions');
        setPermissionState(state);
        return;
      }

      try {
        // Check if time delay has expired
        const now = Math.floor(Date.now() / 1000);
        const releaseTime = Number(transaction.releaseTime);
        state.isTimeDelayExpired = now >= releaseTime;
        state.requiresTimeDelay = !state.isTimeDelayExpired;
        
        console.log('Time delay check:', {
          now,
          releaseTime,
          isTimeDelayExpired: state.isTimeDelayExpired,
          timeDiff: now - releaseTime,
          nowDate: new Date(now * 1000).toLocaleString(),
          releaseDate: new Date(releaseTime * 1000).toLocaleString()
        });

        // Use SDK to check permissions instead of manual role checking
        await checkPermissionsUsingSDK(state, transaction, connectedAddress, secureOwnable, dynamicRBAC);

        console.log('State after permission checks:', {
          canApprove: state.canApprove,
          canCancel: state.canCancel,
          canBroadcast: state.canBroadcast,
          canSignMetaTx: state.canSignMetaTx,
          canExecuteMetaTx: state.canExecuteMetaTx
        });

      } catch (error) {
        state.permissionErrors.push(`Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log('Final permission state:', state);
      console.log('Setting permission state with:', {
        canApprove: state.canApprove,
        canCancel: state.canCancel,
        canBroadcast: state.canBroadcast,
        canSignMetaTx: state.canSignMetaTx,
        canExecuteMetaTx: state.canExecuteMetaTx,
        isTimeDelayExpired: state.isTimeDelayExpired,
        allowedActions: state.allowedActions,
        userRoles: state.userRoles,
        permissionErrors: state.permissionErrors
      });
      setPermissionState(state);
    };

    checkPermissions();
  }, [transaction, connectedAddress, contractAddress, secureOwnable, dynamicRBAC, definitions, timeLockPeriodInMinutes]);

  // Log when permission state changes
  React.useEffect(() => {
    console.log('Permission state changed:', permissionState);
  }, [permissionState]);

  console.log('Returning permission state:', permissionState);
  return permissionState;
}

async function checkPermissionsUsingSDK(
  state: TransactionPermissionState,
  transaction: TxRecord,
  connectedAddress: Address,
  secureOwnable: SecureOwnable,
  dynamicRBAC?: DynamicRBAC
): Promise<void> {
  console.log('🔍 Checking permissions using SDK for:', connectedAddress);

  try {
    // Get user roles using SDK (this uses wallet client for view permissions)
    if (dynamicRBAC) {
      try {
        console.log('🔍 Starting role checking with DynamicRBAC...');
        console.log('🔍 DynamicRBAC instance:', !!dynamicRBAC);
        console.log('🔍 Connected address:', connectedAddress);
        
        // Test basic SDK functionality first
        try {
          console.log('🔍 Testing basic SDK functionality...');
          const isInitialized = await dynamicRBAC.initialized();
          console.log('🔍 Contract initialized:', isInitialized);
        } catch (testError) {
          console.warn('⚠️ Basic SDK test failed:', testError);
        }
        
        // Try to get all roles using multiple methods
        let supportedRoles: Hex[] = [];
        try {
          console.log('🔍 Trying getSupportedRoles()...');
          // First try getSupportedRoles
          supportedRoles = await dynamicRBAC.getSupportedRoles();
          console.log('✅ getSupportedRoles() succeeded');
          console.log('📋 Supported roles:', supportedRoles);
          console.log('📋 Supported roles count:', supportedRoles.length);
        } catch (supportedRolesError) {
          console.warn('❌ getSupportedRoles() failed:', supportedRolesError);
          console.warn('⚠️ Trying getAllRoles() as fallback...');
          
          try {
            // Try getAllRoles as fallback
            supportedRoles = await dynamicRBAC.getAllRoles();
            console.log('✅ getAllRoles() succeeded');
            console.log('📋 All roles (getAllRoles):', supportedRoles);
            console.log('📋 All roles count:', supportedRoles.length);
          } catch (allRolesError) {
            console.warn('❌ getAllRoles() also failed:', allRolesError);
            console.warn('⚠️ Trying getDynamicRoles() as final fallback...');
            
            try {
              // Try getDynamicRoles as final fallback
              supportedRoles = await dynamicRBAC.getDynamicRoles();
              console.log('✅ getDynamicRoles() succeeded');
              console.log('📋 Dynamic roles (getDynamicRoles):', supportedRoles);
              console.log('📋 Dynamic roles count:', supportedRoles.length);
            } catch (dynamicRolesError) {
              console.warn('❌ getDynamicRoles() also failed:', dynamicRolesError);
              console.warn('⚠️ All role retrieval methods failed, continuing with empty array');
              // If all fail, we'll continue with empty roles array
              supportedRoles = [];
            }
          }
        }
        
        console.log('🔍 Final supported roles array:', supportedRoles);
        console.log('🔍 Final supported roles count:', supportedRoles.length);
        
        // Get role information for each role the user has
        const roleDetails: Array<{
          roleHash: string;
          roleName: string;
          authorizedWallets: string[];
          isProtected: boolean;
        }> = [];
        
        // Add core SecureOwnable roles (owner, recovery, broadcaster)
        const owner = await secureOwnable.owner();
        const broadcaster = await secureOwnable.getBroadcaster();
        const recovery = await secureOwnable.getRecovery();
        
        // Add core roles to role details
        if (connectedAddress.toLowerCase() === owner.toLowerCase()) {
          roleDetails.push({
            roleHash: 'OWNER_ROLE',
            roleName: 'OWNER',
            authorizedWallets: [owner],
            isProtected: true
          });
          state.userRoles.push('OWNER_ROLE' as Hex);
        }
        
        if (connectedAddress.toLowerCase() === broadcaster.toLowerCase()) {
          roleDetails.push({
            roleHash: 'BROADCASTER_ROLE',
            roleName: 'BROADCASTER',
            authorizedWallets: [broadcaster],
            isProtected: true
          });
          state.userRoles.push('BROADCASTER_ROLE' as Hex);
        }
        
        if (connectedAddress.toLowerCase() === recovery.toLowerCase()) {
          roleDetails.push({
            roleHash: 'RECOVERY_ROLE',
            roleName: 'RECOVERY',
            authorizedWallets: [recovery],
            isProtected: true
          });
          state.userRoles.push('RECOVERY_ROLE' as Hex);
        }
        
        console.log('🔍 Core roles added:', {
          owner: connectedAddress.toLowerCase() === owner.toLowerCase(),
          broadcaster: connectedAddress.toLowerCase() === broadcaster.toLowerCase(),
          recovery: connectedAddress.toLowerCase() === recovery.toLowerCase()
        });
        
        console.log('🔍 Checking each role for user:', connectedAddress);
        console.log('🔍 Total roles to check:', supportedRoles.length);
        
        for (const roleHash of supportedRoles) {
          console.log(`🔍 Checking role ${roleHash} for user ${connectedAddress}`);
          let hasRole = false;
          try {
            hasRole = await dynamicRBAC.hasRole(roleHash, connectedAddress);
            console.log(`👤 User ${connectedAddress} has role ${roleHash}:`, hasRole);
          } catch (hasRoleError) {
            console.warn(`⚠️ Error checking hasRole for ${roleHash}:`, hasRoleError);
            continue; // Skip this role if we can't check it
          }
          
          if (hasRole) {
            state.userRoles.push(roleHash);
            console.log(`✅ Added role ${roleHash} to user roles`);
            
            // Get basic role information using SDK (simplified approach)
            try {
              console.log(`🔍 Getting basic role info for ${roleHash}...`);
              
              let roleInfo;
              let authorizedWallets: string[] = [];
              
              try {
                console.log(`🔍 Trying getRole for ${roleHash}...`);
                // Use getRole method first (more reliable)
                roleInfo = await dynamicRBAC.getRole(roleHash);
                console.log(`✅ getRole succeeded for ${roleHash}`);
                console.log(`📝 Basic role info for ${roleHash}:`, roleInfo);
                console.log(`📝 Role info type:`, typeof roleInfo);
                console.log(`📝 Role info keys:`, Object.keys(roleInfo || {}));
                
                // Try to get authorized wallets separately
                try {
                  const wallets = await dynamicRBAC.getWalletsInRole(roleHash);
                  authorizedWallets = wallets.map(w => w.toString());
                  console.log(`👥 Authorized wallets for ${roleHash}:`, authorizedWallets);
                } catch (walletsError) {
                  console.warn(`⚠️ Could not get authorized wallets for ${roleHash}:`, walletsError);
                  authorizedWallets = [];
                }
              } catch (roleError) {
                console.warn(`❌ getRole failed for ${roleHash}:`, roleError);
                console.log(`🔄 Trying getRoleInfo as fallback for ${roleHash}...`);
                
                try {
                  // Fallback to getRoleInfo method
                  roleInfo = await dynamicRBAC.getRoleInfo(roleHash);
                  console.log(`✅ getRoleInfo fallback succeeded for ${roleHash}`);
                  console.log(`📝 Comprehensive role info for ${roleHash}:`, roleInfo);
                  
                  // Extract authorized wallets from the comprehensive role info
                  if (roleInfo && typeof roleInfo === 'object' && 'authorizedWallets' in roleInfo) {
                    authorizedWallets = (roleInfo as any).authorizedWallets || [];
                    console.log(`👥 Authorized wallets for ${roleHash}:`, authorizedWallets);
                  }
                } catch (roleInfoError) {
                  console.warn(`❌ getRoleInfo fallback also failed for ${roleHash}:`, roleInfoError);
                  // Create a basic role info object
                  roleInfo = {
                    roleName: 'Unknown Role',
                    isProtected: false
                  };
                }
              }
              
              // Extract role name from SDK response
              let roleName = 'Unknown Role';
              if (roleInfo) {
                if (typeof roleInfo === 'string') {
                  roleName = roleInfo;
                } else if (roleInfo && typeof roleInfo === 'object' && 'roleName' in roleInfo) {
                  roleName = roleInfo.roleName;
                  console.log(`📝 Found roleName in roleInfo: "${roleName}"`);
                } else if (roleInfo && typeof roleInfo === 'object' && 'name' in roleInfo) {
                  roleName = (roleInfo as any).name;
                  console.log(`📝 Found name in roleInfo: "${roleName}"`);
                } else if (roleInfo && typeof roleInfo === 'object' && 'role' in roleInfo) {
                  roleName = (roleInfo as any).role;
                  console.log(`📝 Found role in roleInfo: "${roleName}"`);
                } else {
                  // Use role hash mappings for common roles
                  const roleMappings: { [key: string]: string } = {
                    '0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e': 'ADMIN_ROLE',
                    '0x4a20cc833c13f0b7e71c8c74810a8f97737829513da1fbb806c0d9d370cf497e': 'MANAGER_ROLE',
                    '0x0acf805600123ef007091da3b3ffb39474074c656c127aa68cb0ffec232a8ff8': 'OPERATOR_ROLE'
                  };
                  roleName = roleMappings[roleHash] || `Role_${roleHash.slice(2, 8)}`;
                  console.log(`📝 Using role mapping for ${roleHash}: "${roleName}"`);
                }
              }
              
              console.log(`📝 Extracted role name: "${roleName}"`);
              
              roleDetails.push({
                roleHash,
                roleName,
                authorizedWallets: authorizedWallets.map(wallet => wallet.toString()),
                isProtected: roleInfo.isProtected || false
              });
              console.log(`🔍 Role details for ${roleHash}:`, {
                name: roleName,
                authorizedWallets,
                isProtected: roleInfo.isProtected
              });
            } catch (roleInfoError) {
              console.warn(`⚠️ Failed to get role info for ${roleHash}:`, roleInfoError);
              // Add role with basic info if we can't get full details
              roleDetails.push({
                roleHash,
                roleName: 'Unknown Role',
                authorizedWallets: [],
                isProtected: false
              });
            }
          } else {
            console.log(`❌ User does not have role ${roleHash}`);
          }
        }
        
        console.log('👥 User roles found:', state.userRoles);
        console.log('📝 Role details:', roleDetails);
        console.log('📊 Role details count:', roleDetails.length);
        
        // Store role details in state for display
        state.roleDetails = roleDetails;
      } catch (roleError) {
        console.warn('⚠️ Failed to get user roles:', roleError);
        state.permissionErrors.push(`Failed to get user roles: ${roleError instanceof Error ? roleError.message : 'Unknown error'}`);
      }
    } else {
      console.log('⚠️ No DynamicRBAC instance provided');
      state.permissionErrors.push('No DynamicRBAC instance provided');
    }

    // Get basic contract info using SDK (this uses wallet client for view permissions)
    const owner = await secureOwnable.owner();
    const broadcaster = await secureOwnable.getBroadcaster();
    const isOwner = connectedAddress.toLowerCase() === owner.toLowerCase();
    const isBroadcaster = connectedAddress.toLowerCase() === broadcaster.toLowerCase();

    console.log('🏠 Basic permissions:', { 
      isOwner, 
      isBroadcaster, 
      owner, 
      broadcaster, 
      userRoles: state.userRoles 
    });

    // Check all permissions using SDK role-based system
    try {
      await checkTimeDelayPermissions(state, connectedAddress, secureOwnable, isOwner, dynamicRBAC);
      await checkMetaTransactionPermissions(state, connectedAddress, secureOwnable, isOwner, isBroadcaster, dynamicRBAC);
      await checkBroadcastPermissions(state, transaction, isBroadcaster);
    } catch (permissionError) {
      console.error('❌ Permission checking failed:', permissionError);
      state.permissionErrors.push(`Permission checking failed: ${permissionError instanceof Error ? permissionError.message : 'Unknown error'}`);
    }

    console.log('✅ Final permission state:', {
      canApprove: state.canApprove,
      canCancel: state.canCancel,
      canBroadcast: state.canBroadcast,
      canSignMetaTx: state.canSignMetaTx,
      canExecuteMetaTx: state.canExecuteMetaTx,
      allowedActions: state.allowedActions
    });

  } catch (error) {
    console.error('❌ SDK permission check failed:', error);
    state.permissionErrors.push(`SDK permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function checkTimeDelayPermissions(
  state: TransactionPermissionState,
  connectedAddress: Address,
  secureOwnable: SecureOwnable,
  isOwner: boolean,
  dynamicRBAC?: DynamicRBAC
): Promise<void> {
  console.log('⏰ Checking time delay permissions...');

  // Check approval permissions
  if (state.isTimeDelayExpired) {
    const canApprove = await checkSDKPermission(
      FUNCTION_SELECTORS.TX_DELAYED_APPROVAL as Hex,
      connectedAddress,
      secureOwnable,
      isOwner,
      dynamicRBAC
    );
    
    if (canApprove) {
      state.canApprove = true;
      state.allowedActions.push(TxAction.EXECUTE_TIME_DELAY_APPROVE);
      console.log('✅ User can approve time delay transaction');
    }
  }

  // Check cancellation permissions
  const canCancel = await checkSDKPermission(
    FUNCTION_SELECTORS.TX_CANCELLATION as Hex,
    connectedAddress,
    secureOwnable,
    isOwner,
    dynamicRBAC
  );

  if (canCancel) {
    state.canCancel = true;
    state.allowedActions.push(TxAction.EXECUTE_TIME_DELAY_CANCEL);
    console.log('✅ User can cancel time delay transaction');
  }
}

async function checkMetaTransactionPermissions(
  state: TransactionPermissionState,
  connectedAddress: Address,
  secureOwnable: SecureOwnable,
  isOwner: boolean,
  isBroadcaster: boolean,
  dynamicRBAC?: DynamicRBAC
): Promise<void> {
  console.log('🔐 Checking meta transaction permissions...');

  // Check if user can sign meta transactions
  const canSignMetaTx = await checkSDKPermission(
    FUNCTION_SELECTORS.META_TX_REQUEST_AND_APPROVE as Hex,
    connectedAddress,
    secureOwnable,
    isOwner || isBroadcaster,
    dynamicRBAC
  );

  if (canSignMetaTx) {
    state.canSignMetaTx = true;
    state.allowedActions.push(TxAction.SIGN_META_REQUEST_AND_APPROVE);
    state.allowedActions.push(TxAction.SIGN_META_APPROVE);
    state.allowedActions.push(TxAction.SIGN_META_CANCEL);
    console.log('✅ User can sign meta transactions');
  }

  // Check if user can execute meta transactions
  const canExecuteMetaTx = await checkSDKPermission(
    FUNCTION_SELECTORS.META_TX_APPROVAL as Hex,
    connectedAddress,
    secureOwnable,
    isOwner || isBroadcaster,
    dynamicRBAC
  );

  if (canExecuteMetaTx) {
    state.canExecuteMetaTx = true;
    state.allowedActions.push(TxAction.EXECUTE_META_APPROVE);
    console.log('✅ User can execute meta transactions');
  }
}

async function checkBroadcastPermissions(
  state: TransactionPermissionState,
  transaction: TxRecord,
  isBroadcaster: boolean
): Promise<void> {
  console.log('📡 Checking broadcast permissions...');

  // Check if user is broadcaster and has signed meta transaction
  if (isBroadcaster) {
    const hasMetaTxSignature = transaction.message && transaction.message !== '0x';
    console.log('📝 Meta transaction signature check:', { 
      hasMetaTxSignature, 
      messageLength: transaction.message?.length || 0 
    });
    
    if (hasMetaTxSignature) {
      state.canBroadcast = true;
      state.allowedActions.push(TxAction.EXECUTE_META_REQUEST_AND_APPROVE);
      console.log('✅ User can broadcast meta transaction');
    }
  }
}

async function checkSDKPermission(
  functionSelector: Hex,
  userAddress: Address,
  _secureOwnable: SecureOwnable,
  _hasBasicPermission: boolean,
  dynamicRBAC?: DynamicRBAC
): Promise<boolean> {
  console.log('🔍 Checking SDK permission:', { functionSelector, hasBasicPermission: _hasBasicPermission });
  
  try {
    // Debug function selector and predefined ones
    console.log('🔍 Function selector being checked:', functionSelector);
    console.log('🔍 Predefined function selectors:', {
      TX_DELAYED_APPROVAL: FUNCTION_SELECTORS.TX_DELAYED_APPROVAL,
      TX_CANCELLATION: FUNCTION_SELECTORS.TX_CANCELLATION,
      META_TX_REQUEST_AND_APPROVE: FUNCTION_SELECTORS.META_TX_REQUEST_AND_APPROVE,
      META_TX_APPROVAL: FUNCTION_SELECTORS.META_TX_APPROVAL
    });
    
    // Skip function support checking - go directly to role-based permissions

    // Check role-based permissions using DynamicRBAC only
    if (dynamicRBAC) {
      try {
        console.log('🔑 Checking role permissions for function:', functionSelector);
        
        // Try to get all roles using multiple methods
        let supportedRoles: Hex[] = [];
        try {
          // First try getSupportedRoles
          supportedRoles = await dynamicRBAC.getSupportedRoles();
          console.log('🔑 Supported roles for permission check:', supportedRoles);
        } catch (supportedRolesError) {
          console.warn('⚠️ getSupportedRoles() failed in permission check, trying getAllRoles:', supportedRolesError);
          
          try {
            // Try getAllRoles as fallback
            supportedRoles = await dynamicRBAC.getAllRoles();
            console.log('🔑 All roles for permission check:', supportedRoles);
          } catch (allRolesError) {
            console.warn('⚠️ getAllRoles() also failed in permission check, trying getDynamicRoles:', allRolesError);
            
            try {
              // Try getDynamicRoles as final fallback
              supportedRoles = await dynamicRBAC.getDynamicRoles();
              console.log('🔑 Dynamic roles for permission check:', supportedRoles);
            } catch (dynamicRolesError) {
              console.warn('⚠️ getDynamicRoles() also failed in permission check:', dynamicRolesError);
              // Continue with empty array
            }
          }
        }
        
        // Check if user has any roles for this function
        for (const roleHash of supportedRoles) {
          const hasRole = await dynamicRBAC.hasRole(roleHash, userAddress);
          if (hasRole) {
            console.log(`✅ User has role ${roleHash} - granting permission for ${functionSelector}`);
            return true; // If user has any role, grant permission (simplified approach)
          }
        }
      } catch (roleError) {
        console.warn('⚠️ Role-based permission check failed:', roleError);
      }
    }

    // No fallback - only use SDK data
    console.log('❌ No role-based permission found - user does not have required permissions');
    return false;
    
  } catch (error) {
    console.warn('❌ SDK permission check failed:', error);
    return false;
  }
}

