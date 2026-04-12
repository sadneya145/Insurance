import { useState, useEffect, useCallback, useRef } from 'react';

const SEPOLIA_CHAIN_ID = '0xaa36a7';
const SEPOLIA_CHAIN_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Sepolia Testnet',
  nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.infura.io/v3/'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
};

// This is your wallet address (EOA) — NOT a smart contract.
// We send a plain 0 ETH tx to it as on-chain proof. No data field allowed.
const PROOF_WALLET_ADDRESS = '0x841Cf52bBe77Ae46CEb366847F57D73517992f36';

const isSepoliaChain = (id) => {
  if (!id) return false;
  const normalized = id.startsWith('0x') ? parseInt(id, 16) : parseInt(id, 10);
  return normalized === 11155111;
};

export function useMetaMask() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [error, setError] = useState(null);
  const [txPending, setTxPending] = useState(false);

  const accountRef = useRef(null);
  const isCorrectNetworkRef = useRef(false);

  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { isCorrectNetworkRef.current = isCorrectNetwork; }, [isCorrectNetwork]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount(null);
        accountRef.current = null;
        setIsConnected(false);
      } else {
        setAccount(accounts[0]);
        accountRef.current = accounts[0];
        setIsConnected(true);
      }
    };

    const handleChainChanged = (id) => {
      setChainId(id);
      const correct = isSepoliaChain(id);
      setIsCorrectNetwork(correct);
      isCorrectNetworkRef.current = correct;
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        accountRef.current = accounts[0];
        setIsConnected(true);
      }
    });

    window.ethereum.request({ method: 'eth_chainId' }).then(id => {
      setChainId(id);
      const correct = isSepoliaChain(id);
      setIsCorrectNetwork(correct);
      isCorrectNetworkRef.current = correct;
    });

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Defined before connect() so connect can reference it
  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      });
      return true;
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_CHAIN_PARAMS]
          });
          return true;
        } catch (addErr) {
          setError('Failed to add Sepolia: ' + addErr.message);
          return false;
        }
      } else if (switchErr.code === 4001) {
        setError('Network switch rejected.');
        return false;
      }
      setError('Failed to switch network: ' + switchErr.message);
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed.');
      return null;
    }
    try {
      setError(null);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      accountRef.current = accounts[0];
      setIsConnected(true);

      const id = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(id);
      const correct = isSepoliaChain(id);
      setIsCorrectNetwork(correct);
      isCorrectNetworkRef.current = correct;

      if (!correct) await switchToSepolia();

      return accounts[0];
    } catch (err) {
      setError(err.message || 'Failed to connect MetaMask');
      return null;
    }
  }, [switchToSepolia]);

  /**
   * Sends a plain 0 ETH transaction to the proof wallet on Sepolia.
   * NO data field — EOA wallets reject transactions with data.
   * The txHash itself is the immutable on-chain proof.
   */
  const sendTransaction = useCallback(async ({ type, id, metadata = {} }) => {
    if (!window.ethereum) {
      setError('MetaMask is not installed.');
      return null;
    }

    let currentAccount = accountRef.current;
    let currentlyCorrect = isCorrectNetworkRef.current;

    if (!currentAccount) {
      const acc = await connect();
      if (!acc) {
        setError('Please connect MetaMask first.');
        return null;
      }
      currentAccount = acc;
    }

    if (!currentlyCorrect) {
      const switched = await switchToSepolia();
      if (!switched) {
        setError('Please switch to Sepolia testnet.');
        return null;
      }
      await new Promise(r => setTimeout(r, 600));
    }

    setTxPending(true);
    setError(null);

    try {
      // Plain EOA-to-EOA transfer — no data field, just 0 ETH value
      // This is valid on Sepolia and triggers the MetaMask popup
      const txParams = {
        from: currentAccount,
        to: PROOF_WALLET_ADDRESS,
        value: '0x0',        // 0 ETH — only gas fee is charged
        // NO data field — EOA wallets reject transactions with data
      };

      console.log(`[MetaMask] Sending ${type} proof TX for ${id}...`);

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });

      console.log('[MetaMask] TX sent:', txHash);

      // Poll for receipt
      let receipt = null;
      let attempts = 0;
      while (!receipt && attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash]
          });
        } catch (_) {}
        attempts++;
      }

      setTxPending(false);
      return {
        txHash,
        blockNumber: receipt ? parseInt(receipt.blockNumber, 16) : null,
        status: receipt?.status === '0x1' ? 'success' : 'pending',
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
      };

    } catch (err) {
      setTxPending(false);
      if (err.code === 4001) {
        setError('Transaction rejected by user.');
      } else {
        setError(err.message || 'Transaction failed.');
      }
      console.error('[MetaMask] TX Error:', err);
      return null;
    }
  }, [connect, switchToSepolia]);

  return {
    account,
    chainId,
    isConnected,
    isCorrectNetwork,
    error,
    txPending,
    connect,
    switchToSepolia,
    sendTransaction
  };
}