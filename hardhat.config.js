require("@nomicfoundation/hardhat-toolbox");
require('hardhat-deploy');
require('solidity-docgen');
require('hardhat-abi-exporter');
// require('hardhat-contract-sizer');
require('dotenv').config();
require('solidity-coverage');
require("@nomiclabs/hardhat-etherscan");

// const { setGlobalDispatcher, ProxyAgent } = require("undici");

// // hardhat verify uses undici
// const proxyAgent = new ProxyAgent("http://127.0.0.1:1087");
// setGlobalDispatcher(proxyAgent);

const privateKey = process.env.PRIVATE_KEY ?? "NO_PRIVATE_KEY";
const scanKey = process.env.ETHERSCAN_API_KEY ?? "ETHERSCAN_API_KEY";
const goerliRpc = process.env.GOERLI_RPC ?? "GOERLI_RPC";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    hardhat: {
    },
    arbitrum: {
      url: "http://localhost:24012/rpc", // truffle-dashboard
      timeout: 200000,
    },
    goerli: {
      url: "https://ethereum-goerli.publicnode.com",
      accounts: [`${privateKey}`],
      chainId: 5,
      zksync: false,
    },
    sepolia: {
      url: 'https://rpc2.sepolia.org/',
      accounts: [`${privateKey}`],
      chainId: 11155111,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
    deploy: "./scripts/deploy",
    deployments: "./deployments",
  },
  abiExporter: {
    path: "./abi",
    runOnCompile: false,
    clear: true,
    flat: true,
    only: ["PairFactory", "Router", "StablePair", "VolatilePair"],
    spacing: 2,
    pretty: false,
  },
  namedAccounts: {
    deployer: 0
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [],
  },
  etherscan: {
    apiKey: {
      goerli: scanKey,
      sepolia: scanKey
    }
  },
};
