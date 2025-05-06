// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.8.2;

import "./GuardianSafe.sol";

/**
 * @title GuardianSafeFactory
 * @dev Factory contract for deploying GuardianSafe instances with secure initialization.
 * Follows the same pattern as other Blox factories while incorporating specific GuardianSafe requirements.
 */
contract GuardianSafeFactory {
    // Counter to track the total number of created GuardianSafe instances
    uint256 public safeCount;

    // Mapping to store GuardianSafe address -> bool (true if valid)
    mapping(address => bool) public isGuardianSafe;

    // Event to emit when a new GuardianSafe is created
    event GuardianSafeCreated(
        address indexed safeAddress,
        address indexed owner,
        address indexed safe
    );

    /**
     * @notice Creates a new instance of the GuardianSafe contract with secure ownership controls.
     * @param _safe The Safe contract address this guardian will manage
     * @param _owner The owner of the new GuardianSafe
     * @param _broadcaster The broadcaster address for secure operations
     * @param _recovery The recovery address for secure operations
     * @param _timeLockPeriodInMinutes The timelock period for secure operations (in minutes)
     */
    function createGuardianSafe(
        address _safe,
        address _owner,
        address _broadcaster,
        address _recovery,
        uint256 _timeLockPeriodInMinutes
    ) external {  
        // Deploy a new GuardianSafe instance with secure ownership parameters
        GuardianSafe guardianSafe = new GuardianSafe(
            _safe,
            _owner,
            _broadcaster,
            _recovery,
            _timeLockPeriodInMinutes
        );

        // Increment the counter
        safeCount++;

        // Mark the deployed GuardianSafe address as valid in the mapping
        isGuardianSafe[address(guardianSafe)] = true;

        // Emit an event for the newly created GuardianSafe
        emit GuardianSafeCreated(address(guardianSafe), _owner, _safe);
    }

    /**
     * @notice Checks if a given address corresponds to a valid GuardianSafe.
     * @param _guardianSafeAddress The address to check.
     * @return True if the address corresponds to a deployed GuardianSafe, false otherwise.
     */
    function checkGuardianSafe(address _guardianSafeAddress) external view returns (bool) {
        return isGuardianSafe[_guardianSafeAddress];
    }
} 