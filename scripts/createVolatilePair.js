const hre = require("hardhat");
const { deployments, ethers } = hre;
const coder = new ethers.utils.AbiCoder

const swapFee = '10000000';
const adminFee = '5000000000'

async function main() {
  const PairFactory = await hre.ethers.getContractFactory("PairFactory");
  const pairFactory = (await deployments.get('PairFactory')).address;
  const factory = PairFactory.attach(pairFactory);

  const df = (await deployments.get('DF')).address;
  const usx = (await deployments.get('USX')).address;
  const usdt = (await deployments.get('USDT')).address;

  // await createPair(factory, [df, usx], 'DF-USX')
  await createPair(factory, [usx, usdt], 'USX-USDT')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function createPair(factory, tokens, name) {
  let data = await ((await factory.createPair(tokens, '1', '0x')).wait());
  let createPairAddress = data.events[data.events.length - 1].args.pair
  console.log(name, ": ", createPairAddress);
}