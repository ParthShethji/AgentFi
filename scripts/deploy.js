// scripts/deploy.js  — Hardhat deploy for Base Sepolia
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // ── 1. ReputationManager ───────────────────────────────────────────────────
  const RepManager = await ethers.getContractFactory("ReputationManager");
  const repManager = await RepManager.deploy();
  await repManager.waitForDeployment();
  console.log("ReputationManager:", await repManager.getAddress());

  // ── 2. LendingPool ─────────────────────────────────────────────────────────
  // USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const LendingPool = await ethers.getContractFactory("AgentFiLending");
  const pool = await LendingPool.deploy(USDC_BASE_SEPOLIA, await repManager.getAddress());
  await pool.waitForDeployment();
  console.log("LendingPool:      ", await pool.getAddress());

  // ── 3. OrderBook ──────────────────────────────────────────────────────────
  const OrderBook = await ethers.getContractFactory("AgentFiOrderBook");
  const orderbook = await OrderBook.deploy(await pool.getAddress());
  await orderbook.waitForDeployment();
  console.log("OrderBook:        ", await orderbook.getAddress());

  // ── 4. Wire roles ─────────────────────────────────────────────────────────
  const LENDING_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LENDING_ROLE"));
  const MATCHER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MATCHER_ROLE"));
  const PLATFORM_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PLATFORM_ROLE"));

  await repManager.grantRole(LENDING_ROLE, await pool.getAddress());
  await pool.grantRole(MATCHER_ROLE, deployer.address); // replace with matcher service addr
  await pool.grantRole(PLATFORM_ROLE, deployer.address);

  console.log("\n✅ Roles wired");
  console.log({
    repManager: await repManager.getAddress(),
    pool: await pool.getAddress(),
    orderbook: await orderbook.getAddress(),
  });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
