"use client"

import { useState, useEffect } from "react"

// TODO: Use blockchain APIS
const WORD = "REACT"
const MAX_GUESSES = 6
const WORD_LENGTH = 5

type LetterStatus = "correct" | "present" | "absent" | "empty"

interface Cell {
  letter: string
  status: LetterStatus
}

export default function WordleGame() {
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

  useEffect(() => {
    if (gameOver || !gameStarted) return

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
  }, [currentGuess, currentRow, gameOver, gameStarted])

  // TODO call transaction guess
  const checkGuess = (guess: string): Cell[] => {
    const result: Cell[] = []
    const wordArray = WORD.split("")
    const guessArray = guess.split("")
    const used = Array(WORD_LENGTH).fill(false)

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArray[i] === wordArray[i]) {
        result[i] = { letter: guessArray[i], status: "correct" }
        used[i] = true
      } else {
        result[i] = { letter: guessArray[i], status: "absent" }
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i].status === "correct") continue

      const foundIndex = wordArray.findIndex((letter, idx) => letter === guessArray[i] && !used[idx])

      if (foundIndex !== -1) {
        result[i] = { letter: guessArray[i], status: "present" }
        used[foundIndex] = true
      }
    }

    return result
  }

  const handleSubmit = () => {
    if (currentGuess.length !== WORD_LENGTH || gameOver) return

    const result = checkGuess(currentGuess)
    const newGuesses = [...guesses]
    newGuesses[currentRow] = result
    setGuesses(newGuesses)

    if (currentGuess === WORD) {
      setWon(true)
      setGameOver(true)
    } else if (currentRow === MAX_GUESSES - 1) {
      setGameOver(true)
    } else {
      setCurrentRow((prev) => prev + 1)
      setCurrentGuess("")
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
    // TODO call transaction reset/start
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
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">Wordle</h1>
          <p className="text-gray-600 mb-6">
            Guess the 5-letter word in {MAX_GUESSES} tries. Green means correct position, yellow means the letter is in
            the word but wrong position, gray means the letter is not in the word.
          </p>
          <button
            // add transaction call start
            onClick={() => setGameStarted(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded transition-colors"
          >
            Start Game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">Wordle</h1>

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

        {gameOver && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center mb-4">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{won ? "Congratulations!" : "Game Over"}</h2>
            <p className="text-gray-600 mb-4">
              {won
                ? `You guessed the word in ${currentRow + 1} ${currentRow + 1 === 1 ? "try" : "tries"}!`
                : `The word was: ${WORD}`}
            </p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded transition-colors"
            >
              Play Again
            </button>
          </div>
        )}

        {!gameOver && (
          <div className="text-center text-gray-600">
            <p className="mb-2">Type your guess and press Enter</p>
            <p className="text-sm">
              Guess {currentRow + 1} of {MAX_GUESSES}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
