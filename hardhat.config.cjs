require("dotenv").config({ path: "./backend/.env" });
require("@nomiclabs/hardhat-ethers");

// Support both ADMIN_PRIVATE_KEY (original deployer) and MINTER_PRIVATE_KEY (backend wallet).
// If only MINTER_PRIVATE_KEY exists, it is used for both roles.
const accounts = [];
if (process.env.ADMIN_PRIVATE_KEY)  accounts.push(process.env.ADMIN_PRIVATE_KEY);
if (process.env.MINTER_PRIVATE_KEY) accounts.push(process.env.MINTER_PRIVATE_KEY);

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: process.env.ETH_RPC_URL || "",
      accounts,
    },
  },
};