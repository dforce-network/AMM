const hre = require("hardhat");
const { deployments, ethers, getChainId, getNamedAccounts } = hre;
const { deployAndVerify, verify } = require("./utils/deploy")
const { deploy } = deployments;

const params = { //weth
  "1": '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  "56": '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  "42161": '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  "10": '0x4200000000000000000000000000000000000006',
  "31337": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  "5": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  "11155111": '0x62fB5AaDdc4bd26C6DC50fa5dE679CAa6fa8B44b'
}

async function main() {
  const StableRouter = await hre.ethers.getContractFactory("StableRouter");
  const PairFactory = await hre.ethers.getContractFactory("PairFactory");
  const pairFactory = (await deployments.get('PairFactory')).address;
  const factory = PairFactory.attach(pairFactory);

  const Router = await hre.ethers.getContractFactory("Router");
  const routerAddress = (await deployments.get('Router')).address;
  const router = Router.attach(routerAddress);

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId()

  let swapUtils = await deployAndVerify('SwapUtils2', 'SwapUtils', []);

  let amplificationUtils = await deploy('AmplificationUtils', {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  let stablePair = await deploy('StablePair2', {
    from: deployer,
    contract: 'StablePair',
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
    libraries: {
      SwapUtils: swapUtils.address,
      AmplificationUtils: amplificationUtils.address
    }
  });
  await verify(stablePair.address, [])

  stablePair = StableRouter.attach(stablePair.address)
  let pairType = await stablePair.PAIR_TYPE()

  let factoryPairImpl = (await pairFactory.pairParams(pairType)).impl;

  if (factoryPairImpl != stablePair.address && factoryPairImpl != ethers.constants.AddressZero) {
    await pairFactory.removePairType(factoryPairImpl);
    console.log("remove old pair type done");
  }
  if (factoryPairImpl != stablePair.address) {
    await pairFactory.addPairType(factoryPairImpl);
    console.log("add pair type done");
  }

  let stableRouter = await deployAndVerify('StableRouter2', 'StableRouter', [pairFactory, params[chainId]]);

  let subRouter = await router.pairTypes(pairType);
  if (subRouter != stableRouter.address) {
    await router.setPairTypes(stableRouter.address)
    console.log("router set type done");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});