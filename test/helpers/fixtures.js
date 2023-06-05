const { utils, BigNumber } = require("ethers");
const { waffle, network, ethers } = require("hardhat");
const { expect } = require("chai");
// const { createFixtureLoader, deployMockContract } = waffle;
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployProxy,
  deployMyProxy,
  // deployProxyWithConstructor,
  // txWait,
  // setOraclePrices,
  // LOG,
  getCurrentTime,
} = require("./utils");

const coder = new utils.AbiCoder();

const ZERO = ethers.constants.Zero;

let USDT;
let USDC;
let USX;
let DAI;
let BUSD;
let DF;
let UNI;
let WBTC;
let HBTC;
let WETH;
let lpToken;

let tx;

const allocator = "0x3fA8F8958b90D370291f9BBdDD617BB3E4f98a21";

const defSwapFeeRate = utils.parseUnits("0.003", 8);
const defAdminFeeRate = utils.parseUnits("0.5", 10);
const A = utils.parseUnits("10000", "wei");

async function impersonatedAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
}

async function stopImpersonatingAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  });
}

async function allocateTo(Token, account, amount) {
  await impersonatedAccount(allocator);

  const allocatorSigner = await ethers.getSigner(allocator);
  if ((await allocatorSigner.provider.getBalance(allocator)).eq(ZERO)) {
    const [owner, ...accounts] = await ethers.getSigners();
    await owner.sendTransaction({
      to: allocator,
      value: ethers.utils.parseEther("1.0"),
    });
  }

  await Token.connect(allocatorSigner).allocateTo(account, amount);

  await stopImpersonatingAccount(allocator);
}

async function deployPairFactory() {
  const PairFactory = await ethers.getContractFactory("PairFactory");

  const pairFactory = await deployProxy(
    PairFactory,
    [defSwapFeeRate, defAdminFeeRate],
    {
      implInit: false,
      implConstructorArgs: true,
      initializer: "initialize(uint256,uint256)",
    }
  );

  return pairFactory;
}

async function deployVolatilePair() {
  const VolatilePair = await ethers.getContractFactory("VolatilePair");
  const volatilePair = await VolatilePair.deploy();
  await volatilePair.deployed();

  await deployTokens();
  let data = coder.encode(
    ["uint256", "uint256"],
    [defSwapFeeRate, defAdminFeeRate]
  );

  await volatilePair.initialize([USDT.address, USX.address], data);

  return volatilePair;
}

async function deployStablePair() {
  const AmplificationUtils = await ethers.getContractFactory(
    "AmplificationUtils"
  );
  const amplificationUtils = await AmplificationUtils.deploy();
  await amplificationUtils.deployed();

  const SwapUtils = await ethers.getContractFactory("SwapUtils");
  const swapUtils = await SwapUtils.deploy();
  await swapUtils.deployed();

  const StablePair = await ethers.getContractFactory("StablePair", {
    libraries: {
      SwapUtils: swapUtils.address,
      AmplificationUtils: amplificationUtils.address,
    },
  });
  const stablePair = await StablePair.deploy();
  await stablePair.deployed();

  await deployTokens();

  const LPToken = await ethers.getContractFactory("LPToken");
  lpToken = await LPToken.deploy();
  await lpToken.deployed();
  await lpToken.initialize("stablePair lpToken", "lpToken");

  let data = coder.encode(
    ["uint256", "uint256", "uint256", "address"],
    [defSwapFeeRate, defAdminFeeRate, A, lpToken.address]
  );

  await stablePair.initialize([USDT.address, USX.address], data);

  return stablePair;
}
// async function deployVolatilePair() {
//   const VolatilePair = await ethers.getContractFactory("VolatilePair");
//   await deployTokens();
//   let data = coder.encode(
//     ["uint256", "uint256"],
//     [defSwapFeeRate, defAdminFeeRate]
//   );
//   const volatilePair = await deployProxy(
//     VolatilePair,
//     [[USDT.address, USX.address], data],
//     {
//       implInit: true,
//       implConstructorArgs: false,
//       initializer: "initialize(address[],bytes)",
//     }
//   );

//   return volatilePair;
// }

async function deployRouter(pairFactory) {
  const Router = await ethers.getContractFactory("Router");

  await deployTokens();

  const router = await deployMyProxy(Router, [pairFactory, WETH.address], {
    implInit: false,
    implConstructorArgs: true,
    initializer: "initialize(address,address)",
  });

  return router;
}

async function deployVolatileRouter(pairFactory) {
  await deployTokens();
  const VolatileRouter = await ethers.getContractFactory("VolatileRouter");
  const volatileRouter = await VolatileRouter.deploy(pairFactory, WETH.address);
  await volatileRouter.deployed();

  return volatileRouter;
}

async function deployStableRouter(pairFactory) {
  await deployTokens();
  const StableRouter = await ethers.getContractFactory("StableRouter");
  const stableRouter = await StableRouter.deploy(pairFactory, WETH.address);
  await stableRouter.deployed();

  return stableRouter;
}

async function deployTokens() {
  if (!USDT) {
    const TetherToken = await ethers.getContractFactory("TetherToken");
    USDT = await TetherToken.deploy(
      utils.parseUnits("1000000", 6),
      "USDT",
      "USDT",
      6
    );
    await USDT.deployed();
  }

  if (!USDC) {
    const FiatTokenV2_1 = await ethers.getContractFactory("FiatTokenV2_1");
    USDC = await FiatTokenV2_1.deploy();
    await USDC.deployed();
    const [owner, ...accounts] = await ethers.getSigners();
    await USDC.initialize(
      "USD Coin",
      "USDC",
      "USD",
      "6",
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await USDC.initializeV2("USDC");
    await USDC.initializeV2_1(owner.address);
  }

  if (!USX) {
    const MSD = await ethers.getContractFactory("MSD");
    USX = await MSD.deploy();
    await USX.deployed();
    await USX.initialize("USX", "USX", 18);
  }

  if (!DAI) {
    const Dai = await ethers.getContractFactory("Dai");
    DAI = await Dai.deploy(network.config.chainId);
    await DAI.deployed();
  }

  if (!BUSD) {
    const BUSDImplementation = await ethers.getContractFactory(
      "BUSDImplementation"
    );
    BUSD = await BUSDImplementation.deploy();
    await BUSD.deployed();
  }

  if (!DF) {
    const DSToken = await ethers.getContractFactory("DSToken");
    DF = await DSToken.deploy(utils.formatBytes32String("DF"));
    await DF.deployed();
  }

  if (!UNI) {
    const Uni = await ethers.getContractFactory("Uni");
    const [owner, ...accounts] = await ethers.getSigners();
    let time = await getCurrentTime();
    UNI = await Uni.deploy(owner.address, owner.address, time + 300);
    await UNI.deployed();
  }

  if (!WBTC) {
    const WBTCContractFactory = await ethers.getContractFactory("WBTC");
    WBTC = await WBTCContractFactory.deploy();
    await WBTC.deployed();
  }

  if (!HBTC) {
    const HBTCContractFactory = await ethers.getContractFactory("HBTC");
    HBTC = await HBTCContractFactory.deploy();
    await HBTC.deployed();
  }
  if (!WETH) {
    const WETH9 = await ethers.getContractFactory("WETH9");
    WETH = await WETH9.deploy();
    await WETH.deployed();
  }
  return { USDT, USDC, USX, DAI, BUSD, DF, UNI, WBTC, HBTC, WETH };
}

async function createPair(PairFactory, tokens, pairType) {
  const pairAddress = await PairFactory.getPairAddress(tokens, pairType);

  if (await PairFactory.isPair(pairAddress)) return pairAddress;

  let data = "0x";

  switch (pairType) {
    case 2:
      data = coder.encode(
        ["uint256", "uint256", "uint256", "address"],
        [defSwapFeeRate, defAdminFeeRate, A, lpToken.address]
      );
      break;

    default:
      break;
  }

  await PairFactory.createPair(tokens, pairType, data);

  const allPairsLength = await PairFactory.allPairsLength();
  const newPair = await PairFactory.allPairs(allPairsLength - 1);
  expect(newPair).to.be.equal(pairAddress);
  expect(await PairFactory.isPair(pairAddress)).to.be.equal(true);

  return newPair;
}

async function addLiquidity(
  sender,
  PairFactory,
  Router,
  pairType,
  tokens,
  amounts
) {
  const pairAddress = await createPair(PairFactory, tokens, pairType);

  let amountsMin = [];
  for (let index = 0; index < amounts.length; index++) {
    amountsMin.push(ZERO);
  }

  const deadline = (await getCurrentTime()) + 300;
  const ethValue =
    tokens.indexOf(WETH.address) == -1
      ? ZERO
      : amounts[tokens.indexOf(WETH.address)];

  await Router.connect(sender).addLiquidityETH(
    pairType,
    tokens,
    amounts,
    amountsMin,
    ZERO,
    sender.address,
    deadline,
    { value: ethValue }
  );

  return pairAddress;
}

async function deployAMMProtocol() {
  const PairFactory = await deployPairFactory();
  const VolatilePair = await deployVolatilePair();
  const StablePair = await deployStablePair();
  await PairFactory.addPairType(VolatilePair.address);
  await PairFactory.addPairType(StablePair.address);

  const Router = await deployRouter(PairFactory.address);

  const VolatileRouter = await deployVolatileRouter(PairFactory.address);
  const StableRouter = await deployStableRouter(PairFactory.address);
  await Router.setPairTypes( VolatileRouter.address);
  await Router.setPairTypes( StableRouter.address);

  return {
    Router,
    VolatileRouter,
    StableRouter,
    PairFactory,
    USDT,
    USDC,
    USX,
    DAI,
    BUSD,
    DF,
    UNI,
    WBTC,
    HBTC,
    WETH,
  };
}

async function fixtureDefault([wallet, other], provider) {
  return await loadFixture(deployAMMProtocol);
}

module.exports = {
  loadFixture,
  fixtureDefault,
  deployPairFactory,
  deployVolatilePair,
  deployStablePair,
  deployRouter,
  deployVolatileRouter,
  deployStableRouter,
  deployAMMProtocol,
  deployTokens,
  createPair,
  addLiquidity,
  allocateTo,
};
