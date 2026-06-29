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

// WarehouseDocumentRegistry.sol — optional, set after deployment
export const WAREHOUSE_DOC_REGISTRY_ADDRESS = process.env.WAREHOUSE_DOC_REGISTRY_ADDRESS || null;

// ABI for WarehouseDocumentRegistry.sol
export const WAREHOUSE_DOC_REGISTRY_ABI = [
  'function addWarehouseDocument(uint256 warehouseId, string memory cid, string memory documentType, string memory documentName, uint256 dbRecordId) external',
  'function cidExists(string memory cid) view returns (bool)',
  'function getWarehouseDocs(uint256 warehouseId) view returns (tuple(uint256 warehouseId, string cid, string documentType, string documentName, uint256 timestamp, address recordedBy, uint256 dbRecordId)[])',
  'function totalDocuments() view returns (uint256)',
];

// Singleton provider — reuse one instance to avoid EventEmitter listener leaks
let _provider = null;
export const getProvider = () => {
  if (!_provider) _provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
  return _provider;
};

// ABI for CoffeeToken.sol — full 4-param mint + AccessControl helpers + error types
export const COFFEE_TOKEN_ABI = [
  // Write
  'function mint(address to, uint256 amount, string lotCode, string requestId) external',
  'function burn(address from, uint256 amount, string lotCode, string redeemId) external',
  // Read
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function paused() view returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function lotMinted(string lotCode) view returns (bool)',
  // Custom errors (required for ethers.js v6 to decode revert data)
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
  'error EnforcedPause()',
];

// Legacy ABI for old CaRo1/2/3 contracts (2-param mint, no lotCode / requestId)
export const LEGACY_TOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
  'error EnforcedPause()',
];

// Transfer-only ABI for pre-mint contracts (CaRo1/2/3) that have no mint function.
// The deployer wallet holds the full initial supply — we transfer from there.
export const TRANSFER_TOKEN_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

export default {
  ETH_RPC_URL,
  MINTER_PRIVATE_KEY,
  CONTRACT_ADDRESSES,
  COFFEE_TOKEN_ABI,
  LEGACY_TOKEN_ABI,
  TRANSFER_TOKEN_ABI,
  WAREHOUSE_DOC_REGISTRY_ADDRESS,
  WAREHOUSE_DOC_REGISTRY_ABI,
  getProvider,
};
