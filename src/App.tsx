"use client"

import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"
import { WORDLE_ADDRESS, WORDLE_ABI } from "./contracts/Wordle"

// Extend Window interface, injected by wallet extensions
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

const MAX_GUESSES = 6
const WORD_LENGTH = 5

// Map contract enum to frontend status
type LetterStatus = "correct" | "present" | "absent" | "empty"
const statusMap: LetterStatus[] = ["correct", "present", "absent", "empty"]

interface Cell {
  letter: string
  status: LetterStatus
}

export default function WordleGame() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [account, setAccount] = useState<string>("")
  const [gameStarted, setGameStarted] = useState(false)
  const [guesses, setGuesses] = useState<Cell[][]>(
    Array(MAX_GUESSES)
      .fill(null)
      .map(() =>
        Array(WORD_LENGTH)
          .fill(null)
          .map(() => ({ letter: "", status: "empty" as LetterStatus })),
      ),
  )
  const [currentGuess, setCurrentGuess] = useState("")
  const [currentRow, setCurrentRow] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  // Helper to load game state from a contract instance
  // Returns true if there's a pending guess (waiting for oracle)
  const loadGameFromContract = async (wordleContract: ethers.Contract): Promise<boolean> => {
    try {
      const [attempts, gameFinished, hasWon, pendingGuess, guessesData, hintsData] = await wordleContract.getMyGame()

      const newGuesses: Cell[][] = Array(MAX_GUESSES)
        .fill(null)
        .map(() =>
          Array(WORD_LENGTH)
            .fill(null)
            .map(() => ({ letter: "", status: "empty" as LetterStatus })),
        )

      for (let i = 0; i < Number(attempts); i++) {
        const guessStr = bytes5ToString(guessesData[i])
        for (let j = 0; j < WORD_LENGTH; j++) {
          newGuesses[i][j] = {
            letter: guessStr[j] || "",
            status: statusMap[Number(hintsData[i][j])] || "empty"
          }
        }
      }

      setGuesses(newGuesses)
      setCurrentRow(Number(attempts))
      setGameOver(gameFinished)
      setWon(hasWon)
      setGameStarted(Number(attempts) > 0 || gameFinished || pendingGuess)
      return pendingGuess
    } catch (err) {
      console.error("Error loading game:", err)
      // Reset to fresh state if loading fails
      setGameStarted(false)
      setCurrentRow(0)
      setGameOver(false)
      setWon(false)
      return false
    }
  }

  // Connect to a specific account and load their game state
  const connectAccount = useCallback(async (browserProvider: ethers.BrowserProvider, accountAddress: string) => {
    const signer = await browserProvider.getSigner(accountAddress)
    const wordleContract = new ethers.Contract(WORDLE_ADDRESS, WORDLE_ABI, signer)
    setContract(wordleContract)
    setAccount(accountAddress)
    setCurrentGuess("")
    await loadGameFromContract(wordleContract)
  }, [])

  // Initialize wallet and user
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== "undefined") {
        const browserProvider = new ethers.BrowserProvider(window.ethereum)
        setProvider(browserProvider)

        const accounts = await browserProvider.send("eth_requestAccounts", [])
        if (accounts.length > 0) {
          await connectAccount(browserProvider, accounts[0])
        }

        window.ethereum.on("accountsChanged", (async (accounts: unknown) => {
          const newAccounts = accounts as string[];
          if (newAccounts.length > 0) {
            await connectAccount(browserProvider, newAccounts[0])
          } else {
            setAccount("")
            setContract(null)
          }
        }))
      } else {
        setError("Please install a Web3 wallet to play!")
      }
    }
    init()

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", () => { })
      }
    }
  }, [connectAccount])

  // Request to switch account via wallet
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const handleSwitchAccount = async () => {
    if (!window.ethereum || switchingAccount) return

    setSwitchingAccount(true)
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      })
    } catch (err: unknown) {
      // Ignore "already pending" errors (user clicked multiple times)
      const error = err as { code?: number }
      if (error.code !== -32002) {
        console.error("Error switching account:", err)
      }
    } finally {
      setSwitchingAccount(false)
    }
  }

  // Convert string to bytes5 hex for Smart Contract
  const stringToBytes5 = (str: string): string => {
    const bytes = ethers.toUtf8Bytes(str.toUpperCase().padEnd(5, " ").slice(0, 5))
    return ethers.hexlify(bytes)
  }

  // Convert bytes5 hex to string for display
  const bytes5ToString = (hex: string): string => {
    if (hex === "0x0000000000") return ""
    return ethers.toUtf8String(hex).trim()
  }

  // Load game state from contract (uses current contract from state)
  const loadGameState = useCallback(async () => {
    if (!contract) return
    await loadGameFromContract(contract)
  }, [contract])

  // Load game state on mount
  useEffect(() => {
    if (contract && account) {
      loadGameState()
    }
  }, [contract, account, loadGameState])

  // Handle keyboard input
  useEffect(() => {
    if (gameOver || !gameStarted || loading) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit()
      } else if (e.key === "Backspace") {
        setCurrentGuess((prev) => prev.slice(0, -1))
      } else if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => prev + e.key.toUpperCase())
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentGuess, currentRow, gameOver, gameStarted, loading])

  // Start game on blockchain
  const handleStartGame = async () => {
    if (!contract) return

    setLoading(true)
    setError("")
    try {
      const tx = await contract.startGame()
      await tx.wait()
      setGameStarted(true)
      setGuesses(
        Array(MAX_GUESSES)
          .fill(null)
          .map(() =>
            Array(WORD_LENGTH)
              .fill(null)
              .map(() => ({ letter: "", status: "empty" as LetterStatus })),
          ),
      )
      setCurrentGuess("")
      setCurrentRow(0)
      setGameOver(false)
      setWon(false)
    } catch (err: unknown) {
      console.error("Error starting game:", err)
      setError("Failed to start game. Check console for details.")
    } finally {
      setLoading(false)
    }
  }

  // Submit guess to blockchain and wait for oracle
  const handleSubmit = async () => {
    if (currentGuess.length !== WORD_LENGTH || gameOver || !contract || loading) return

    setLoading(true)
    setError("")
    try {
      const guessBytes = stringToBytes5(currentGuess)
      const tx = await contract.submitGuess(guessBytes)
      await tx.wait()
      setCurrentGuess("")

      // Poll until oracle fulfills the guess
      let pending = true
      let attempts = 0
      while (pending && attempts < 30) {
        await new Promise(r => setTimeout(r, 500)) // Wait 500ms
        pending = await loadGameFromContract(contract)
        attempts++
      }

      if (pending) {
        setError("Oracle timeout - please refresh")
      }
    } catch (err: unknown) {
      console.error("Error submitting guess:", err)
      setError("Failed to submit guess. Check console for details.")
    } finally {
      setLoading(false)
    }
  }

  const getCellColor = (status: LetterStatus) => {
    switch (status) {
      case "correct":
        return "bg-green-600"
      case "present":
        return "bg-yellow-600"
      case "absent":
        return "bg-gray-600"
      default:
        return "bg-white border-2 border-gray-300"
    }
  }

  const resetGame = () => {
    handleStartGame()
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">Wordle</h1>
          <p className="text-red-600 mb-6">
            {error || "Please install some web3 wallet to play!"}
          </p>
        </div>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">Wordle</h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            {account ? (
              <>
                <p className="text-gray-600">Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
                <button
                  onClick={handleSwitchAccount}
                  disabled={switchingAccount}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-sm font-medium px-3 py-1 rounded-full transition-colors"
                >
                  {switchingAccount ? "..." : "Switch"}
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  if (window.ethereum && provider) {
                    const accounts = await provider.send("eth_requestAccounts", [])
                    if (accounts.length > 0) {
                      await connectAccount(provider, accounts[0])
                    }
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
          <p className="text-gray-600 mb-6">
            Guess the 5-letter word in {MAX_GUESSES} tries. Green means correct position, yellow means the letter is in
            the word but wrong position, gray means the letter is not in the word.
          </p>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          <button
            onClick={handleStartGame}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold px-8 py-3 rounded transition-colors"
          >
            {loading ? "Starting..." : "Start Game"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">Wordle</h1>
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-6">
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
          <button
            onClick={handleSwitchAccount}
            disabled={switchingAccount}
            className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-sm font-medium px-3 py-1 rounded-full transition-colors"
          >
            {switchingAccount ? "..." : "Switch"}
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {guesses.map((guess, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 justify-center">
              {guess.map((cell, cellIndex) => {
                const isCurrentRow = rowIndex === currentRow && !gameOver
                const displayLetter =
                  isCurrentRow && cellIndex < currentGuess.length ? currentGuess[cellIndex] : cell.letter

                return (
                  <div
                    key={cellIndex}
                    className={`w-14 h-14 flex items-center justify-center text-2xl font-bold rounded ${cell.status === "empty" && isCurrentRow
                      ? "bg-white border-2 border-gray-400"
                      : getCellColor(cell.status)
                      } ${cell.status !== "empty" ? "text-white" : "text-gray-800"}`}
                  >
                    {displayLetter}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 text-center mb-4">{error}</p>}

        {gameOver && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center mb-4">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{won ? "Congratulations!" : "Game Over"}</h2>
            <p className="text-gray-600 mb-4">
              {won
                ? `You guessed the word in ${currentRow} ${currentRow === 1 ? "try" : "tries"}!`
                : "Better luck next time!"}
            </p>
            <button
              onClick={resetGame}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold px-6 py-2 rounded transition-colors"
            >
              {loading ? "Starting..." : "Play Again"}
            </button>
          </div>
        )}

        {!gameOver && (
          <div className="text-center text-gray-600">
            <p className="mb-2">{loading ? "Submitting to blockchain..." : "Type your guess and press Enter"}</p>
            <p className="text-sm">
              Guess {currentRow + 1} of {MAX_GUESSES}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
