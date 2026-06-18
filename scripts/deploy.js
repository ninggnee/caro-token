import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  const CaRo1 = await ethers.getContractFactory("CaRo1");
  const caro1 = await CaRo1.deploy();
  await caro1.deployed();
  console.log("CaRo1:", caro1.address);

  const CaRo2 = await ethers.getContractFactory("CaRo2");
  const caro2 = await CaRo2.deploy();
  await caro2.deployed();
  console.log("CaRo2:", caro2.address);

  const CaRo3 = await ethers.getContractFactory("CaRo3");
  const caro3 = await CaRo3.deploy();
  await caro3.deployed();
  console.log("CaRo3:", caro3.address);

  // 👇 test balance (optional)
  const bal = await caro1.balanceOf(deployer.address);
  console.log("Initial CR1 balance:", bal.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});