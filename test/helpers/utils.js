const { expect, use } = require("chai");
const { utils, BigNumber } = require("ethers");
const { upgrades, network, block } = require("hardhat");

const USE_HARDHAT_UPGRADES = false;
const LOG_VERBOSE = false;

const BASE = ethers.utils.parseEther("1");
const blockSleep = 2;
const sleepTime = 5000; // 5s

let proxyAdmin = { address: "" };

let tx;

async function verifyOnlyOwner(
  contract,
  method,
  args,
  owner,
  other,
  ownerEvent = "",
  ownerEventArgs = [],
  ownerChecks = async () => {},
  nonownerChecks = async () => {}
) {
  // execute the non-owner case first as it does not change state
  await expect(contract.connect(other)[method](...args)).to.be.revertedWith(
    "onlyOwner: caller is not the owner"
  );

  await nonownerChecks();

  // exxcute the owner call
  if (ownerEvent !== "") {
    await expect(contract.connect(owner)[method](...args))
      .to.emit(contract, ownerEvent)
      .withArgs(...ownerEventArgs);
  } else {
    await contract.connect(owner)[method](...args);
  }

  await ownerChecks();
}

// Convert any raw ether value into wei based on the decimals of the token.
// eg: parseTokenAmount(iToken, 100) => 100 * 10 ** 18
async function parseTokenAmount(token, amount) {
  return utils.parseUnits(amount.toString(), await token.decimals());
}

async function formatTokenAmount(token, amount) {
  return utils.formatUnits(amount, await token.decimals());
}

async function formatToHumanReadable(number) {
  return number.toString() / BASE.toString();
}

function isMockPriceOrace(oracle) {
  return !oracle.functions.hasOwnProperty("poster");
}

async function convertToOraclePrice(iToken, price) {
  let decimals = await iToken.decimals();

  // Price based on USD
  return utils.parseUnits(price.toString(), 36 - decimals);
}

async function setMockOraclePrices(mockPriceOracle, iTokens, prices, status) {
  for (let index = 0; index < prices.length; index++) {
    const iToken = iTokens[index];
    let tokenPrice = await convertToOraclePrice(iToken, prices[index]);

    await mockPriceOracle.mock.getUnderlyingPrice
      .withArgs(iToken.address)
      .returns(tokenPrice);

    let assetStatus = true;
    if (status.length != 0) {
      assetStatus = status[index];
    }

    await mockPriceOracle.mock.getUnderlyingPriceAndStatus
      .withArgs(iToken.address)
      .returns(tokenPrice, assetStatus);
  }
}

async function setOraclePrices(oracle, iTokens, prices, status = []) {
  if (isMockPriceOrace(oracle)) {
    await setMockOraclePrices(oracle, iTokens, prices, status);
  } else {
    await setRealOraclePrices(oracle, iTokens, prices, status);
  }
}

async function setRealOraclePrices(oracle, iTokens, prices, status) {
  const [owner] = await ethers.getSigners();

  let tokenAddressList = [];
  let tokenPrices = [];
  for (let index = 0; index < prices.length; index++) {
    const iToken = iTokens[index];
    let tokenPrice = await convertToOraclePrice(iToken, prices[index]);

    await oracle.connect(owner)._setPendingAnchor(iToken.address, tokenPrice);

    tokenPrices.push(tokenPrice);
    tokenAddressList.push(iTokens[index].address);

    // TODO: Set asset status

    // const name = await iToken.name();
    // LOG(
    //   name,
    //   "current Price: ",
    //   (await oracle.getUnderlyingPrice(iToken.address)).toString(),
    //   "about to feed Price: ",
    //   tokenPrice.toString()
    // );
  }

  await oracle.connect(owner).setPrices(tokenAddressList, tokenPrices);
}

function verifyAllowError(value0, value1, errorFactor) {
  // For 0 values no error allowed
  if (value0.isZero() || value1.isZero()) {
    expect(Number(value0.toString())).to.closeTo(
      Number(value1.toString()),
      10000
    );
    return;
  }

  let ratio = parseFloat(
    utils.formatEther(value0.mul(utils.parseEther("1")).div(value1))
  );

  expect(ratio).to.be.closeTo(1.0, errorFactor);
}

// Math function
function rmul(a, b) {
  return a.mul(b).div(BASE);
}

function rdiv(a, b) {
  return a.mul(BASE).div(b);
}

function divup(a, b) {
  return a.add(b.sub(1)).div(b);
}

function rdivup(a, b) {
  return divup(a.mul(BASE), b);
}

function getInitializerData(ImplFactory, args, initializer) {
  if (initializer === false) {
    return "0x";
  }

  const allowNoInitialization = initializer === undefined && args.length === 0;
  initializer = initializer ?? "initialize";

  try {
    const fragment = ImplFactory.interface.getFunction(initializer);
    return ImplFactory.interface.encodeFunctionData(fragment, args);
  } catch (e) {
    if (e instanceof Error) {
      if (allowNoInitialization && e.message.includes("no matching function")) {
        return "0x";
      }
    }
    throw e;
  }
}

// When uses script to deploy contract,
// - if does not set `proxyAdmin` in the`config/commonConfig.js`,
//   deploys a new proxy admin contract, and then for all following proxy contracts,
//   use the same proxy admin contract.
// - if sets, then reads from the config and uses it.
async function getProxyAdmin() {
  if (proxyAdmin.address) {
    return proxyAdmin;
  }
  const [owner, ...accounts] = await ethers.getSigners();

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.deployed();
  tx = proxyAdmin.deployTransaction;
  await txWait(network.name, tx);

  return proxyAdmin;
}

async function deployProxyInternal(contractFactory, args, params, implAddress) {
  const data = getInitializerData(contractFactory, args, params.initializer);
  const adminAddress = (await getProxyAdmin()).address;

  LOG("Proxy Admin deployed at: ", adminAddress);

  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await Proxy.deploy(implAddress, adminAddress, data);
  await proxy.deployed();
  tx = proxy.deployTransaction;

  await txWait(network.name, tx);

  const contract = contractFactory.attach(proxy.address);

  // LOG(contract);

  return contract;
}

async function deployMyProxy(
  contractFactory,
  args,
  params,
  implementationAddress
) {
  return await myDeployMyProxy(
    contractFactory,
    args,
    params,
    implementationAddress
  );
}

async function myDeployMyProxy(
  contractFactory,
  args,
  params,
  implementationAddress
) {
  let impl;
  const [owner, ...accounts] = await ethers.getSigners();
  if (!implementationAddress) {
    // implInit: false,
    // implConstructorArgs: true,
    let constructorArgs = [];
    if (params.implConstructorArgs) constructorArgs = args;
    impl = await contractFactory.deploy(...constructorArgs);
    await impl.deployed();
    tx = impl.deployTransaction;
    await txWait(network.name, tx);
    // call initialize() in the implementation conttract
    if (params.implInit) tx = await impl[params.initializer](...args);

    await txWait(network.name, tx);
  } else {
    impl = { address: implementationAddress };
  }

  proxy = deployMyProxyInternal(contractFactory, args, params, impl.address);

  return proxy;
}

async function deployMyProxyInternal(
  contractFactory,
  args,
  params,
  implAddress
) {
  const data = getInitializerData(contractFactory, args, params.initializer);
  const adminAddress = (await getProxyAdmin()).address;

  LOG("Proxy Admin deployed at: ", adminAddress);

  const Proxy = await ethers.getContractFactory(
    "MyTransparentUpgradeableProxy"
  );
  const proxy = await Proxy.deploy(implAddress, adminAddress, data);
  await proxy.deployed();
  tx = proxy.deployTransaction;

  await txWait(network.name, tx);

  const contract = contractFactory.attach(proxy.address);

  // LOG(contract);

  return contract;
}

async function myDeployProxyWithConstructor(
  contractFactory,
  args,
  params,
  implementationAddress,
  constructorArguments
) {
  let impl;
  const [owner, ...accounts] = await ethers.getSigners();
  if (implementationAddress == "") {
    impl = await contractFactory.deploy(...constructorArguments);
    await impl.deployed();
    tx = impl.deployTransaction;
    await txWait(network.name, tx);
  } else {
    impl = { address: implementationAddress };
  }

  proxy = deployProxyInternal(contractFactory, args, params, impl.address);

  return proxy;
}

async function myDeployProxy(
  contractFactory,
  args,
  params,
  implementationAddress
) {
  let impl;
  const [owner, ...accounts] = await ethers.getSigners();
  if (!implementationAddress) {
    // implInit: false,
    // implConstructorArgs: true,
    let constructorArgs = [];
    if (params.implConstructorArgs) constructorArgs = args;
    impl = await contractFactory.deploy(...constructorArgs);
    await impl.deployed();
    tx = impl.deployTransaction;
    await txWait(network.name, tx);
    // call initialize() in the implementation conttract
    if (params.implInit) tx = await impl[params.initializer](...args);

    await txWait(network.name, tx);
  } else {
    impl = { address: implementationAddress };
  }

  proxy = deployProxyInternal(contractFactory, args, params, impl.address);

  return proxy;
}

async function myUpgradeProxy(proxyAddress, contractFactory) {
  const admin = await getProxyAdmin();

  const nextImpl = await contractFactory.deploy();
  await nextImpl.deployed();

  await admin.upgrade(proxyAddress, nextImpl.address);

  return contractFactory.attach(proxyAddress);
}

async function deployProxyWithConstructor(
  contractFactory,
  args,
  params,
  implementationAddress,
  constructorArguments
) {
  return await myDeployProxyWithConstructor(
    contractFactory,
    args,
    params,
    implementationAddress,
    constructorArguments
  );
}

async function deployProxy(
  contractFactory,
  args,
  params,
  implementationAddress
) {
  return await myDeployProxy(
    contractFactory,
    args,
    params,
    implementationAddress
  );
}

async function upgradeProxy(proxyAddress, contractFactory, params) {
  if (USE_HARDHAT_UPGRADES) {
    return await upgrades.upgradeProxy(proxyAddress, contractFactory, params);
  } else {
    return await myUpgradeProxy(proxyAddress, contractFactory, params);
  }
}

async function txWait(network, tx) {
  if (network != "hardhat" && network != "localhost") {
    await sleep(sleepTime);
    await tx.wait(blockSleep);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

async function msdEquityPerBlock(iMSD, MSDS) {
  let earning = rmul(
    await iMSD.totalBorrows(),
    await iMSD.borrowRatePerBlock()
  );
  let debt = rmul(
    await MSDS.totalSupply(),
    rmul(await MSDS.exchangeRateStored(), await MSDS.supplyRatePerBlock())
  );

  return earning.sub(debt);
}

// Calculate the collateral that can be liquidated with iToken
async function calcSeizeTokens(
  borrowiToken,
  collateral,
  controller,
  collateralExchangeRate,
  repayAmount,
  oracle
) {
  let liquidationIncentive = await controller.liquidationIncentiveMantissa();
  let valueRepayPlusIncentive = repayAmount
    .mul(await oracle.getUnderlyingPrice(borrowiToken.address))
    .mul(liquidationIncentive)
    .div(BASE);

  return valueRepayPlusIncentive
    .mul(BASE)
    .div(collateralExchangeRate)
    .div(await oracle.getUnderlyingPrice(collateral.address));
}

async function LOG(...args) {
  if (LOG_VERBOSE) {
    console.log(...args);
  }
}

async function getCurrentTime() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
}

// Get current chain id
async function getChainId() {
  return hre.network.provider.request({
    method: "eth_chainId",
    params: [],
  });
}

const permitData = (
  name,
  version,
  chainId,
  verifyingContract,
  owner,
  spender,
  value,
  nonce,
  deadline
) => ({
  primaryType: "Permit",
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "chainId", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  domain: { name, version, chainId, verifyingContract },
  message: { owner, spender, chainId, value, nonce, deadline },
});

async function permitSign(
  sender,
  name,
  version,
  chainId,
  verifyingContract,
  owner,
  spender,
  value,
  nonce,
  deadline
) {
  const data = permitData(
    name,
    version,
    chainId,
    verifyingContract,
    owner,
    spender,
    value,
    nonce,
    deadline
  );

  const signatureData = utils.splitSignature(await sender._signTypedData(data.domain, data.types, data.message));

  return {
    r:signatureData.r,
    s:signatureData.s,
    v:signatureData.v,
  }
}

module.exports = {
  // verifyOnlyOwner,
  // setOraclePrices,
  // parseTokenAmount,
  // formatTokenAmount,
  // formatToHumanReadable,
  // verifyAllowError,
  // deployProxyWithConstructor,
  deployProxy,
  deployMyProxy,
  // upgradeProxy,
  getProxyAdmin,
  // rmul,
  // rdiv,
  // divup,
  // rdivup,
  // sleep,
  // txWait,
  // msdEquityPerBlock,
  // calcSeizeTokens,
  // LOG,
  permitData,
  permitSign,
  getCurrentTime,
  getChainId,
};
