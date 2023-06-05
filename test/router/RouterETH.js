// Import necessary dependencies
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { permitSign, getCurrentTime, getChainId } = require("../helpers/utils");
const {
  loadFixture,
  fixtureDefault,
  deployAMMProtocol,
  createPair,
  addLiquidity,
  allocateTo,
} = require("../helpers/fixtures.js");

const utils = ethers.utils;
const zeroAddress = ethers.constants.AddressZero;
const MAX = ethers.constants.MaxUint256;
const ZERO = ethers.constants.Zero;
const ONE = utils.parseUnits("1", "wei");
const MINIMUM_LIQUIDITY = utils.parseUnits("1000", "wei");
const userAmount = utils.parseEther("1");
const allocate = utils.parseUnits("1000000", "wei");

const defaultVersion = "1";

// Describe the Router contract test cases
describe("Router", function () {
  let Router, VolatileRouter, StableRouter;
  let PairFactory;
  let USDT, USDC, USX, DAI, BUSD, DF, UNI, WBTC, HBTC, WETH;
  let swapPairs = [];

  let owner, creator, liquidityProvider, trader, user;
  let accounts;

  // await owner.provider.getBalance(owner.address);

  async function init() {
    ({
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
    } = await deployAMMProtocol());
    [owner, ...accounts] = await ethers.getSigners();

    creator = accounts[0];
    liquidityProvider = accounts[1];
    trader = accounts[2];
    user = accounts[3];

    let users = [creator, liquidityProvider, trader, user];
    users.map(async (account) => {
      await USDT.connect(account).approve(Router.address, MAX);
      await USDC.connect(account).approve(Router.address, MAX);
      await USX.connect(account).approve(Router.address, MAX);
      await DAI.connect(account).approve(Router.address, MAX);
      await BUSD.connect(account).approve(Router.address, MAX);
      await DF.connect(account).approve(Router.address, MAX);
      await UNI.connect(account).approve(Router.address, MAX);
      await WBTC.connect(account).approve(Router.address, MAX);
      await HBTC.connect(account).approve(Router.address, MAX);
    });

    accounts.map(async (account) => {
      await allocateTo(
        USDT,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await USDT.decimals()))
      );
      await allocateTo(
        USDC,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await USDC.decimals()))
      );
      await allocateTo(
        USX,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await USX.decimals()))
      );
      await allocateTo(
        DAI,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await DAI.decimals()))
      );
      await allocateTo(
        BUSD,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await BUSD.decimals()))
      );
      await allocateTo(
        DF,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await DF.decimals()))
      );
      await allocateTo(
        UNI,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await UNI.decimals()))
      );
      await allocateTo(
        WBTC,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await WBTC.decimals()))
      );
      await allocateTo(
        HBTC,
        account.address,
        allocate.mul(utils.parseUnits("10", "wei").pow(await HBTC.decimals()))
      );
    });
  }

  describe("Initialize data", function () {
    it("Initialize and check for data accuracy", async function () {
      await init();
      expect(await PairFactory.manager()).to.equal(owner.address);
      expect(await Router.factory()).to.equal(PairFactory.address);
      expect(await Router.weth()).to.equal(WETH.address);
      expect(await VolatileRouter.factory()).to.equal(PairFactory.address);
      expect(await VolatileRouter.weth()).to.equal(WETH.address);
      expect(await StableRouter.factory()).to.equal(PairFactory.address);
      expect(await StableRouter.weth()).to.equal(WETH.address);
    });
  });

  describe("VolatilePair: addLiquidityETH", function () {
    it("VolatilePair ETH: creator create a pair, minimum liquidity not reached, revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [ZERO, ZERO];
      const amountsMin = [ZERO, ZERO];
      const minLiquidity = ZERO;
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: ZERO }
        )
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("VolatilePair ETH: creator create a pair, invalid pair type revert", async function () {
      const sender = creator;
      const pairType = 3;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const amountsMin = [ZERO, ZERO];
      const minLiquidity = ZERO;

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("Router: invalid pair type");
    });

    it("VolatilePair ETH: creator created a pair without eth and add liquidity", async function () {
      const sender = creator;

      const pairType = 1;
      const tokenContracts = [USDT, USX];
      const tokens = [USDT.address, USX.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
      ];

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const pair = pairInfo[0];
      const pairContract = await ethers.getContractAt("VolatilePair", pair);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(ZERO);
      expect(amountsMin[1]).to.be.equal(ZERO);
      expect(minLiquidity).to.be.equal(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await Router.connect(sender).addLiquidityETH(
        pairType,
        tokens,
        amountDesireds,
        amountsMin,
        minLiquidity,
        receiver,
        deadline,
        { value: ethValue }
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }

      expect(await USDT.balanceOf(Router.address)).to.be.equal(ZERO);
      expect(await USX.balanceOf(Router.address)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair ETH: creator created a pair with eth and add liquidity, ETH amount is not enough revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const amountsMin = [ZERO, ZERO];
      const minLiquidity = ZERO;
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const pair = pairInfo[0];

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(addLiquidityInfo[0][0]).to.be.equal(ZERO);
      expect(addLiquidityInfo[0][1]).to.be.equal(ZERO);
      expect(addLiquidityInfo[1]).to.be.equal(ZERO);

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[1].sub(ONE) }
        )
      ).to.be.revertedWith("Address: low-level delegate call failed");
    });

    it("VolatilePair ETH: creator created a pair with eth and add liquidity", async function () {
      const sender = creator;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const pair = pairInfo[0];
      const pairContract = await ethers.getContractAt("VolatilePair", pair);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(ZERO);
      expect(amountsMin[1]).to.be.equal(ZERO);
      expect(minLiquidity).to.be.equal(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          amountDesireds[1].mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await pairContract.balanceOf(receiver)).to.be.equal(
        (await pairContract.totalSupply()).sub(MINIMUM_LIQUIDITY)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await pairContract.totalSupply()).to.be.gt(ZERO);
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, more ETH amount", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.mul(2) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          amountDesireds[1].mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeTotalSupply.add(minLiquidity)
      );
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.mul(2) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          amountDesireds[1].mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeTotalSupply.add(minLiquidity)
      );
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, expired revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) - 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const pairContract = await ethers.getContractAt("VolatilePair", pair);
      const beforeTotalSupply = await pairContract.totalSupply();

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(addLiquidityInfo[0][0]).to.be.equal(amountDesireds[0]);
      expect(addLiquidityInfo[0][1]).to.be.equal(amountDesireds[1]);
      expect(addLiquidityInfo[1]).to.be.gt(ZERO);

      const amountsMin = addLiquidityInfo[0];
      const minLiquidity = addLiquidityInfo[1];

      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: EXPIRED");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, amountsMin > amountDesireds revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(addLiquidityInfo[0][0]).to.be.equal(amountDesireds[0]);
      expect(addLiquidityInfo[0][1]).to.be.equal(amountDesireds[1]);
      expect(addLiquidityInfo[1]).to.be.gt(ZERO);

      const minLiquidity = addLiquidityInfo[1];
      let amountsMin = [];
      amountsMin.push(addLiquidityInfo[0][0].add(ONE));
      amountsMin.push(addLiquidityInfo[0][1]);

      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: token[0] desired invalid");

      amountsMin = [];
      amountsMin.push(addLiquidityInfo[0][0]);
      amountsMin.push(addLiquidityInfo[0][1].add(ONE));
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: token[1] desired invalid");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, minLiquidity > desired liquidity revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(addLiquidityInfo[0][0]).to.be.equal(amountDesireds[0]);
      expect(addLiquidityInfo[0][1]).to.be.equal(amountDesireds[1]);
      expect(addLiquidityInfo[1]).to.be.gt(ZERO);

      const amountsMin = addLiquidityInfo[0];
      const minLiquidity = addLiquidityInfo[1].add(ONE);

      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: Couldn't mint min requested");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, INSUFFICIENT_B_AMOUNT revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.11", 18),
      ];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(addLiquidityInfo[1]).to.be.gt(ZERO);

      let amountsMin = [];
      amountsMin.push(addLiquidityInfo[0][0]);
      amountsMin.push(addLiquidityInfo[0][1].add(ONE));
      const minLiquidity = addLiquidityInfo[1];

      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: INSUFFICIENT_B_AMOUNT");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, INSUFFICIENT_A_AMOUNT revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("0.01", 18),
      ];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(addLiquidityInfo[1]).to.be.gt(ZERO);

      let amountsMin = [];
      amountsMin.push(addLiquidityInfo[0][0].add(ONE));
      amountsMin.push(addLiquidityInfo[0][1]);
      const minLiquidity = addLiquidityInfo[1];

      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatileRouter: INSUFFICIENT_A_AMOUNT");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair with insufficient liquidity minted should revert", async function () {
      const pairType = 1;
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [ONE, ONE];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      // Ensure the pair exists
      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      // Get the minimum amounts of tokens to be received
      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      const amountsMin = addLiquidityInfo[0];
      const minLiquidity = addLiquidityInfo[1];

      // Ensure that the minimum liquidity is zero
      expect(addLiquidityInfo[1]).to.be.equal(ZERO);

      // Ensure that adding liquidity with these parameters reverts with the correct error message
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountsMin[1].add(amountsMin[1]) }
        )
      ).to.be.revertedWith("VolatilePair: INSUFFICIENT_LIQUIDITY_MINTED");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity for pair with only one token revert", async function () {
      const pairType = 1;
      const tokens = [WETH.address];
      const amountDesireds = [utils.parseUnits("1", 18)];
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      // Get the minimum amounts of tokens to be received
      const addLiquidityInfo = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      const amountsMin = addLiquidityInfo[0];
      const minLiquidity = addLiquidityInfo[1];

      // Ensure that the minimum liquidity is zero
      expect(addLiquidityInfo[1]).to.be.equal(ZERO);

      // Ensure that adding liquidity with these parameters reverts with the correct error message
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[0].add(amountDesireds[0]) }
        )
      ).to.be.revertedWith("Address: low-level delegate call failed");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity for pair with two tokens, one amount revert", async function () {
      const pairType = 1;
      const tokens = [WETH.address, USDC.address];
      const amountDesireds = [utils.parseUnits("1", 18)];
      const amountsMin = amountDesireds;
      const minLiquidity = ZERO;
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      // Ensure the pair exists
      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      // Ensure that adding liquidity with these parameters reverts with the correct error message
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[0].add(amountDesireds[0]) }
        )
      ).to.be.revertedWith("Address: low-level delegate call failed");
    });

    it("VolatilePair ETH: liquidityProvider add liquidity for pair with only one token, two amount revert", async function () {
      const pairType = 1;
      const tokens = [WETH.address];
      const amountDesireds = [
        utils.parseUnits("1", 18),
        utils.parseUnits("100", 6),
      ];
      const amountsMin = amountDesireds;
      const minLiquidity = ZERO;
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      // Ensure that adding liquidity with these parameters reverts with the correct error message
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[0].add(amountDesireds[0]) }
        )
      ).to.be.revertedWith(
        "VolatilePair: This type of pair must have only two tokens when created"
      );
    });

    it("VolatilePair ETH: liquidityProvider add liquidity for pair with multiple token revert", async function () {
      const pairType = 1;
      const tokens = [USDT.address, USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 6),
        utils.parseUnits("0.1", 18),
      ];
      const amountsMin = amountDesireds;
      const minLiquidity = ZERO;
      const to = liquidityProvider.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      // Ensure that adding liquidity with these parameters reverts with the correct error message
      await expect(
        Router.connect(liquidityProvider).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[2].add(amountDesireds[2]) }
        )
      ).to.be.revertedWith(
        "VolatilePair: This type of pair must have only two tokens when created"
      );
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair with sufficient amounts", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("7588", 6),
        utils.parseUnits("20", 18),
      ];

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.mul(2) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          amountsMin[1].mul(-1),
          sender.address == receiver ? amountsMin[1].mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountsMin[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeTotalSupply.add(minLiquidity)
      );
    });

    it("VolatilePair ETH: liquidityProvider add liquidity to pair, without value", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDT, USX];
      const tokens = [USDT.address, USX.address];
      const amountDesireds = [
        utils.parseUnits("7588", 6),
        utils.parseUnits("458", 18),
      ];

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, ZERO, ZERO, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountsMin[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeTotalSupply.add(minLiquidity)
      );
    });
  });

  describe("StablePair: addLiquidityETH", function () {
    it("StablePair ETH: creator add liquidity to pair with zero amount, revert", async function () {
      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const pair = await createPair(PairFactory, tokens, pairType);

      const amountDesireds = [ZERO, ZERO, ZERO];
      const amountsMin = [ZERO, ZERO, ZERO];
      const minLiquidity = ZERO;
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[2] }
        )
      ).to.be.revertedWith("Must supply all tokens in pool");
    });

    it("StablePair ETH: creator add liquidity to pair with a zero amount of token, revert", async function () {
      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const pair = await createPair(PairFactory, tokens, pairType);

      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
        ZERO,
      ];
      const amountsMin = amountDesireds;
      const minLiquidity = ZERO;
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[2] }
        )
      ).to.be.revertedWith("Must supply all tokens in pool");
    });

    it("StablePair ETH: creator add liquidity to pair with eth ", async function () {
      const sender = creator;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
        utils.parseUnits("1", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidity).to.be.gt(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(await LPToken.totalSupply())
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
        utils.parseUnits("1", 18),
      ];
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidity).to.be.gt(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLpTotalSupply.add(minLiquidity)
      );
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, more ETH amount", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("200", 6),
        utils.parseUnits("0.8", 18),
        utils.parseUnits("10", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.add(ethValue) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.gt(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, invalid param", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("100", 18),
        utils.parseUnits("0.06", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMinDesireds, minLiquidityDesired] =
        await Router.quoteAddLiquidity(pairType, tokens, amountDesireds);

      expect(amountsMinDesireds[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMinDesireds[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMinDesireds[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const amountsMin = [
        amountsMinDesireds[0].mul(2),
        amountsMinDesireds[1].mul(2),
        amountsMinDesireds[2].mul(2),
      ];

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.add(ethValue) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.gt(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, small amount", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [ONE, ZERO, ZERO];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.add(ethValue) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.gt(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, ETH amount is not enough revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("0.8", 18),
        utils.parseUnits("0.06", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.sub(ONE) }
        )
      ).to.be.revertedWith("Address: low-level delegate call failed");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, expired revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("0.8", 18),
        utils.parseUnits("0.06", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) - 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("StablePair: Deadline not met");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, minLiquidity > desired liquidity revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("0.8", 18),
        utils.parseUnits("0.06", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.add(ONE);

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("Couldn't mint min requested");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair with insufficient liquidity minted should revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [ZERO, ZERO, ZERO];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.equal(ZERO);

      const minLiquidity = ZERO;

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("D should increase");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, very small amount revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [ZERO, ONE, ZERO];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.equal(ZERO);

      const minLiquidity = ZERO;

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("LPToken: cannot mint 0");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, one less amount revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, WETH.address, USX.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("0.8", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.equal(ZERO);

      const minLiquidity = ZERO;

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("Address: low-level delegate call failed");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair, one more amount revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, WETH.address, USX.address];
      const amountDesireds = [
        utils.parseUnits("20", 6),
        utils.parseUnits("0.08", 18),
        utils.parseUnits("0.8", 18),
        utils.parseUnits("0.8", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.equal(ZERO);

      const minLiquidity = ZERO;

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("Amounts must match pooled tokens");
    });

    it("StablePair ETH: liquidityProvider add liquidity to pair with sufficient amounts", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amountDesireds = [
        utils.parseUnits("1", 6),
        utils.parseUnits("50", 18),
        utils.parseUnits("100", 18),
      ];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountDesireds[tokens.indexOf(WETH.address)];

      const pair = await createPair(PairFactory, tokens, pairType);
      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );

      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(receiver);

      const [amountsMin, minLiquidityDesired] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );

      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidityDesired).to.be.gt(ZERO);

      const minLiquidity = minLiquidityDesired.mul(99).div(100);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(sender).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          receiver,
          deadline,
          { value: ethValue.add(ethValue) }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [
          ZERO,
          ethValue.mul(-1),
          sender.address == receiver ? ethValue.mul(-1) : ZERO,
          ZERO,
        ]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        if (sender.address == receiver) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver].sub(userChange)
          );
        } else {
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address].sub(userChange)
          );
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
        }

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(receiver)).to.be.gt(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: creator add liquidity to pair without eth", async function () {
      const pairType = 2;
      const tokenContracts = [USDT, USX, USDC];
      const tokens = [USDT.address, USX.address, USDC.address];
      const pair = await createPair(PairFactory, tokens, pairType);

      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
        utils.parseUnits("1", 6),
      ];
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );
      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(to);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidity).to.be.gt(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][to] = await token.balanceOf(to);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline,
          { value: amountDesireds[2] }
        )
      ).to.changeEtherBalances(
        [Router.address, creator, pair],
        [ZERO, ZERO, ZERO]
      );
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        expect(await token.balanceOf(to)).to.be.equal(
          before[token.address][to].sub(userChange)
        );
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(to)).to.be.equal(
        beforeUserLp.add(await LPToken.totalSupply())
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.gt(beforeLpTotalSupply);
    });

    it("StablePair ETH: creator add liquidity to pair without eth and without value", async function () {
      const pairType = 2;
      const tokenContracts = [USDT, USX, USDC];
      const tokens = [USDT.address, USX.address, USDC.address];
      const pair = await createPair(PairFactory, tokens, pairType);

      const amountDesireds = [
        utils.parseUnits("100", 6),
        utils.parseUnits("100", 18),
        utils.parseUnits("1", 6),
      ];
      const to = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairContract = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await pairContract.lpToken()
      );
      const beforeLpTotalSupply = await LPToken.totalSupply();
      const beforeUserLp = await LPToken.balanceOf(to);

      const [amountsMin, minLiquidity] = await Router.quoteAddLiquidity(
        pairType,
        tokens,
        amountDesireds
      );
      expect(amountsMin[0]).to.be.equal(amountDesireds[0]);
      expect(amountsMin[1]).to.be.equal(amountDesireds[1]);
      expect(amountsMin[2]).to.be.equal(amountDesireds[2]);
      expect(minLiquidity).to.be.gt(ZERO);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][to] = await token.balanceOf(to);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      await expect(
        Router.connect(creator).addLiquidityETH(
          pairType,
          tokens,
          amountDesireds,
          amountsMin,
          minLiquidity,
          to,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, creator, pair],
        [ZERO, ZERO, ZERO]
      );
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        let userChange = amountDesireds[index];
        if (token.address == WETH.address) userChange = ZERO;

        expect(await token.balanceOf(to)).to.be.equal(
          before[token.address][to].sub(userChange)
        );
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].add(amountDesireds[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);
      }
      expect(await LPToken.balanceOf(to)).to.be.equal(
        beforeUserLp.add(minLiquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLpTotalSupply.add(minLiquidity)
      );
    });
  });

  describe("Router: swapETH", function () {
    it("Router: init pairs and liquidity", async function () {
      const sender = creator;

      const pairTypes = [1, 1, 1, 2, 2, 1, 1];
      const tokens = [
        [USX.address, DF.address],
        [WETH.address, USDT.address],
        [WBTC.address, USDT.address],
        [USX.address, USDT.address, USDC.address, DAI.address],
        [WBTC.address, HBTC.address],
        [WBTC.address, USX.address],
        [WBTC.address, WETH.address],
      ];
      const amounts = [
        [utils.parseUnits("6000", 18), utils.parseUnits("100000", 18)],
        [utils.parseUnits("34", 18), utils.parseUnits("100000", 6)],
        [utils.parseUnits("3", 8), utils.parseUnits("100000", 6)],
        [
          utils.parseUnits("100000", 18),
          utils.parseUnits("100000", 6),
          utils.parseUnits("100000", 6),
          utils.parseUnits("100000", 18),
        ],
        [utils.parseUnits("100", 8), utils.parseUnits("100", 18)],
        [utils.parseUnits("3", 8), utils.parseUnits("100000", 18)],
        [utils.parseUnits("10", 8), utils.parseUnits("150", 18)],
      ];

      for (let index = 0; index < pairTypes.length; index++) {
        swapPairs.push(
          await addLiquidity(
            sender,
            PairFactory,
            Router,
            pairTypes[index],
            tokens[index],
            amounts[index]
          )
        );
      }
    });

    it("swapETH: trader makes a swap, amountOutMin > received actually revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = DF;
      const toToken = WETH;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[1]];

      const routes = [
        { from: DF.address, to: USX.address, pair: swapPairs[0] },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
      ];
      const amountIn = userAmount;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOutMin = amountsOutPath[amountsOutPath.length - 1];

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin.add(ONE),
          receiver,
          deadline
        )
      ).to.be.revertedWith("Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("swapETH: trader makes a swap, is not VolatilePair revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = DF;
      const toToken = WETH;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[1]];

      const routes = [
        { from: DF.address, to: USX.address, pair: USX.address },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
      ];
      const amountIn = userAmount.mul(100);
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline
        )
      ).to.be.reverted;
    });

    it("swapETH: trader makes a swap, is not StablePair revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = DF;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[0]];

      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: USX.address, pair: USX.address },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.reverted;
    });

    it("swapETH: trader makes a swap, VolatileRouter expired revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = DF;
      const toToken = WETH;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[1]];

      const routes = [
        { from: DF.address, to: USX.address, pair: swapPairs[0] },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) - 300;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("VolatileRouter: EXPIRED");
    });

    it("swapETH: trader makes a swap, StableRouter expired revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USDT;
      const toToken = DF;
      const pairs = [swapPairs[3], swapPairs[0]];

      const routes = [
        { from: USDT.address, to: USX.address, pair: swapPairs[3] },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = utils.parseUnits("100", 6);
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) - 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("StablePair: Deadline not met");
    });

    it("swapETH: trader makes a swap, VolatileRouter amountIn = 0 revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = DF;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[0]];

      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: USX.address, pair: USX.address },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = ZERO;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("VolatilePair: INSUFFICIENT_INPUT_AMOUNT");
    });

    it("swapETH: trader makes a swap, StableRouter amountIn = 0 revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = HBTC;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[2], swapPairs[4]];

      const routes = [
        // { from: DF.address, to: USX.address, pair: swapPairs[0] },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
        { from: WBTC.address, to: HBTC.address, pair: swapPairs[4] },
      ];
      const amountIn = ZERO;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("swapETH: trader makes a swap, amountIn != value revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = DF;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[0]];

      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: USX.address, pair: swapPairs[3] },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue.add(ONE) }
        )
      ).to.be.revertedWith("Router: msg.value is not equal to _amountIn");
    });

    it("swapETH: trader makes a swap, amountIn > trader balance revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = DF;
      const toToken = HBTC;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[2], swapPairs[4]];

      const routes = [
        { from: DF.address, to: USX.address, pair: swapPairs[0] },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
        { from: WBTC.address, to: HBTC.address, pair: swapPairs[4] },
      ];
      const amountIn = await DF.balanceOf(sender.address);
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn.add(ONE),
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("swapETH: trader makes a swap, insufficient approval revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = HBTC;
      const pairs = [swapPairs[0], swapPairs[3], swapPairs[2], swapPairs[4]];

      const routes = [
        // { from: DF.address, to: USX.address, pair: swapPairs[0] },
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
        { from: WBTC.address, to: HBTC.address, pair: swapPairs[4] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await fromToken
        .connect(sender)
        .approve(Router.address, amountIn.sub(ONE));

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ZERO }
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");

      await fromToken.connect(sender).approve(Router.address, MAX);
    });

    it("swapETH: trader makes a swap, very small amount revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = WBTC;
      const pairs = [swapPairs[3]];
      const routes = [
        { from: USX.address, to: WBTC.address, pair: swapPairs[5] },
      ];
      const amountIn = ONE;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline
        )
      ).to.revertedWith("VolatilePair: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("swapETH: trader makes a ERC20 swap , with value revert", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = WBTC;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[6]];

      const routes = [
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
        { from: WETH.address, to: WBTC.address, pair: swapPairs[6] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = userAmount;

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.revertedWith("Router: msg.value is not equal to 0");
    });

    it("swapETH: trader makes a swap", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = DF;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[0]];

      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: USX.address, pair: swapPairs[3] },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH) {
          receiverChangeETH = senderChangeETH;
        }

        if (toToken == WETH) {
          senderChangeETH = receiverChangeETH;
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    it("swapETH: trader makes a swap, receiver is creator", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = DF;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[0]];

      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: USX.address, pair: swapPairs[3] },
        { from: USX.address, to: DF.address, pair: swapPairs[0] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH) {
          receiverChangeETH = senderChangeETH;
        }

        if (toToken == WETH) {
          senderChangeETH = receiverChangeETH;
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    it("swapETH: trader makes a swap, WETH in the middle", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = WBTC;
      const pairs = [swapPairs[1], swapPairs[3], swapPairs[6]];

      const routes = [
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
        { from: WETH.address, to: WBTC.address, pair: swapPairs[6] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH) {
          receiverChangeETH = senderChangeETH;
        }

        if (toToken == WETH) {
          senderChangeETH = receiverChangeETH;
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    it("swapETH: trader makes a swap, receive ETH", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = WETH;
      const pairs = [swapPairs[3], swapPairs[1]];

      const routes = [
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH) {
          receiverChangeETH = senderChangeETH;
        }

        if (toToken == WETH) {
          senderChangeETH = receiverChangeETH;
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    it("swapETH: trader makes a swap, fromToken = toToken", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = USX;
      const toToken = USX;
      const pairs = [swapPairs[3], swapPairs[2], swapPairs[5]];
      const routes = [
        { from: USX.address, to: USDT.address, pair: swapPairs[3] },
        { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
        { from: WBTC.address, to: USX.address, pair: swapPairs[5] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH) {
          receiverChangeETH = senderChangeETH;
        }

        if (toToken == WETH) {
          senderChangeETH = receiverChangeETH;
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    it("swapETH: trader makes a swap, fromToken = toToken(WETH)", async function () {
      const sender = trader;

      //   0.[USX.address, DF.address]
      //   1.[WETH.address, USDT.address]
      //   2.[WBTC.address, USDT.address]
      //   3.[USX.address, USDT.address, USDC.address, DAI.address]
      //   4.[WBTC.address, HBTC.address]
      //   5.[WBTC.address, USX.address]
      //   6.[WBTC.address, WETH.address]

      const fromToken = WETH;
      const toToken = WETH;
      const pairs = [swapPairs[1], swapPairs[2], swapPairs[6]];
      const routes = [
        { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
        { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
        { from: WBTC.address, to: WETH.address, pair: swapPairs[6] },
      ];
      const amountIn = userAmount;
      const amountOutMin = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const ethValue = fromToken == WETH ? amountIn : ZERO;

      let before = {};
      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        before[route.from] = {};
        before[route.from][sender.address] = await fromContract.balanceOf(
          sender.address
        );
        before[route.from][receiver] = await fromContract.balanceOf(receiver);

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        before[route.to] = {};
        before[route.to][sender.address] = await toContract.balanceOf(
          sender.address
        );
        before[route.to][receiver] = await toContract.balanceOf(receiver);

        for (let index = 0; index < pairs.length; index++) {
          const pair = pairs[index];
          before[route.from][pair] = await fromContract.balanceOf(pair);
          before[route.to][pair] = await toContract.balanceOf(pair);
        }
      }

      const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
      const amountOut = amountsOutPath[amountsOutPath.length - 1];
      let senderChangeETH = ethValue.mul(-1);
      let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

      if (sender.address == receiver) {
        if (fromToken == WETH && fromToken == toToken) {
          senderChangeETH = receiverChangeETH.add(senderChangeETH);
          receiverChangeETH = senderChangeETH;
        } else {
          if (fromToken == WETH) {
            receiverChangeETH = senderChangeETH;
          }

          if (toToken == WETH) {
            senderChangeETH = receiverChangeETH;
          }
        }
      }

      await expect(
        Router.connect(sender).swapETH(
          routes,
          amountIn,
          amountOutMin,
          receiver,
          deadline,
          { value: ethValue }
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver],
        [ZERO, senderChangeETH, receiverChangeETH]
      );

      for (let index = 0; index < routes.length; index++) {
        const route = routes[index];

        const fromContract = await ethers.getContractAt(
          "IPairERC20",
          route.from
        );
        expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await fromContract.balanceOf(route.pair)).to.be.equal(
          before[route.from][route.pair].add(amountsOutPath[index])
        );

        let amountSend = amountIn;
        let amountReceive = amountOut;
        if (fromToken == toToken) {
          amountSend = amountIn.sub(amountOut);
          amountReceive = amountOut.sub(amountIn);
        }

        if (index == 0 && route.from != WETH.address) {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address].sub(amountSend)
          );
          if (sender.address != receiver)
            expect(await fromContract.balanceOf(receiver)).to.be.equal(
              before[route.from][receiver]
            );
        } else {
          expect(await fromContract.balanceOf(sender.address)).to.be.equal(
            before[route.from][sender.address]
          );
          expect(await fromContract.balanceOf(receiver)).to.be.equal(
            before[route.from][receiver]
          );
        }

        const toContract = await ethers.getContractAt("IPairERC20", route.to);
        expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await toContract.balanceOf(route.pair)).to.be.equal(
          before[route.to][route.pair].sub(amountsOutPath[index + 1])
        );

        if (index + 1 == routes.length && route.to != WETH.address) {
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver].add(amountReceive)
          );

          if (sender.address != receiver)
            expect(await toContract.balanceOf(sender.address)).to.be.equal(
              before[route.to][sender.address]
            );
        } else {
          expect(await toContract.balanceOf(sender.address)).to.be.equal(
            before[route.to][sender.address]
          );
          expect(await toContract.balanceOf(receiver)).to.be.equal(
            before[route.to][receiver]
          );
        }
      }
    });

    // it("swapETH: trader makes a ERC20 swap , with value", async function () {
    //   const sender = trader;

    //   //   0.[USX.address, DF.address]
    //   //   1.[WETH.address, USDT.address]
    //   //   2.[WBTC.address, USDT.address]
    //   //   3.[USX.address, USDT.address, USDC.address, DAI.address]
    //   //   4.[WBTC.address, HBTC.address]
    //   //   5.[WBTC.address, USX.address]
    //   //   6.[WBTC.address, WETH.address]

    //   const fromToken = USX;
    //   const toToken = WBTC;
    //   const pairs = [swapPairs[1], swapPairs[3], swapPairs[6]];

    //   const routes = [
    //     { from: USX.address, to: USDT.address, pair: swapPairs[3] },
    //     { from: USDT.address, to: WETH.address, pair: swapPairs[1] },
    //     { from: WETH.address, to: WBTC.address, pair: swapPairs[6] },
    //   ];
    //   const amountIn = userAmount;
    //   const amountOutMin = ZERO;
    //   const receiver = sender.address;
    //   const deadline = (await getCurrentTime()) + 300;

    //   const ethValue = userAmount;

    //   let before = {};
    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     before[route.from] = {};
    //     before[route.from][sender.address] = await fromContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.from][receiver] = await fromContract.balanceOf(receiver);

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     before[route.to] = {};
    //     before[route.to][sender.address] = await toContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.to][receiver] = await toContract.balanceOf(receiver);

    //     for (let index = 0; index < pairs.length; index++) {
    //       const pair = pairs[index];
    //       before[route.from][pair] = await fromContract.balanceOf(pair);
    //       before[route.to][pair] = await toContract.balanceOf(pair);
    //     }
    //   }

    //   const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
    //   const amountOut = amountsOutPath[amountsOutPath.length - 1];
    //   let senderChangeETH = ethValue.mul(-1);
    //   let receiverChangeETH = senderChangeETH;

    //   if (sender.address == receiver) {
    //     if (fromToken == WETH && fromToken == toToken) {
    //       senderChangeETH = receiverChangeETH.add(senderChangeETH);
    //       receiverChangeETH = senderChangeETH;
    //     } else {
    //       if (fromToken == WETH) {
    //         receiverChangeETH = senderChangeETH;
    //       }

    //       if (toToken == WETH) {
    //         senderChangeETH = receiverChangeETH;
    //       }
    //     }
    //   }

    //   await expect(
    //     Router.connect(sender).swapETH(
    //       routes,
    //       amountIn,
    //       amountOutMin,
    //       receiver,
    //       deadline,
    //       { value: ethValue }
    //     )
    //   ).to.changeEtherBalances(
    //     [Router.address, sender, receiver],
    //     [ethValue, senderChangeETH, receiverChangeETH]
    //   );

    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await fromContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.from][route.pair].add(amountsOutPath[index])
    //     );

    //     let amountSend = amountIn;
    //     let amountReceive = amountOut;
    //     if (fromToken == toToken) {
    //       amountSend = amountIn.sub(amountOut);
    //       amountReceive = amountOut.sub(amountIn);
    //     }

    //     if (index == 0 && route.from != WETH.address) {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address].sub(amountSend)
    //       );
    //       if (sender.address != receiver)
    //         expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //           before[route.from][receiver]
    //         );
    //     } else {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address]
    //       );
    //       expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //         before[route.from][receiver]
    //       );
    //     }

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await toContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.to][route.pair].sub(amountsOutPath[index + 1])
    //     );

    //     if (index + 1 == routes.length && route.to != WETH.address) {
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver].add(amountReceive)
    //       );

    //       if (sender.address != receiver)
    //         expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //           before[route.to][sender.address]
    //         );
    //     } else {
    //       expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.to][sender.address]
    //       );
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver]
    //       );
    //     }
    //   }
    // });

    // it("swapETH: trader makes a swap, and receiver is creator", async function () {
    //   const sender = trader;

    //   //   0.[USX.address, DF.address]
    //   //   1.[WETH.address, USDT.address]
    //   //   2.[WBTC.address, USDT.address]
    //   //   3.[USX.address, USDT.address, USDC.address, DAI.address]
    //   //   4.[WBTC.address, HBTC.address]
    //   //   5.[WBTC.address, USX.address]
    //   6.[WBTC.address, WETH.address]

    //   const fromToken = DF;
    //   const toToken = HBTC;
    //   const pairs = [swapPairs[0], swapPairs[3], swapPairs[2], swapPairs[4]];
    //   const routes = [
    //     { from: DF.address, to: USX.address, pair: swapPairs[0] },
    //     { from: USX.address, to: USDT.address, pair: swapPairs[3] },
    //     { from: USDT.address, to: WBTC.address, pair: swapPairs[2] },
    //     { from: WBTC.address, to: HBTC.address, pair: swapPairs[4] },
    //   ];
    //   const amountIn = userAmount;
    //   const amountOutMin = ZERO;
    //   const receiver = creator.address;
    //   const deadline = (await getCurrentTime()) + 300;

    //   const ethValue = fromToken == WETH ? amountIn : ZERO;

    //   let before = {};
    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     before[route.from] = {};
    //     before[route.from][sender.address] = await fromContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.from][receiver] = await fromContract.balanceOf(receiver);

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     before[route.to] = {};
    //     before[route.to][sender.address] = await toContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.to][receiver] = await toContract.balanceOf(receiver);

    //     for (let index = 0; index < pairs.length; index++) {
    //       const pair = pairs[index];
    //       before[route.from][pair] = await fromContract.balanceOf(pair);
    //       before[route.to][pair] = await toContract.balanceOf(pair);
    //     }
    //   }

    //   const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
    //   const amountOut = amountsOutPath[amountsOutPath.length - 1];
    //   let senderChangeETH = ethValue.mul(-1);
    //   let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

    //   if (sender.address == receiver) {
    //     if (fromToken == WETH) {
    //       receiverChangeETH = senderChangeETH;
    //     }

    //     if (toToken == WETH) {
    //       senderChangeETH = receiverChangeETH;
    //     }
    //   }

    //   await expect(
    //     Router.connect(sender).swapETH(
    //       routes,
    //       amountIn,
    //       amountOutMin,
    //       receiver,
    //       deadline
    //     )
    //   ).to.changeEtherBalances(
    //     [Router.address, sender, receiver],
    //     [ZERO, senderChangeETH, receiverChangeETH]
    //   );

    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await fromContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.from][route.pair].add(amountsOutPath[index])
    //     );

    //     let amountSend = amountIn;
    //     let amountReceive = amountOut;
    //     if (fromToken == toToken) {
    //       amountSend = amountIn.sub(amountOut);
    //       amountReceive = amountOut.sub(amountIn);
    //     }

    //     if (index == 0 && route.from != WETH.address) {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address].sub(amountSend)
    //       );
    //       if (sender.address != receiver)
    //         expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //           before[route.from][receiver]
    //         );
    //     } else {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address]
    //       );
    //       expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //         before[route.from][receiver]
    //       );
    //     }

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await toContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.to][route.pair].sub(amountsOutPath[index + 1])
    //     );

    //     if (index + 1 == routes.length && route.to != WETH.address) {
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver].add(amountReceive)
    //       );

    //       if (sender.address != receiver)
    //         expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //           before[route.to][sender.address]
    //         );
    //     } else {
    //       expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.to][sender.address]
    //       );
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver]
    //       );
    //     }
    //   }
    // });

    // it("swapETH: trader makes a swap, and receiver is creator", async function () {
    //   const sender = trader;

    //   //   0.[USX.address, DF.address]
    //   //   1.[WETH.address, USDT.address]
    //   //   2.[WBTC.address, USDT.address]
    //   //   3.[USX.address, USDT.address, USDC.address, DAI.address]
    //   //   4.[WBTC.address, HBTC.address]
    //   //   5.[WBTC.address, USX.address]
    //   6.[WBTC.address, WETH.address]

    //   const fromToken = WETH;
    //   const toToken = USDT;
    //   const pairs = [swapPairs[1]];
    //   const routes = [
    //     { from: WETH.address, to: USDT.address, pair: swapPairs[1] },
    //   ];
    //   const amountIn = utils.parseUnits("1", 18);
    //   const amountOutMin = ZERO;
    //   const receiver = creator.address;
    //   const deadline = (await getCurrentTime()) + 300;

    //   const ethValue = fromToken == WETH ? amountIn : ZERO;

    //   let before = {};
    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     before[route.from] = {};
    //     before[route.from][sender.address] = await fromContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.from][receiver] = await fromContract.balanceOf(receiver);

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     before[route.to] = {};
    //     before[route.to][sender.address] = await toContract.balanceOf(
    //       sender.address
    //     );
    //     before[route.to][receiver] = await toContract.balanceOf(receiver);

    //     for (let index = 0; index < pairs.length; index++) {
    //       const pair = pairs[index];
    //       before[route.from][pair] = await fromContract.balanceOf(pair);
    //       before[route.to][pair] = await toContract.balanceOf(pair);
    //     }
    //   }

    //   const amountsOutPath = await Router.getAmountsOutPath(amountIn, routes);
    //   const amountOut = amountsOutPath[amountsOutPath.length - 1];
    //   let senderChangeETH = ethValue.mul(-1);
    //   let receiverChangeETH = toToken == WETH ? amountOut : ZERO;

    //   if (sender.address == receiver) {
    //     if (fromToken == WETH) {
    //       receiverChangeETH = senderChangeETH;
    //     }

    //     if (toToken == WETH) {
    //       senderChangeETH = receiverChangeETH;
    //     }
    //   }

    //   await expect(
    //     Router.connect(sender).swapETH(
    //       routes,
    //       amountIn,
    //       amountOutMin,
    //       receiver,
    //       deadline,
    //       { value: ethValue }
    //     )
    //   ).to.changeEtherBalances(
    //     [Router.address, sender, receiver],
    //     [ZERO, senderChangeETH, receiverChangeETH]
    //   );

    //   for (let index = 0; index < routes.length; index++) {
    //     const route = routes[index];

    //     const fromContract = await ethers.getContractAt(
    //       "IPairERC20",
    //       route.from
    //     );
    //     expect(await fromContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await fromContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.from][route.pair].add(amountsOutPath[index])
    //     );

    //     let amountSend = amountIn;
    //     let amountReceive = amountOut;
    //     if (fromToken == toToken) {
    //       amountSend = amountIn.sub(amountOut);
    //       amountReceive = amountOut.sub(amountIn);
    //     }

    //     if (index == 0 && route.from != WETH.address) {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address].sub(amountSend)
    //       );
    //       if (sender.address != receiver)
    //         expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //           before[route.from][receiver]
    //         );
    //     } else {
    //       expect(await fromContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.from][sender.address]
    //       );
    //       expect(await fromContract.balanceOf(receiver)).to.be.equal(
    //         before[route.from][receiver]
    //       );
    //     }

    //     const toContract = await ethers.getContractAt("IPairERC20", route.to);
    //     expect(await toContract.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await toContract.balanceOf(route.pair)).to.be.equal(
    //       before[route.to][route.pair].sub(amountsOutPath[index + 1])
    //     );

    //     if (index + 1 == routes.length && route.to != WETH.address) {
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver].add(amountReceive)
    //       );

    //       if (sender.address != receiver)
    //         expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //           before[route.to][sender.address]
    //         );
    //     } else {
    //       expect(await toContract.balanceOf(sender.address)).to.be.equal(
    //         before[route.to][sender.address]
    //       );
    //       expect(await toContract.balanceOf(receiver)).to.be.equal(
    //         before[route.to][receiver]
    //       );
    //     }
    //   }
    // });
  });

  describe("VolatilePair: removeLiquidityETH", function () {
    it("VolatilePair ETH: creator remove liquidity, amountsMin exceeded revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const removeLiquidityInfo = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      let amountsMin = [];

      for (let index = 0; index < removeLiquidityInfo.length; index++) {
        const item = removeLiquidityInfo[index];
        amountsMin.push(item.add(ONE));
      }

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("VolatileRouter: _amount < _amountsMin");
    });

    it("VolatilePair ETH: creator remove liquidity non-existing pair, revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDT.address, UNI.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const pair = pairInfo[0];

      const liquidity = userAmount;
      const removeLiquidityInfo = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const amountsMin = removeLiquidityInfo;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("VolatileRouter: is not pair");
    });

    it("VolatilePair ETH: creator remove liquidity, expired revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = await getCurrentTime();

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.revertedWith("VolatileRouter: EXPIRED");
    });

    it("VolatilePair ETH: creator remove liquidity, invalid pair type revert", async function () {
      const sender = creator;

      const pairType = 3;
      const tokens = [USDC.address, WETH.address];
      const liquidity = userAmount;
      const amountsMin = [ZERO, ZERO];
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("Router: invalid pair type");
    });

    it("VolatilePair ETH: creator remove all liquidity", async function () {
      const sender = creator;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair ETH: liquidityProvider remove half of liquidity, insufficient approval revert", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      await LPToken.connect(sender).approve(Router.address, liquidity.div(2));
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("VolatilePair ETH: liquidityProvider remove half of liquidity", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair ETH: liquidityProvider remove half of liquidity, out of order token", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [WETH, USDC];
      const tokens = [WETH.address, USDC.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair ETH: liquidityProvider remove half of liquidity, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair ETH: liquidityProvider remove half of liquidity, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          { value: ZERO }
        );
      } catch (error) {
        errorFalg = true;
      }

      expect(errorFalg).to.be.equal(true);
    });
  });

  describe("VolatilePair: removeLiquidityETHWithPermit", function () {
    it("VolatilePair Permit ETH: creator remove liquidity, expired revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) - 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.revertedWith("PairERC20: EXPIRED");
    });

    it("VolatilePair Permit ETH: creator remove liquidity, sender nonces error revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        (await LPToken.nonces(sender.address)).add(ONE),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.revertedWith("PairERC20: INVALID_SIGNATURE");
    });

    it("VolatilePair Permit ETH: creator remove liquidity, version error revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        "2",
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.revertedWith("PairERC20: INVALID_SIGNATURE");
    });

    it("VolatilePair Permit ETH: creator remove liquidity, chainId error revert", async function () {
      const sender = creator;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        1,
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.revertedWith("PairERC20: INVALID_SIGNATURE");
    });

    it("VolatilePair Permit ETH: liquidityProvider remove half of liquidity, allowable < remove revert", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue.sub(ONE),
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.be.revertedWith("PairERC20: INVALID_SIGNATURE");
    });

    it("VolatilePair Permit ETH: liquidityProvider remove half of liquidity", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair Permit ETH: liquidityProvider remove half of liquidity, approve max", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = true;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair Permit ETH: liquidityProvider remove half of liquidity, approve max after removeLiquidityETH", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokenContracts = [USDC, WETH];
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("VolatilePair Permit ETH: liquidityProvider remove half of liquidity, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 1;
      const tokens = [USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const LPToken = await ethers.getContractAt("VolatilePair", pair);
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = true;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s,
          { value: ONE }
        );
      } catch (error) {
        errorFalg = true;
      }

      expect(errorFalg).to.be.equal(true);
    });
  });

  describe("StablePair: removeLiquidityETH", function () {
    it("StablePair ETH: creator remove liquidity, amountsMin exceeded revert", async function () {
      const sender = creator;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const removeLiquidityInfo = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      let amountsMin = [];

      for (let index = 0; index < removeLiquidityInfo.length; index++) {
        const item = removeLiquidityInfo[index];
        amountsMin.push(item.add(ONE));
      }

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("amounts[i] < minAmounts[i]");
    });

    it("StablePair ETH: creator remove liquidity non-existing pair, revert", async function () {
      const sender = creator;

      const pairType = 2;
      const tokens = [USDT.address, USDC.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const pair = pairInfo[0];

      const liquidity = userAmount;
      const removeLiquidityInfo = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const amountsMin = removeLiquidityInfo;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("StableRouter: is not pair");
    });

    it("StablePair ETH: creator remove liquidity, expired revert", async function () {
      const sender = creator;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = await getCurrentTime();

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.revertedWith("StablePair: Deadline not met");
    });

    it("StablePair ETH: creator remove all liquidity", async function () {
      const sender = creator;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove half of liquidity, insufficient approval revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await LPToken.connect(sender).approve(Router.address, liquidity.div(2));
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("StablePair ETH: liquidityProvider remove half of liquidity, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          { value: ZERO }
        );
      } catch (error) {
        errorFalg = true;
      }

      expect(errorFalg).to.be.equal(true);
    });

    it("StablePair ETH: liquidityProvider remove half of liquidity", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove half of liquidity, out of order token", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, WETH, USX];
      const tokens = [USDT.address, WETH.address, USX.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove half of liquidity, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, non-existing pair revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USDC.address, WETH.address];
      const oneToken = WETH.address;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const liquidity = userAmount;
      const minAmount = ZERO;

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("StableRouter: is not pair");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, invalid pair type revert", async function () {
      const sender = liquidityProvider;

      const pairType = 3;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      const liquidity = ONE;
      const minAmount = ZERO;

      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("Router: invalid pair type");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, not WETH revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneToken = USDT.address;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const liquidity = userAmount;
      const minAmount = ZERO;

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("StableRouter: token must be WETH");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, minAmount exceeded revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = (
        await Router.quoteRemoveLiquidityOneToken(
          pairType,
          tokens,
          oneToken,
          liquidity
        )
      ).add(ONE);

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("dy < minAmount");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, withdraw exceeds available revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity;
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      await LPToken.connect(sender).approve(
        Router.address,
        liquidity.add(userAmount)
      );
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity.add(userAmount),
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("Withdraw exceeds available");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, insufficient approval revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      await LPToken.connect(sender).approve(Router.address, ZERO);
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, expired revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = await getCurrentTime();

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.revertedWith("StablePair: Deadline not met");
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue = oneToken == WETH.address ? minAmount : ZERO;

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);

        if (token.address == oneToken) {
          if (sender.address != receiver)
            expect(await token.balanceOf(sender.address)).to.be.equal(
              before[token.address][sender.address]
            );

          if (token != WETH)
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver].add(minAmount)
            );
          else
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver]
            );

          expect(await token.balanceOf(pair)).to.be.equal(
            before[token.address][pair].sub(minAmount)
          );
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver]
        );
        expect(await token.balanceOf(sender.address)).to.be.equal(
          before[token.address][sender.address]
        );
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair]
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove liquidity one token, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue = oneToken == WETH.address ? minAmount : ZERO;

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, liquidity);
      await expect(
        Router.connect(sender).removeLiquidityOneTokenETH(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);

        if (token.address == oneToken) {
          if (sender.address != receiver)
            expect(await token.balanceOf(sender.address)).to.be.equal(
              before[token.address][sender.address]
            );

          if (token != WETH)
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver].add(minAmount)
            );
          else
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver]
            );

          expect(await token.balanceOf(pair)).to.be.equal(
            before[token.address][pair].sub(minAmount)
          );
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver]
        );
        expect(await token.balanceOf(sender.address)).to.be.equal(
          before[token.address][sender.address]
        );
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair]
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, non-existing pair revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USDC.address, WETH.address];
      const amounts = [ZERO, ZERO, utils.parseUnits("10", 18)];
      const maxBurnAmount = userAmount;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("StableRouter: is not pair");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, maxBurnAmount = 0 revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [
        utils.parseUnits("10", 6),
        utils.parseUnits("10", 18),
        utils.parseUnits("0.001", 18),
      ];
      const maxBurnAmount = ZERO;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith(">LP.balanceOf");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, actualBurnAmount > maxBurnAmount revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [
        utils.parseUnits("10", 6),
        utils.parseUnits("10", 18),
        ZERO,
      ];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      const burnAmount = await Router.connect(
        sender
      ).callStatic.removeLiquidityImbalance(
        pairType,
        tokens,
        amounts,
        maxBurnAmount,
        receiver,
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          burnAmount.sub(ONE),
          receiver,
          deadline
        )
      ).to.be.revertedWith("tokenAmount > maxBurnAmount");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, actualBurnAmount = 0 revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [ZERO, ZERO, ZERO];
      const maxBurnAmount = userAmount;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("Burnt amount cannot be zero");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, insufficient approval revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [ZERO, ZERO, utils.parseUnits("0.1", 18)];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );

      await LPToken.connect(sender).approve(Router.address, ZERO);
      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, expired revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [
        utils.parseUnits("1", 6),
        utils.parseUnits("1", 18),
        utils.parseUnits("1", 18),
      ];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = await getCurrentTime();

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.revertedWith("StablePair: Deadline not met");
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, invalid pair type revert", async function () {
      const sender = liquidityProvider;

      const pairType = 3;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [
        utils.parseUnits("1", 6),
        utils.parseUnits("1", 18),
        utils.parseUnits("1", 18),
      ];
      const maxBurnAmount = userAmount;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(false);

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.be.revertedWith("Router: invalid pair type");
    });
    it("StablePair ETH: liquidityProvider remove liquidity imbalance", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [
        utils.parseUnits("1", 6),
        utils.parseUnits("1", 18),
        utils.parseUnits("1", 18),
      ];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);
      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amounts[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      const burnAmount = await Router.connect(
        sender
      ).callStatic.removeLiquidityImbalance(
        pairType,
        tokens,
        amounts,
        maxBurnAmount,
        receiver,
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amounts[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amounts[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amounts[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(burnAmount)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(burnAmount)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, out of order token", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [WETH, USDT, USX];
      const tokens = [WETH.address, USDT.address, USX.address];
      const amounts = [
        utils.parseUnits("1", 18),
        utils.parseUnits("1", 6),
        utils.parseUnits("1", 18),
      ];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);
      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amounts[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      const burnAmount = await Router.connect(
        sender
      ).callStatic.removeLiquidityImbalance(
        pairType,
        tokens,
        amounts,
        maxBurnAmount,
        receiver,
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amounts[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amounts[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amounts[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(burnAmount)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(burnAmount)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair ETH: liquidityProvider remove liquidity imbalance, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [ZERO, ZERO, utils.parseUnits("1.2", 18)];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);
      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amounts[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

      const burnAmount = await Router.connect(
        sender
      ).callStatic.removeLiquidityImbalance(
        pairType,
        tokens,
        amounts,
        maxBurnAmount,
        receiver,
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETH(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amounts[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amounts[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amounts[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(burnAmount)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(burnAmount)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    // it("StablePair ETH: liquidityProvider remove liquidity imbalance, very small amount", async function () {
    //   const sender = liquidityProvider;

    //   const pairType = 2;
    //   const tokenContracts = [USDT, USX, WETH];
    //   const tokenContract = USX;
    //   const tokenAmount = ONE;
    //   const tokens = [USDT.address, USX.address, WETH.address];
    //   const amounts = [tokenAmount, ZERO, ZERO];
    //   const maxBurnAmount = (
    //     await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
    //   )
    //     .mul(1001)
    //     .div(1000);
    //   const receiver = sender.address;
    //   const deadline = (await getCurrentTime()) + 300;

    //   const pairInfo = await Router.pairFor(tokens, pairType);
    //   expect(pairInfo[1]).to.be.equal(true);

    //   const pair = pairInfo[0];
    //   const StablePair = await ethers.getContractAt("StablePair", pair);
    //   const LPToken = await ethers.getContractAt(
    //     "LPToken",
    //     await StablePair.lpToken()
    //   );
    //   const beforeSenderLP = await LPToken.balanceOf(sender.address);
    //   const beforeLPTotalSupply = await LPToken.totalSupply();
    //   const beforeReceiverLP = await LPToken.balanceOf(receiver);

    //   let before = {};
    //   for (let index = 0; index < tokenContracts.length; index++) {
    //     const token = tokenContracts[index];
    //     before[token.address] = {};
    //     before[token.address][sender.address] = await token.balanceOf(
    //       sender.address
    //     );
    //     before[token.address][receiver] = await token.balanceOf(receiver);
    //     before[token.address][pair] = await token.balanceOf(pair);
    //   }

    //   const ethValue =
    //     tokens.indexOf(WETH.address) == -1
    //       ? ZERO
    //       : amounts[tokens.indexOf(WETH.address)];

    //   const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
    //   const receiverChangeETH = ethValue;

    //   await LPToken.connect(sender).approve(Router.address, maxBurnAmount);

    //   const burnAmount = await Router.connect(
    //     sender
    //   ).callStatic.removeLiquidityImbalance(
    //     pairType,
    //     tokens,
    //     amounts,
    //     maxBurnAmount,
    //     receiver,
    //     deadline
    //   );

    //   await expect(
    //     Router.connect(sender).removeLiquidityImbalanceETH(
    //       pairType,
    //       tokens,
    //       amounts,
    //       maxBurnAmount,
    //       receiver,
    //       deadline
    //     )
    //   ).to.changeEtherBalances(
    //     [Router.address, sender, receiver, pair],
    //     [ZERO, senderChangeETH, receiverChangeETH, ZERO]
    //   );

    //   for (let index = 0; index < tokenContracts.length; index++) {
    //     const token = tokenContracts[index];
    //     expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await token.balanceOf(pair)).to.be.equal(
    //       before[token.address][pair].sub(amounts[index])
    //     );
    //     expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
    //     expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

    //     if (sender.address != receiver)
    //       expect(await token.balanceOf(sender.address)).to.be.equal(
    //         before[token.address][sender.address]
    //       );

    //     if (token == WETH) {
    //       expect(await token.balanceOf(receiver)).to.be.equal(
    //         before[token.address][receiver]
    //       );
    //       expect(ethValue).to.be.equal(amounts[index]);
    //       continue;
    //     }

    //     expect(await token.balanceOf(receiver)).to.be.equal(
    //       before[token.address][receiver].add(amounts[index])
    //     );
    //   }

    //   if (sender.address != receiver) {
    //     expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
    //   }
    //   expect(await LPToken.balanceOf(sender.address)).to.be.equal(
    //     beforeSenderLP.sub(burnAmount)
    //   );
    //   expect(await LPToken.totalSupply()).to.be.equal(
    //     beforeLPTotalSupply.sub(burnAmount)
    //   );

    //   // todo
    //   // 9126631766852631 usdt
    //   // 1000000000000000000000000000000 usdc
    //   // 999965124273 usdc
    //   // 1000000000000000000000000000000 usdc
    //   // console.log(burnAmount);
    //   // console.log(await StablePair.getVirtualPrice());
    //   // console.log(burnAmount.mul(await StablePair.getVirtualPrice()));
    //   // console.log(tokenAmount.mul(
    //   //   utils
    //   //     .parseUnits("10", "wei")
    //   //     .pow(
    //   //       utils.parseUnits("36", "wei").sub(await USDC.decimals())
    //   //     )
    //   // ));
    //   // expect(burnAmount.mul(await StablePair.getVirtualPrice())).to.be.gt(
    //   //   tokenAmount.mul(
    //   //     utils
    //   //       .parseUnits("10", "wei")
    //   //       .pow(
    //   //         utils.parseUnits("36", "wei").sub(await tokenContract.decimals())
    //   //       )
    //   //   )
    //   // );

    // //   expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
    // //   expect(await Router.provider.getBalance(Router.address)).to.be.equal(
    // //     ZERO
    // //   );
    // });
  });

  describe("StablePair: removeLiquidityETHWithPermit", function () {
    it("StablePair Permit ETH: creator remove liquidity, expired revert", async function () {
      const sender = creator;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) - 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.revertedWith("PairERC20: EXPIRED");
    });

    it("StablePair Permit ETH: liquidityProvider remove half of liquidity, allowable < remove revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP;
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue.sub(ONE),
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.be.revertedWith("PairERC20: INVALID_SIGNATURE");
    });

    it("StablePair Permit ETH: liquidityProvider remove half of liquidity", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair Permit ETH: liquidityProvider remove half of liquidity, sign approve max", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = true;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair Permit ETH: liquidityProvider remove half of liquidity, approve max after removeLiquidity", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }
      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amountsMin[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;
      await expect(
        Router.connect(sender).removeLiquidityETH(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amountsMin[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amountsMin[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amountsMin[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
      await LPToken.connect(sender).approve(Router.address, ZERO);
    });

    it("StablePair Permit ETH: liquidityProvider remove liquidity one token", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(100);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue = oneToken == WETH.address ? minAmount : ZERO;

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      await expect(
        Router.connect(sender).removeLiquidityOneTokenETHWithPermit(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];

        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);

        if (token.address == oneToken) {
          if (sender.address != receiver)
            expect(await token.balanceOf(sender.address)).to.be.equal(
              before[token.address][sender.address]
            );

          if (token != WETH)
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver].add(minAmount)
            );
          else
            expect(await token.balanceOf(receiver)).to.be.equal(
              before[token.address][receiver]
            );

          expect(await token.balanceOf(pair)).to.be.equal(
            before[token.address][pair].sub(minAmount)
          );
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver]
        );
        expect(await token.balanceOf(sender.address)).to.be.equal(
          before[token.address][sender.address]
        );
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair]
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(liquidity)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(liquidity)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair Permit ETH: liquidityProvider remove liquidity imbalance, and receiver is creator", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokenContracts = [USDT, USX, WETH];
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [ZERO, ZERO, utils.parseUnits("0.01", 18)];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = creator.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);
      const beforeLPTotalSupply = await LPToken.totalSupply();
      const beforeReceiverLP = await LPToken.balanceOf(receiver);

      const approveMax = false;
      const permitValue = approveMax ? MAX : maxBurnAmount;

      let before = {};
      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        before[token.address] = {};
        before[token.address][sender.address] = await token.balanceOf(
          sender.address
        );
        before[token.address][receiver] = await token.balanceOf(receiver);
        before[token.address][pair] = await token.balanceOf(pair);
      }

      const ethValue =
        tokens.indexOf(WETH.address) == -1
          ? ZERO
          : amounts[tokens.indexOf(WETH.address)];

      const senderChangeETH = sender.address == receiver ? ethValue : ZERO;
      const receiverChangeETH = ethValue;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      const burnAmount = await Router.connect(
        sender
      ).callStatic.removeLiquidityImbalanceETHWithPermit(
        pairType,
        tokens,
        amounts,
        maxBurnAmount,
        receiver,
        deadline,
        approveMax,
        signData.v,
        signData.r,
        signData.s
      );

      await expect(
        Router.connect(sender).removeLiquidityImbalanceETHWithPermit(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s
        )
      ).to.changeEtherBalances(
        [Router.address, sender, receiver, pair],
        [ZERO, senderChangeETH, receiverChangeETH, ZERO]
      );

      for (let index = 0; index < tokenContracts.length; index++) {
        const token = tokenContracts[index];
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.balanceOf(pair)).to.be.equal(
          before[token.address][pair].sub(amounts[index])
        );
        expect(await token.balanceOf(Router.address)).to.be.equal(ZERO);
        expect(await token.allowance(Router.address, pair)).to.be.equal(ZERO);

        if (sender.address != receiver)
          expect(await token.balanceOf(sender.address)).to.be.equal(
            before[token.address][sender.address]
          );

        if (token == WETH) {
          expect(await token.balanceOf(receiver)).to.be.equal(
            before[token.address][receiver]
          );
          expect(ethValue).to.be.equal(amounts[index]);
          continue;
        }

        expect(await token.balanceOf(receiver)).to.be.equal(
          before[token.address][receiver].add(amounts[index])
        );
      }

      if (sender.address != receiver) {
        expect(await LPToken.balanceOf(receiver)).to.be.equal(beforeReceiverLP);
      }
      expect(await LPToken.balanceOf(sender.address)).to.be.equal(
        beforeSenderLP.sub(burnAmount)
      );
      expect(await LPToken.totalSupply()).to.be.equal(
        beforeLPTotalSupply.sub(burnAmount)
      );
      expect(await LPToken.allowance(Router.address, pair)).to.be.equal(ZERO);
      expect(await Router.provider.getBalance(Router.address)).to.be.equal(
        ZERO
      );
    });

    it("StablePair Permit ETH: liquidityProvider remove half of liquidity, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const liquidity = beforeSenderLP.div(2);
      const amountsMin = await Router.quoteRemoveLiquidity(
        pairType,
        tokens,
        liquidity
      );

      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;
      const approveMax = true;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityETHWithPermit(
          pairType,
          tokens,
          liquidity,
          amountsMin,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s,
          { value: ONE }
        );
      } catch (error) {
        errorFalg = true;
      }

      expect(errorFalg).to.be.equal(true);
    });

    it("StablePair Permit ETH: liquidityProvider remove liquidity one token, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const oneTokenContract = WETH;
      const oneToken = WETH.address;
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );
      const beforeSenderLP = await LPToken.balanceOf(sender.address);

      const reverse = await StablePair.getTokenBalance(
        await StablePair.getTokenIndex(oneToken)
      );
      let maxRemoveLiquidity = reverse
        .mul(
          utils
            .parseUnits("10", "wei")
            .pow(
              utils
                .parseUnits("36", "wei")
                .sub(await oneTokenContract.decimals())
            )
        )
        .div(await StablePair.getVirtualPrice());
      maxRemoveLiquidity = maxRemoveLiquidity.lt(beforeSenderLP)
        ? maxRemoveLiquidity
        : beforeSenderLP;

      const liquidity = maxRemoveLiquidity.div(10);
      const minAmount = await Router.quoteRemoveLiquidityOneToken(
        pairType,
        tokens,
        oneToken,
        liquidity
      );

      const approveMax = false;
      const permitValue = approveMax ? MAX : liquidity;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityOneTokenETHWithPermit(
          pairType,
          tokens,
          liquidity,
          oneToken,
          minAmount,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s,
          { value: ONE }
        );
      } catch (error) {
        errorFalg = true;
      }

      expect(errorFalg).to.be.equal(true);
    });

    it("StablePair Permit ETH: liquidityProvider remove liquidity imbalance, with value revert", async function () {
      const sender = liquidityProvider;

      const pairType = 2;
      const tokens = [USDT.address, USX.address, WETH.address];
      const amounts = [ZERO, ZERO, utils.parseUnits("0.01", 18)];
      const maxBurnAmount = (
        await Router.quoteRemoveLiquidityImbalance(pairType, tokens, amounts)
      )
        .mul(1001)
        .div(1000);
      const receiver = sender.address;
      const deadline = (await getCurrentTime()) + 300;

      const pairInfo = await Router.pairFor(tokens, pairType);
      expect(pairInfo[1]).to.be.equal(true);

      const pair = pairInfo[0];
      const StablePair = await ethers.getContractAt("StablePair", pair);
      const LPToken = await ethers.getContractAt(
        "LPToken",
        await StablePair.lpToken()
      );

      const approveMax = false;
      const permitValue = approveMax ? MAX : maxBurnAmount;

      const signData = await permitSign(
        sender,
        await LPToken.name(),
        defaultVersion,
        await getChainId(),
        LPToken.address,
        sender.address,
        Router.address,
        permitValue,
        await LPToken.nonces(sender.address),
        deadline
      );

      let errorFalg = false;
      try {
        await Router.connect(sender).removeLiquidityImbalanceETHWithPermit(
          pairType,
          tokens,
          amounts,
          maxBurnAmount,
          receiver,
          deadline,
          approveMax,
          signData.v,
          signData.r,
          signData.s,
          { value: ONE }
        );
      } catch (error) {
        errorFalg = true;
      }
      expect(errorFalg).to.be.equal(true);
    });
  });
});
