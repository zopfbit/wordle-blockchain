// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Wordle {
    enum LetterStatus { Correct, Present, Absent, Empty }

    uint8 public constant MAX_GUESSES = 6;
    uint8 public constant WORD_LENGTH = 5;

    bytes5 private constant SECRET_WORD = "REACT";

    struct Game {
        uint8 attempts;
        bool gameFinished;
        bool won;
        bytes5[6] guesses;
        LetterStatus[5][6] hints;
    }

    mapping(address => Game) public games;

    event GameStarted(address indexed player);
    event GuessSubmitted(address indexed player, uint8 attempt, bytes5 guess, LetterStatus[5] hints);
    event GameEnded(address indexed player, bool won);

    constructor() {
    }

    function startGame() external {
        Game storage game = games[msg.sender];

        game.attempts = 0;
        game.gameFinished = false;
        game.won = false;

        for (uint8 i = 0; i < MAX_GUESSES; i++) {
            game.guesses[i] = bytes5(0);
            for (uint8 j = 0; j < WORD_LENGTH; j++) {
                game.hints[i][j] = LetterStatus.Empty;
            }
        }

        emit GameStarted(msg.sender);
    }

    // update state of game
    function submitGuess(bytes5 guess) external {
        Game storage game = games[msg.sender];

        require(!game.gameFinished, "Game already finished");
        require(game.attempts < MAX_GUESSES, "No attempts left");

        uint8 currentAttempt = game.attempts;
        game.guesses[currentAttempt] = guess;

        LetterStatus[5] memory hints = calculateHints(guess);
        game.hints[currentAttempt] = hints;

        game.attempts += 1;

        emit GuessSubmitted(msg.sender, game.attempts, guess, hints);

        if (guess == SECRET_WORD) {
            game.gameFinished = true;
            game.won = true;
            emit GameEnded(msg.sender, true);
        } else if (game.attempts >= MAX_GUESSES) {
            game.gameFinished = true;
            emit GameEnded(msg.sender, false);
        }
    }

    // Calculate hints for a guess (Wordle logic)
    function calculateHints(bytes5 guess) internal pure returns (LetterStatus[5] memory) {
        LetterStatus[5] memory hints;
        bool[5] memory usedInWord;
        bool[5] memory usedInGuess;

        bytes5 word = SECRET_WORD;

        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (guess[i] == word[i]) {
                hints[i] = LetterStatus.Correct;
                usedInWord[i] = true;
                usedInGuess[i] = true;
            }
        }

        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (usedInGuess[i]) continue;

            bool found = false;
            for (uint8 j = 0; j < WORD_LENGTH; j++) {
                if (!usedInWord[j] && guess[i] == word[j]) {
                    hints[i] = LetterStatus.Present;
                    usedInWord[j] = true;
                    found = true;
                    break;
                }
            }

            if (!found) {
                hints[i] = LetterStatus.Absent;
            }
        }

        return hints;
    }

    function getGame(address player) external view returns (
        uint8 attempts,
        bool gameFinished,
        bool won,
        bytes5[6] memory guesses,
        LetterStatus[5][6] memory hints
    ) {
        Game storage game = games[player];
        return (game.attempts, game.gameFinished, game.won, game.guesses, game.hints);
    }

    function getMyGame() external view returns (
        uint8 attempts,
        bool gameFinished,
        bool won,
        bytes5[6] memory guesses,
        LetterStatus[5][6] memory hints
    ) {
        Game storage game = games[msg.sender];
        return (game.attempts, game.gameFinished, game.won, game.guesses, game.hints);
    }
}
