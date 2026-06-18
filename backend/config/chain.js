import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const ETH_RPC_URL     = process.env.ETH_RPC_URL || process.env.RPC_URL || 'http://localhost:8545';
export const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY || null;

// One ERC-20 contract deployed per grade (CoffeeToken.sol)
export const CONTRACT_ADDRESSES = {
  CR1: process.env.CA_RO_CR1 || '0x1A28478Cf65eaE639c239aAA1D1c9ec0E6C0E4A2',
  CR2: process.env.CA_RO_CR2 || '0x14038Bb99EdE1113a15d233Df05E2B32134d2d28',
  CR3: process.env.CA_RO_CR3 || '0xDD4861C50D600B76F3fc0Ed5b247b8959b8A0d27',
};

// Singleton provider — reuse one instance to avoid EventEmitter listener leaks
let _provider = null;
export const getProvider = () => {
  if (!_provider) _provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
  return _provider;
};

// ABI for CoffeeToken.sol (new) — also backward-compatible with CaRo1/2/3 (mint(address,uint256))
export const COFFEE_TOKEN_ABI = [
  'function mint(address to, uint256 amount, string lotCode, string requestId) external',
  'function burn(address from, uint256 amount, string lotCode, string redeemId) external',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Legacy ABI for existing CaRo1/2/3 contracts (no lotCode / requestId args)
export const LEGACY_TOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export default {
  ETH_RPC_URL,
  MINTER_PRIVATE_KEY,
  CONTRACT_ADDRESSES,
  COFFEE_TOKEN_ABI,
  LEGACY_TOKEN_ABI,
  getProvider,
};
