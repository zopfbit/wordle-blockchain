// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Wordle {
    bytes32 public commitHash;
    uint8 public attempts;
    bool public gameFinished;

    constructor(bytes32 _commitHash) {
        commitHash = _commitHash;
        attempts = 0;
        gameFinished = false;
    }
}
