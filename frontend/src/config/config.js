// Contract addresses (Sepolia)
export const CA_RO_CONTRACTS = {
  CR1: "0x1A28478Cf65eaE639c239aAA1D1c9ec0E6C0E4A2",
  CR2: "0x14038Bb99EdE1113a15d233Df05E2B32134d2d28",
  CR3: "0xDD4861C50D600B76F3fc0Ed5b247b8959b8A0d27",
};

// Minimal ERC-20 ABI
export const ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount) external",
];