// Contract addresses (Sepolia)
export const CA_RO_CONTRACTS = {
  CR1: "0xc01A466ABBDB5e1392B1C9055457a02653Cb7CCf",
  CR2: "0x8046C3DC5681EB929Bb5f3B6245ABF548030C23A",
  CR3: "0xAa390Dc0aB4a742FDB11Cf53E0556db9A7A379f3",
};

// ABI — matches CoffeeToken.sol (4-param mint + AccessControl + error types)
export const ABI = [
  // Read
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function paused() view returns (bool)",
  "function MINTER_ROLE() view returns (bytes32)",
  // Write (4-param — matches deployed CoffeeToken.sol)
  "function mint(address to, uint256 amount, string lotCode, string requestId) external",
  // Custom errors (required for ethers.js to decode revert data)
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error EnforcedPause()",
];