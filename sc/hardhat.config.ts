import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig, task } from "hardhat/config";
import "dotenv/config";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args: any, hre: any) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
    },
    mainnet: {
      url: process.env.MAINNET_URL || "https://",
      chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 1,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    devnet: {
      url: process.env.DEVNET_URL || "https://",
      chainId: process.env.DEVNET_CHAIN_ID ? Number(process.env.DEVNET_CHAIN_ID) : 1337,
      accounts:
        process.env.DEVNET_PRIVATE_KEY !== undefined ? [process.env.DEVNET_PRIVATE_KEY] : [],
    }
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
        details: {
          constantOptimizer: true
        },
      },
      evmVersion: "cancun",
      viaIR: true,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  }
} as HardhatUserConfig;

