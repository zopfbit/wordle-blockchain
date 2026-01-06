import { useState, useEffect } from 'react'
import { useConnect, useAccount, useConnectors, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { GREETER_ADDRESS, GREETER_ABI } from './contracts/Greeter'

function App() {
  const { address, isConnected, chain } = useAccount()
  const { connect, status: connectStatus, error: connectError } = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()

  const [newGreeting, setNewGreeting] = useState('')

  const { data: greeting, refetch: refetchGreeting } = useReadContract({
    address: GREETER_ADDRESS,
    abi: GREETER_ABI,
    functionName: 'greet',
  })

  const { data: greetingCount } = useReadContract({
    address: GREETER_ADDRESS,
    abi: GREETER_ABI,
    functionName: 'greetingCount',
  })

  const { data: owner } = useReadContract({
    address: GREETER_ADDRESS,
    abi: GREETER_ABI,
    functionName: 'owner',
  })

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()

  useEffect(() => {
    if (writeError) {
      console.log('[Write Error]', writeError.message)
    }
  }, [writeError])

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  useEffect(() => {
    console.log('[Account]', { address, isConnected, chain: chain?.name })
  }, [address, isConnected, chain])

  useEffect(() => {
    console.log('[Connect]', { status: connectStatus, error: connectError?.message })
  }, [connectStatus, connectError])

  useEffect(() => {
    console.log('[Contract Read]', { greeting, greetingCount: greetingCount?.toString(), owner })
  }, [greeting, greetingCount, owner])

  useEffect(() => {
    console.log('[Transaction]', { txHash, isPending, isConfirming, isConfirmed })
  }, [txHash, isPending, isConfirming, isConfirmed])

  useEffect(() => {
    if (isConfirmed) {
      console.log('[Transaction Confirmed] Refetching greeting...')
      refetchGreeting()
    }
  }, [isConfirmed, refetchGreeting])

  const handleSetGreeting = () => {
    console.log('[Click] handleSetGreeting called, newGreeting:', newGreeting)
    if (!newGreeting) {
      console.log('[Click] No greeting entered, returning early')
      return
    }
    console.log('[Action] Calling writeContract with:', GREETER_ADDRESS)
    writeContract({
      address: GREETER_ADDRESS,
      abi: GREETER_ABI,
      functionName: 'setGreeting',
      args: [newGreeting],
    })
    console.log('[Action] writeContract called')
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Blockchain Basics</h1>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Wallet Connection</h2>
        {isConnected ? (
          <div>
            <p>Connected to: <code>{chain?.name}</code></p>
            <p>Address: <code>{address}</code></p>
            <button onClick={() => disconnect()} style={buttonStyle}>
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p>Not connected</p>
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                style={buttonStyle}
              >
                Connect {connector.name}
              </button>
            ))}
            {connectError && <p style={{ color: 'red' }}>{connectError.message}</p>}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Read Contract (Free)</h2>
        <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
          <p><strong>Current Greeting:</strong> {greeting || 'Loading...'}</p>
          <p><strong>Times Changed:</strong> {greetingCount?.toString() || '0'}</p>
          <p><strong>Contract Owner:</strong> <code>{owner || 'Loading...'}</code></p>
        </div>
      </section>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Write Contract (Costs Gas)</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="New greeting..."
            value={newGreeting}
            onChange={(e) => {
              console.log('[Input] onChange:', e.target.value)
              setNewGreeting(e.target.value)
            }}
            style={{ padding: '0.5rem', flex: 1 }}
          />
          <button
            onClick={handleSetGreeting}
            disabled={!isConnected || isPending || isConfirming}
            style={buttonStyle}
          >
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Mining...' : 'Set Greeting'}
          </button>
        </div>
        {txHash && (
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            TX: <code>{txHash}</code>
          </p>
        )}
        {isConfirmed && <p style={{ color: 'green' }}>Transaction confirmed</p>}
        {writeError && <p style={{ color: 'red' }}>{writeError.message}</p>}
      </section>
    </div>
  )
}

const buttonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#4f46e5',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  marginRight: '0.5rem',
}

export default App
