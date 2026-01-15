// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Wordle {
    bytes32 public commitHash;
    uint8 public attempts;
    bool public gameFinished;
    bool public revealed;
    event GameStarted(bytes32 commitHash);
event GuessSubmitted(uint8 attempt, bytes5 guess);
event GameEnded(bool success);

    constructor(bytes32 _commitHash) {
        commitHash = _commitHash;
        attempts = 0;
        gameFinished = false;
    }
function submitGuess(bytes5 guess) external {
require(!gameFinished, "Game already finished");
require(attempts < 6, "No attempts left");

attempts += 1;

emit GuessSubmitted(attempts, guess);

if (attempts == 6) {
    gameFinished = true;
    emit GameEnded(false);
}
}

function revealWord(string calldata word) external {
require(gameFinished, "Game not finished yet");
require(commitHash != bytes32(0), "No commit set");

bytes32 revealedHash = keccak256(abi.encodePacked(word));
require(revealedHash == commitHash, "Reveal does not match commit");
revealed = true;

emit GameEnded(true);
}
}
