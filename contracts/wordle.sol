// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Wordle {
    enum LetterStatus { Correct, Present, Absent, Empty }

    uint8 public constant MAX_GUESSES = 6;
    uint8 public constant WORD_LENGTH = 5;

    address public oracle;

    struct Game {
        uint8 attempts;
        bool gameFinished;
        bool won;
        bool pendingGuess;
        bytes5[6] guesses;
        LetterStatus[5][6] hints;
    }

    mapping(address => Game) public games;

    event GameStarted(address indexed player);
    event PendingGuess(address indexed player, bytes5 guess, uint8 attempt);
    event GuessFulfilled(address indexed player, uint8 attempt, LetterStatus[5] hints);
    event GameEnded(address indexed player, bool won);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call this");
        _;
    }

    constructor(address _oracle) {
        oracle = _oracle;
    }

    function startGame() external {
        Game storage game = games[msg.sender];

        game.attempts = 0;
        game.gameFinished = false;
        game.won = false;
        game.pendingGuess = false;

        for (uint8 i = 0; i < MAX_GUESSES; i++) {
            game.guesses[i] = bytes5(0);
            for (uint8 j = 0; j < WORD_LENGTH; j++) {
                game.hints[i][j] = LetterStatus.Empty;
            }
        }

        emit GameStarted(msg.sender);
    }

    function submitGuess(bytes5 guess) external {
        Game storage game = games[msg.sender];

        require(!game.gameFinished, "Game already finished");
        require(!game.pendingGuess, "Previous guess pending");
        require(game.attempts < MAX_GUESSES, "No attempts left");

        uint8 currentAttempt = game.attempts;
        game.guesses[currentAttempt] = guess;
        game.pendingGuess = true;

        emit PendingGuess(msg.sender, guess, currentAttempt);
    }

    function fulfillGuess(
        address player,
        LetterStatus[5] calldata hints,
        bool won,
        bool gameOver
    ) external onlyOracle {
        Game storage game = games[player];

        require(game.pendingGuess, "No pending guess");

        uint8 currentAttempt = game.attempts;
        game.hints[currentAttempt] = hints;
        game.attempts += 1;
        game.pendingGuess = false;

        emit GuessFulfilled(player, currentAttempt, hints);

        if (gameOver) {
            game.gameFinished = true;
            game.won = won;
            emit GameEnded(player, won);
        }
    }

    function getGame(address player) external view returns (
        uint8 attempts,
        bool gameFinished,
        bool won,
        bool pendingGuess,
        bytes5[6] memory guesses,
        LetterStatus[5][6] memory hints
    ) {
        Game storage game = games[player];
        return (game.attempts, game.gameFinished, game.won, game.pendingGuess, game.guesses, game.hints);
    }

    function getMyGame() external view returns (
        uint8 attempts,
        bool gameFinished,
        bool won,
        bool pendingGuess,
        bytes5[6] memory guesses,
        LetterStatus[5][6] memory hints
    ) {
        Game storage game = games[msg.sender];
        return (game.attempts, game.gameFinished, game.won, game.pendingGuess, game.guesses, game.hints);
    }
}
