const { time, loadFixture, } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const coder = new ethers.utils.AbiCoder
// const { ethers } = require('hardhat');

const swapFee = '10000000'
const adminFee = '5000000000'

let addresses;
let accounts;

describe("PairFactory", function () {

  let usdt, hbtc

  async function deployFactory() {

    const Factory = await ethers.getContractFactory("PairFactory");
    const factory = await Factory.deploy(swapFee, adminFee);

    return { factory };
  }

  async function deployFullFactory() {
    const Factory = await ethers.getContractFactory("PairFactory");
    const factory = await Factory.deploy(swapFee, adminFee);
    const VolatilePair = await ethers.getContractFactory("VolatilePair");
    const volatilePair = await VolatilePair.deploy();

    const SwapUtils = await ethers.getContractFactory("SwapUtils");
    const swapUtils = await SwapUtils.deploy();

    const AmplificationUtils = await ethers.getContractFactory("AmplificationUtils");
    const amplificationUtils = await AmplificationUtils.deploy();

    const StablePair = await ethers.getContractFactory("StablePair", {
      libraries: {
        SwapUtils: swapUtils.address,
        AmplificationUtils: amplificationUtils.address
      }
    });
    const stablePair = await StablePair.deploy();
    await factory.addPairType(volatilePair.address)
    await factory.addPairType(stablePair.address)

    return { factory };
  }


  async function deployVolatilePairImpl() {

    const VolatilePair = await ethers.getContractFactory("VolatilePair");
    const volatilePair = await VolatilePair.deploy();

    let data = coder.encode(['uint256', 'uint256'], [swapFee, adminFee]);

    await volatilePair.initialize([usdt.address, hbtc.address], data);

    return { volatilePair };
  }

  async function deployLPToken() {

    const LPToken = await ethers.getContractFactory("LPToken");
    const lPToken = await LPToken.deploy();
    await lPToken.initialize("Stable lp token impl", "slti");

    return { lPToken };
  }

  async function deployStablePairImpl() {

    const SwapUtils = await ethers.getContractFactory("SwapUtils");
    const swapUtils = await SwapUtils.deploy();

    const AmplificationUtils = await ethers.getContractFactory("AmplificationUtils");
    const amplificationUtils = await AmplificationUtils.deploy();

    const StablePair = await ethers.getContractFactory("StablePair", {
      libraries: {
        SwapUtils: swapUtils.address,
        AmplificationUtils: amplificationUtils.address
      }
    });
    const stablePair = await StablePair.deploy();

    return { stablePair };
  }

  async function deployVolatilePairImpl1() {

    const VolatilePair = await ethers.getContractFactory("VolatilePair");
    const volatilePair1 = await VolatilePair.deploy();

    let data = coder.encode(['uint256', 'uint256'], [swapFee, adminFee]);

    await volatilePair1.initialize([usdt.address, hbtc.address], data);

    return { volatilePair1 };
  }

  before(async () => {
    accounts = await ethers.getSigners();
    addresses = await Promise.all(
      accounts.map(async (a) => await a.getAddress())
    );

    owner = await accounts[0].getAddress();

    const USDT = await ethers.getContractFactory("TetherToken");
    usdt = await USDT.deploy('0', 'Tether USD', 'USDT', '6');

    const HBTC = await ethers.getContractFactory("HBTC");
    hbtc = await HBTC.deploy();

  });

  describe("Deployment", function () {
    it("Should set the right manager", async function () {
      const { factory } = await loadFixture(deployFactory);

      expect(await factory.manager()).to.equal(owner);
    });

    it("Should set the right defSwapFeeRate", async function () {
      const { factory } = await loadFixture(deployFactory);

      expect((await factory.defSwapFeeRate()).toString()).to.equal(swapFee);
    });

    it("Should set the right defAdminFeeRate", async function () {
      const { factory } = await loadFixture(deployFactory);

      expect((await factory.defAdminFeeRate()).toString()).to.equal(adminFee);
    });

    it("Should set the right defAdminFeeRate", async function () {
      const { factory } = await loadFixture(deployFactory);

      expect((await factory.defAdminFeeRate()).toString()).to.equal(adminFee);
    });

    describe("Validations", function () {

      it("Should reverse with the right error if initialize() is called repeatedly", async function () {
        const { factory } = await loadFixture(deployFactory);

        await expect(factory.initialize(swapFee, adminFee)).to.be.revertedWith(
          "Initializable: contract is already initialized"
        );
      });

    });

  });

  let factory0;

  describe("Permission function", function () {
    it("Should set the right pendingManager and acceptManager", async function () {
      const { factory } = await loadFixture(deployFactory);

      await factory.setPendingManager(addresses[1]);

      expect(await factory.pendingManager()).to.equal(addresses[1]);

      await factory.connect(accounts[1]).acceptManager();

      expect(await factory.manager()).to.equal(addresses[1]);

    });

    it("Should set the right pairType by addPairType()", async function () {
      const { factory } = await loadFixture(deployFactory);

      const { volatilePair } = await loadFixture(deployVolatilePairImpl);
      factory0 = factory;

      await factory0.addPairType(volatilePair.address);

      expect((await factory0.pairTypeAmount()).toNumber()).to.equal(1);
      expect((await factory0.containsPair(volatilePair.address))).to.equal(true);
      expect((await factory0.atPairType(0))).to.equal(volatilePair.address);
      expect((await factory0.pairTypeValues())).to.deep.equal([volatilePair.address]);
      expect((await factory0.pairParams(1)).impl).to.equal(volatilePair.address);
    })

    it("Should remove the right pairType by removePairType()", async function () {
      const volatilePair = await factory0.atPairType(0)

      await factory0.removePairType(volatilePair);

      expect((await factory0.pairTypeAmount()).toNumber()).to.equal(0);
      expect((await factory0.containsPair(volatilePair))).to.equal(false);
      expect((await factory0.pairTypeValues())).to.deep.equal([]);
      expect((await factory0.pairParams(1)).impl).to.equal(ethers.constants.AddressZero);
    })

    describe("Validations", function () {

      it("Should reverse with the right error if called by non-manager", async function () {
        const { factory } = await loadFixture(deployFactory);

        await expect(factory.connect(accounts[1]).setPendingManager(accounts[1].address)).to.be.revertedWith(
          "PairFactory: not manager"
        );
        await expect(factory.connect(accounts[1]).setDefAdminFeeRate(adminFee)).to.be.revertedWith(
          "PairFactory: not manager"
        );
        await expect(factory.connect(accounts[1]).setDefSwapFeeRate(swapFee)).to.be.revertedWith(
          "PairFactory: not manager"
        );

        const { volatilePair } = await loadFixture(deployVolatilePairImpl);
        await expect(factory.connect(accounts[1]).addPairType(volatilePair.address)).to.be.revertedWith(
          "PairFactory: not manager"
        );
        await expect(factory.connect(accounts[1]).removePairType(volatilePair.address)).to.be.revertedWith(
          "PairFactory: not manager"
        );
      });

      it("Should reverse with the right error if a non-pendingManager calls acceptManager()", async function () {
        const { factory } = await loadFixture(deployFactory);

        await factory.setPendingManager(accounts[1].address)

        await expect(factory.acceptManager()).to.be.revertedWith(
          "PairFactory: not pending fee manager"
        );
      });

      it("Should reverse with the right error if calling setDefAdminFeeRate() feeRate is greater than MAX_ADMIN_FEE", async function () {
        const { factory } = await loadFixture(deployFactory);

        await expect(factory.setDefAdminFeeRate(ethers.utils.parseEther('1'))).to.be.revertedWith(
          "PairFactory: Over MAX_ADMIN_FEE is not allowed"
        );
      });

      it("Should reverse with the right error if The new rate is the same as the old one when calling setDefAdminFeeRate()", async function () {
        const { factory } = await loadFixture(deployFactory);

        let adminFeeRate = await factory.defAdminFeeRate()

        await expect(factory.setDefAdminFeeRate(adminFeeRate)).to.be.revertedWith(
          "PairFactory: _defAdminFeeRate invalid"
        );
      });

      it("Should reverse with the right error if calling setDefSwapFeeRate() feeRate is greater than MAX_SWAP_FEE", async function () {
        const { factory } = await loadFixture(deployFactory);

        await expect(factory.setDefSwapFeeRate(ethers.utils.parseEther('1'))).to.be.revertedWith(
          "PairFactory: Over MAX_SWAP_FEE is not allowed"
        );
      });

      it("Should reverse with the right error if The new rate is the same as the old one when calling setDefSwapFeeRate()", async function () {
        const { factory } = await loadFixture(deployFactory);

        let swapFeeRate = await factory.defSwapFeeRate()

        await expect(factory.setDefSwapFeeRate(swapFeeRate)).to.be.revertedWith(
          "PairFactory: _defSwapFeeRate invalid"
        );
      });

      it("Should reverse with the right error if add the same impl address", async function () {
        const { factory } = await loadFixture(deployFactory);

        let { volatilePair } = await loadFixture(deployVolatilePairImpl);

        await factory.addPairType(volatilePair.address);

        await expect(factory.addPairType(volatilePair.address)).to.be.revertedWith(
          "PairFactory: This pair already exists"
        );
      });

      it("Should reverse with the right error if add impl the same type is repeated", async function () {
        const { factory } = await loadFixture(deployFactory);

        let { volatilePair } = await loadFixture(deployVolatilePairImpl);
        let { volatilePair1 } = await loadFixture(deployVolatilePairImpl1);

        await factory.addPairType(volatilePair.address);

        await expect(factory.addPairType(volatilePair1.address)).to.be.revertedWith(
          "PairFactory: This pair type already exists"
        );
      });

      it("Should reverse with the right error if call removePairType() to delete the impl address that does not exist", async function () {
        const { factory } = await loadFixture(deployFactory);

        let { volatilePair } = await loadFixture(deployVolatilePairImpl);

        await expect(factory.removePairType(volatilePair.address)).to.be.revertedWith(
          "PairFactory: This pair does not exist"
        );
      });

      it("Should reverse with the right error if Set the same manager or pendingManager", async function () {
        const { factory } = await loadFixture(deployFactory);

        await expect(factory.setPendingManager(owner)).to.be.revertedWith(
          "PairFactory: manager has been set"
        );

        await factory.setPendingManager(addresses[1]);
        await expect(factory.setPendingManager(addresses[1])).to.be.revertedWith(
          "PairFactory: manager has been set"
        );
      });
    });
  });

  describe("public function", function () {
    it("should created volatilePair pair address same as the calculated address", async function () {
      const { factory } = await loadFixture(deployFactory);

      const { volatilePair } = await loadFixture(deployVolatilePairImpl);
      await factory.addPairType(volatilePair.address);

      const tokens = [usdt.address, hbtc.address];
      let data = await ((await factory.createPair(tokens, '1', '0x')).wait());
      let createPairAddress = data.events[data.events.length - 1].args.pair

      let getAddress = await factory.getPairAddress(tokens, '1');

      let pairAmount = await factory.allPairsLength();

      expect(createPairAddress).to.equal(getAddress);
      expect(pairAmount.toNumber()).to.equal(1);
    });

    it("should created stablePair pair address same as the calculated address", async function () {
      const { factory } = await loadFixture(deployFactory);

      const { stablePair } = await loadFixture(deployStablePairImpl);
      await factory.addPairType(stablePair.address);

      const { lPToken } = await loadFixture(deployLPToken);
      let createData = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);

      const tokens = [usdt.address, hbtc.address];
      let data = await ((await factory.createPair(tokens, '2', createData)).wait());
      let createPairAddress = data.events[data.events.length - 1].args.pair

      let getAddress = await factory.getPairAddress(tokens, '2');
      let pairAmount = await factory.allPairsLength();

      expect(createPairAddress).to.equal(getAddress);
      expect(pairAmount.toNumber()).to.equal(1);
    });

    describe("Validations", function () {

      it("should reverse with the right error if create a pair of the same token and type", async function () {
        const { factory } = await loadFixture(deployFactory);

        const { volatilePair } = await loadFixture(deployVolatilePairImpl);
        await factory.addPairType(volatilePair.address);

        const tokens = [usdt.address, hbtc.address];

        await factory.createPair(tokens, '1', '0x')

        await expect(factory.createPair(tokens, '1', '0x')).to.be.revertedWith(
          "PairFactory: Pair already exists"
        );

        const { stablePair } = await loadFixture(deployStablePairImpl);
        await factory.addPairType(stablePair.address);

        const { lPToken } = await loadFixture(deployLPToken);
        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);
        await factory.createPair(tokens, '2', data)

        await expect(factory.createPair(tokens, '2', data)).to.be.revertedWith(
          "PairFactory: Pair already exists"
        );
      });

      it("should reverse with the right error if create a pair with the same token but no sequence", async function () {
        let tokens = [usdt.address, hbtc.address];
        const { factory } = await loadFixture(deployFullFactory);

        await factory.createPair(tokens, '1', '0x')
        const { lPToken } = await deployLPToken();
        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);
        await factory.createPair(tokens, '2', data);

        tokens = [hbtc.address, usdt.address];

        await expect(factory.createPair(tokens, '1', '0x')).to.be.revertedWith(
          "PairFactory: Pair already exists"
        );
        await expect(factory.createPair(tokens, '2', data)).to.be.revertedWith(
          "PairFactory: Pair already exists"
        );
      })

      it("should reverse with the right error if Tokens exceed the capacity limit when creating a pair", async function () {
        const { factory } = await loadFixture(deployFullFactory);
        const ERC20 = await ethers.getContractFactory("MockERC20");
        let tokens = [];
        let baseName = 'mock token '
        let baseSymbol = 'mt'
        for (let i = 0; i < 33; i++) {
          let erc20 = await ERC20.deploy(baseName + i, baseSymbol + i);
          tokens.push(erc20.address);
        }

        await expect(factory.createPair(tokens, '1', '0x')).to.be.revertedWith(
          "VolatilePair: This type of pair must have only two tokens when created"
        );

        const { lPToken } = await deployLPToken();
        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);

        await expect(factory.createPair(tokens, '2', data)).to.be.revertedWith(
          "StablePair: _pooledTokens.length > 32"
        );
      })

      it("should reverse with the right error if you create a Pair with duplicate tokens", async function () {
        const tokens = [usdt.address, usdt.address];
        const { factory } = await loadFixture(deployFactory);
        const { stablePair } = await loadFixture(deployStablePairImpl);
        await factory.addPairType(stablePair.address);
        const { volatilePair } = await loadFixture(deployVolatilePairImpl);
        await factory.addPairType(volatilePair.address);

        const { lPToken } = await loadFixture(deployLPToken);
        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);
        await expect(factory.createPair(tokens, '2', data)).to.be.revertedWith(
          "StablePair: Duplicate tokens"
        );
        await expect(factory.createPair(tokens, '1', '0x')).to.be.revertedWith(
          "VolatilePair: Token cannot be the same"
        );
      })

      it("should reverse with the right error if Non-manager creates auth pair", async function () {
        const { factory } = await loadFixture(deployFactory);
        const { stablePair } = await loadFixture(deployStablePairImpl);
        await factory.addPairType(stablePair.address);

        const tokens = [usdt.address, hbtc.address];

        const { lPToken } = await loadFixture(deployLPToken);

        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [swapFee, adminFee, '10000', lPToken.address]);

        await expect(factory.connect(accounts[1]).createPair(tokens, '2', data)).to.be.revertedWith(
          "PairFactory: this pair type can only be created by manager"
        );
      })

      it("should reverse with the right error if There is no such pairType when creating a pair", async function () {
        const { factory } = await loadFixture(deployFactory);

        const tokens = [usdt.address, hbtc.address];

        await expect(factory.createPair(tokens, '1', '0x')).to.be.revertedWith(
          "PairFactory: No impl of this type"
        );
      })

    });
  });
});
