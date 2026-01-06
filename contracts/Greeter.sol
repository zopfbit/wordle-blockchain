// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Greeter - A simple learning contract
/// @notice This contract demonstrates basic Solidity concepts
contract Greeter {
    // State variable - stored on the blockchain
    string private greeting;

    // Counter to track how many times greeting was changed
    uint256 public greetingCount;

    // Owner of the contract
    address public owner;

    // Event - emitted when greeting changes (frontend can listen to this)
    event GreetingChanged(string oldGreeting, string newGreeting, address changedBy);

    /// @notice Constructor runs once when contract is deployed
    /// @param _greeting Initial greeting message
    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;  // msg.sender = whoever deployed the contract
        greetingCount = 0;
    }

    /// @notice Read the current greeting (view = doesn't cost gas)
    /// @return The current greeting string
    function greet() public view returns (string memory) {
        return greeting;
    }

    /// @notice Change the greeting (costs gas because it modifies state)
    /// @param _greeting New greeting to set
    function setGreeting(string memory _greeting) public {
        string memory oldGreeting = greeting;
        greeting = _greeting;
        greetingCount++;

        // Emit event for frontend to catch
        emit GreetingChanged(oldGreeting, _greeting, msg.sender);
    }

    /// @notice Get the contract's ETH balance
    /// @return Balance in wei
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Allow contract to receive ETH
    receive() external payable {}
}
