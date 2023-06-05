const hre = require("hardhat");
const { deployments, ethers } = hre;
const coder = new ethers.utils.AbiCoder

const swapFee = '10000000';
const adminFee = '5000000000'

const buildData = false;

async function main() {
  const PairFactory = await hre.ethers.getContractFactory("PairFactory");
  const pairFactory = (await deployments.get('PairFactory')).address;
  const factory = PairFactory.attach(pairFactory);

  const lpToken = (await deployments.get('LPToken')).address;
  const usdt = (await deployments.get('USDT')).address;
  const usdc = (await deployments.get('USDC')).address;
  const dai = (await deployments.get('DAI')).address;
  // const busd = (await deployments.get('BUSD')).address;
  const usx = (await deployments.get('USX')).address;
  const wbtc = (await deployments.get('WBTC')).address;
  const hbtc = (await deployments.get('HBTC')).address;
  const stETH = (await deployments.get('stETH')).address

  const SBTC = '0xF3d29e9D5A4208284C187A008376A1D7f0058ABb'
  const ZD = '0x4aD3821892FaFa5258aBDF4A5636eCCA676E7728'
  const TD = '0x64fDaef7316E1E38fA85910D544F91680CaeFefa'
  const TTD = '0x780fF13Ee385fcab78e10259Ca26E3d449Af1b19'
  const TSD = '0x577fF076Fa10B29e46B35F4Bba6ed58a22919B44'
  const FZD = '0x0f47cA9e1f692E535829835FfDC086C45585DF1c'
  const WETH = '0x62fB5AaDdc4bd26C6DC50fa5dE679CAa6fa8B44b'

  let createData = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lpToken]);
  // await createPair(factory, createData, [WETH, stETH], 'WETH-stETH')
  await createPair(factory, createData, [usdc, usx], 'USDC-USX')
  // await createPair(factory, createData, [usdc, dai, usx], 'USDC-DAI-USX')
  // await createPair(factory, createData, [usdt, usx], 'USDT-USX')
  // await createPair(factory, createData, [usdt, usdc, usx], 'USDT-USDC-USX')
  // await createPair(factory, createData, [usdt, usdc, dai, usx], 'USDT-USDC-DAI-USX')
  // await createPair(factory, createData, [hbtc, wbtc], 'HBTC-WBTC')

  // await createPair(factory, createData, [SBTC, ZD], 'SBTC-ZD')
  // await createPair(factory, createData, [SBTC, TD], 'SBTC-TD')
  // await createPair(factory, createData, [SBTC, usdt], 'SBTC-USDT')
  // await createPair(factory, createData, [SBTC, usx], 'USDC-USX')
  // await createPair(factory, createData, [TD, wbtc], 'TD-WBTC')
  // await createPair(factory, createData, [TD, usx], 'TD-USX')
  // await createPair(factory, createData, [SBTC, ZD, TD], 'SBTC-ZD-TD')
  // await createPair(factory, createData, [SBTC, ZD, usx], 'SBTC-ZD-USX')
  // await createPair(factory, createData, [SBTC, TD, usx], 'SBTC-TD-USX')
  // await createPair(factory, createData, [SBTC, usdt, wbtc, usx], 'SBTC-USDT-WBTC-USX')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function createPair(factory, createData, tokens, name) {
  try {
    if (buildData) {
      let callData = await factory.populateTransaction.createPair(tokens, '2', createData)
      console.log(name, ":", callData.data);
    } else {
      let data = await ((await factory.createPair(tokens, '2', createData)).wait());
      let createPairAddress = data.events[data.events.length - 1].args.pair
      console.log(name, ":", createPairAddress);
    }
  } catch (error) {
    console.log(error);
  }
}