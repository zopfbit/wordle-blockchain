"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { WORDLE_ADDRESS, WORDLE_ABI } from "./contracts/Wordle"

declare global {
  interface Window {
    ethereum?: any
  }
}

const WORD_LENGTH = 5
const MAX_GUESSES = 6

type Cell = {
  letter: string
}

export default function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [account, setAccount] = useState<string>("")

  const [guesses, setGuesses] = useState<Cell[][]>(
    Array.from({ length: MAX_GUESSES }, () =>
      Array.from({ length: WORD_LENGTH }, () => ({ letter: "" }))
    )
  )

  const [currentGuess, setCurrentGuess] = useState("")
  const [attempts, setAttempts] = useState(0)
  const [gameFinished, setGameFinished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // ------------------------
  // Init wallet + contract
  // ------------------------
  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) {
        setError("MetaMask not found")
        return
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      setProvider(provider)

      const accounts = await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()

      setAccount(accounts[0])

      const contract = new ethers.Contract(
        WORDLE_ADDRESS,
        WORDLE_ABI,
        signer
      )

      setContract(contract)

      const a = await contract.attempts()
      const finished = await contract.gameFinished()

      setAttempts(Number(a))
      setGameFinished(finished)
    }

    init()
  }, [])

  // ------------------------
  // Helpers
  // ------------------------
  const stringToBytes5 = (str: string) => {
    const bytes = ethers.toUtf8Bytes(str.padEnd(5, " ").slice(0, 5))
    return ethers.hexlify(bytes)
  }

  // ------------------------
  // Submit guess
  // ------------------------
  const submitGuess = async () => {
    if (!contract) return
    if (currentGuess.length !== WORD_LENGTH) return

    try {
      setLoading(true)
      const tx = await contract.submitGuess(stringToBytes5(currentGuess))
      await tx.wait()

      const a = await contract.attempts()
      const finished = await contract.gameFinished()

      const newGuesses = [...guesses]
      newGuesses[attempts] = currentGuess
        .split("")
        .map((l) => ({ letter: l.toUpperCase() }))

      setGuesses(newGuesses)
      setAttempts(Number(a))
      setGameFinished(finished)
      setCurrentGuess("")
    } catch (e) {
      console.error(e)
      setError("Transaction failed")
    } finally {
      setLoading(false)
    }
  }

  // ------------------------
  // UI
  // ------------------------
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Wordle (Blockchain Demo)</h1>

      <p>
        <b>Account:</b> {account || "not connected"}
      </p>

      <div style={{ marginTop: 20 }}>
        {guesses.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {row.map((cell, j) => (
              <div
                key={j}
                style={{
                  width: 40,
                  height: 40,
                  border: "1px solid #999",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                {cell.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {!gameFinished && (
        <div style={{ marginTop: 20 }}>
          <input
            value={currentGuess}
            maxLength={5}
            onChange={(e) => setCurrentGuess(e.target.value.toUpperCase())}
          />
          <button onClick={submitGuess} disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      )}

      {gameFinished && <p>Game finished 🎉</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  )
}
