// SPDX-License-Identifier: MPL-2.0
pragma solidity ^0.8.0;

import "../../../particle-core/contracts/ParticleAccountAbstraction.sol";

/**
 * @title BloxTemplate
 * @dev A template contract for creating new Blox implementations using Particle's Account Abstraction
 *
 * This template demonstrates how to extend the ParticleAccountAbstraction contract to create
 * secure blockchain applications with multi-phase security operations.
 */
contract BloxTemplate is ParticleAccountAbstraction {  
    /**
     * @notice Constructor to initialize the BloxTemplate contract
     * @param initialOwner The initial owner address
     * @param broadcaster The broadcaster address for meta-transactions
     * @param recovery The recovery address for emergency access
     * @param timeLockPeriodInMinutes The timelock period for security operations
     */
    constructor(
        address initialOwner,
        address broadcaster,
        address recovery,
        uint256 timeLockPeriodInMinutes
    ) ParticleAccountAbstraction(
        initialOwner,
        broadcaster,
        recovery,
        timeLockPeriodInMinutes
    ) {
        // Add your initialization logic here
    }
    
    // Add your implementation here
} 