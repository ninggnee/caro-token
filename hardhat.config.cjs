require("dotenv").config({ path: "./backend/.env" });
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.ETH_RPC_URL || "",
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
    },
  },
};