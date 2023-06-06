# Descriptions
dForce AMM is a decentralized exchange (DEX) based on the open-source protocols Saddle and Uniswap V2. It supports trading pairs in variable and stable modes, more modes are on the way. Saddle is a open-source automated market maker (AMM) to enable efficient trading between pegged value crypto assets. It has passed security auditing on all smart contracts from the several auditors, with no issues. You can find the audit details here, https://docs.saddle.finance/smart-contract-audit. Uniswap V2 is the most popular and widely adopted DEX AMM. It has been proven to be sufficiently secure and has undergone multiple rounds of audits.

Comparing to Saddle and Uniswap V2, the major modifications are:
1. Fee structure of Uniswap V2.
2. Some interfaces and parameters of Saddle.

Also, a brand new Router is implemented to achieve a unified interfaces to call the functions of different pairs, such as add_liquidity, remove_liquidity, swap and some interfaces to inquire data of pairs.

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js

npx hardhat export-abi
```
