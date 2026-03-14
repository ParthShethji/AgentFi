import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || "";
const platformKey = process.env.PLATFORM_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: deployerKey && platformKey ? [deployerKey, platformKey] : undefined,
    },
    baseSepolia: {
      url: process.env.RPC_URL || "",
      chainId: 84532,
      accounts: deployerKey ? [deployerKey] : [],
    }
  }
};

export default config;
