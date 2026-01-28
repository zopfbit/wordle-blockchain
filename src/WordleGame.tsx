
"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { WORDLE_ADDRESS, WORDLE_ABI } from "./contracts/Wordle";

type LetterStatus = "empty" | "filled";
type Cell = { letter: string; status: LetterStatus };

const WORD_LENGTH = 5;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export default function WordleGame() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  const [attempts, setAttempts] = useState<number>(0);
  const [gameFinished, setGameFinished] = useState<boolean>(false);
  const [commitHash, setCommitHash] = useState<string>("");

  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [guessHistory, setGuessHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const cells: Cell[] = useMemo(() => {
    const letters = currentGuess.toUpperCase().padEnd(WORD_LENGTH, " ").slice(0, WORD_LENGTH);
    return letters.split("").map((ch) => ({
      letter: ch === " " ? "" : ch,
      status: ch === " " ? "empty" : "filled",
    }));
  }, [currentGuess]);

  const refreshOnChainState = async (c: ethers.Contract) => {
    const [a, finished, ch] = await Promise.all([c.attempts(), c.gameFinished(), c.commitHash()]);
    setAttempts(Number(a));
    setGameFinished(Boolean(finished));
    setCommitHash(String(ch));
  };

  const connectWallet = async () => {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask not found. Please install a wallet extension.");
      return;
    }

    const p = new ethers.BrowserProvider(window.ethereum);
    const accounts = (await p.send("eth_requestAccounts", [])) as string[];
    if (!accounts?.length) {
      setError("No accounts returned from wallet.");
      return;
    }

    const s = await p.getSigner(accounts[0]);
    const c = new ethers.Contract(WORDLE_ADDRESS, WORDLE_ABI, s);

    setProvider(p);
    setSigner(s);
    setAccount(accounts[0]);
    setContract(c);

    await refreshOnChainState(c);
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handler = async (accountsAny: unknown) => {
      const accounts = accountsAny as string[];
      if (!accounts?.length) {
        setAccount("");
        setSigner(null);
        setContract(null);
        return;
      }
      // Reconnect with the new account
      await connectWallet();
    };

    window.ethereum.on("accountsChanged", handler);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contract) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (loading || gameFinished) return;

      if (e.key === "Enter") {
        void submitGuess();
        return;
      }
      if (e.key === "Backspace") {
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => (prev + e.key).toUpperCase());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, currentGuess, loading, gameFinished]);

  const stringToBytes5 = (str: string): string => {
    const bytes = ethers.toUtf8Bytes(str.toUpperCase().padEnd(5, " ").slice(0, 5));
    return ethers.hexlify(bytes);
  };

  const submitGuess = async () => {
    if (!contract) {
      setError("Not connected to contract.");
      return;
    }
    if (gameFinished) return;
    if (currentGuess.length !== WORD_LENGTH) {
      setError("Please enter a 5-letter word.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const guessBytes = stringToBytes5(currentGuess);
      const tx = await contract.submitGuess(guessBytes);
      await tx.wait();

      setGuessHistory((prev) => [...prev, currentGuess.toUpperCase()]);
      setCurrentGuess("");

      await refreshOnChainState(contract);
    } catch (e) {
      console.error(e);
      setError("Transaction failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const revealWord = async () => {
    if (!contract) {
      setError("Not connected to contract.");
      return;
    }
    const word = prompt('Enter the secret word to reveal (e.g., "apple")');
    if (!word) return;

    setLoading(true);
    setError("");
    try {
      const tx = await contract.revealWord(word);
      await tx.wait();
      await refreshOnChainState(contract);
    } catch (e) {
      console.error(e);
      setError("Reveal failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ marginBottom: 12 }}>Wordle (Demo Integration)</h1>

      <div style={{ border: "1px solid #333", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Wallet</h2>

        {!account ? (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? "Connecting..." : "Connect MetaMask"}
          </button>
        ) : (
          <div>
            <div>
              <strong>Account:</strong> {account}
            </div>
            <div>
              <strong>Contract:</strong> {WORDLE_ADDRESS}
            </div>
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #333", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>On-chain State</h2>
        <div>
          <strong>attempts:</strong> {attempts}
        </div>
        <div>
          <strong>gameFinished:</strong> {String(gameFinished)}
        </div>
        <div style={{ wordBreak: "break-all" }}>
          <strong>commitHash:</strong> {commitHash || "-"}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => contract && refreshOnChainState(contract)} disabled={!contract || loading}>
            Refresh
          </button>
          <button onClick={revealWord} disabled={!contract || loading}>
            Reveal Word (demo)
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #333", padding: 16, borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Play</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {cells.map((c, idx) => (
            <div
              key={idx}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: "1px solid #666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                background: c.status === "empty" ? "#fff" : "#eaeaea",
              }}
            >
              {c.letter}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
            placeholder="Type 5 letters"
            disabled={!contract || loading || gameFinished}
            style={{ padding: 10, fontSize: 16, width: 220 }}
          />
          <button onClick={submitGuess} disabled={!contract || loading || gameFinished || currentGuess.length !== 5}>
            {loading ? "Submitting..." : "Submit Guess"}
          </button>
        </div>

        <p style={{ marginTop: 8, color: "#666" }}>
          Tip: You can also type and press Enter. (This minimal UI only sends guesses on-chain; it does not compute
          green/yellow feedback because the current contract ABI doesn’t expose it.)
        </p>

        {guessHistory.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>Submitted guesses:</strong>
            <ul>
              {guessHistory.map((g, i) => (
                <li key={`${g}-${i}`}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}
