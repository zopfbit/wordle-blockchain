const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Word list for the game
const WORDLIST = [
  "REACT", "CHAIN", "BLOCK", "SMART", "TOKEN",
  "WORLD", "HELLO", "SNAKE", "GRAPE", "LEMON",
  "APPLE", "BRAIN", "CLOUD", "DANCE", "EAGLE",
  "FLAME", "GHOST", "HEART", "JUICE", "KNIFE"
];

// LetterStatus enum matching the contract
const LetterStatus = {
  Correct: 0,
  Present: 1,
  Absent: 2,
  Empty: 3
};

// Store secret words per player
const playerWords = new Map();

// Calculate hints for a guess
function calculateHints(guess, secretWord) {
  const hints = [LetterStatus.Absent, LetterStatus.Absent, LetterStatus.Absent, LetterStatus.Absent, LetterStatus.Absent];
  const usedInWord = [false, false, false, false, false];
  const usedInGuess = [false, false, false, false, false];

  // First pass: find correct positions (green)
  for (let i = 0; i < 5; i++) {
    if (guess[i] === secretWord[i]) {
      hints[i] = LetterStatus.Correct;
      usedInWord[i] = true;
      usedInGuess[i] = true;
    }
  }

  // Second pass: find present letters (yellow)
  for (let i = 0; i < 5; i++) {
    if (usedInGuess[i]) continue;

    for (let j = 0; j < 5; j++) {
      if (!usedInWord[j] && guess[i] === secretWord[j]) {
        hints[i] = LetterStatus.Present;
        usedInWord[j] = true;
        break;
      }
    }
  }

  return hints;
}

// Convert bytes5 hex to string
function bytes5ToString(hex) {
  if (hex === "0x0000000000") return "";
  try {
    return ethers.toUtf8String(hex).trim();
  } catch {
    return "";
  }
}

// Handle GameStarted event
async function handleGameStarted(player) {
  console.log(`\nGameStarted: ${player}`);

  // Generate random word for this player
  const word = WORDLIST[Math.floor(Math.random() * WORDLIST.length)];
  playerWords.set(player.toLowerCase(), word);
  console.log(`   Secret word for ${player.slice(0, 8)}...: ${word}`);
}

// Handle PendingGuess event
async function handlePendingGuess(contract, player, guess, attempt) {
  console.log(`\nPendingGuess from ${player.slice(0, 8)}..., attempt ${attempt}`);

  const guessStr = bytes5ToString(guess);
  console.log(`   Guess: ${guessStr}`);

  // Get the secret word for this player
  const secretWord = playerWords.get(player.toLowerCase());
  if (!secretWord) {
    console.error(`   No secret word found for player ${player}`);
    return;
  }

  // Calculate hints
  const hints = calculateHints(guessStr.toUpperCase(), secretWord);
  const hintsNames = hints.map(h => ["Correct", "Present", "Absent"][h]);
  console.log(`   Hints: ${hintsNames.join(", ")}`);

  // Determine win/loss
  const won = guessStr.toUpperCase() === secretWord;
  const gameOver = won || (Number(attempt) >= 5); // attempt is 0-indexed, max 5 is the 6th guess

  console.log(`   Won: ${won}, GameOver: ${gameOver}`);

  // Fulfill the guess
  try {
    const tx = await contract.fulfillGuess(player, hints, won, gameOver);
    console.log(`   Fulfilled! TX: ${tx.hash}`);
    await tx.wait();
    console.log(`   Confirmed!`);
  } catch (err) {
    console.error(`   Error fulfilling: ${err.message}`);
  }
}

async function main() {
  // Load config
  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Config not found! Run deploy script first.");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  console.log("Oracle starting...");
  console.log(`Contract: ${config.contractAddress}`);

  // Connect to the blockchain
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  const contract = new ethers.Contract(config.contractAddress, config.abi, wallet);

  console.log(`Oracle wallet: ${wallet.address}`);

  // Use polling instead of contract.on() (avoids ethers v6 + Hardhat bug)
  let lastBlock = await provider.getBlockNumber();
  console.log(`\nPolling for events from block ${lastBlock}...\n`);

  const POLL_INTERVAL = 1000; // 1 second

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      // Query GameStarted events
      const gameStartedFilter = contract.filters.GameStarted();
      const gameStartedEvents = await contract.queryFilter(gameStartedFilter, lastBlock + 1, currentBlock);
      for (const event of gameStartedEvents) {
        await handleGameStarted(event.args[0]);
      }

      // Query PendingGuess events
      const pendingGuessFilter = contract.filters.PendingGuess();
      const pendingGuessEvents = await contract.queryFilter(pendingGuessFilter, lastBlock + 1, currentBlock);
      for (const event of pendingGuessEvents) {
        await handlePendingGuess(contract, event.args[0], event.args[1], event.args[2]);
      }

      lastBlock = currentBlock;
    } catch (err) {
      console.error(`Polling error: ${err.message}`);
    }
  }, POLL_INTERVAL);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

