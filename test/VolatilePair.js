const { time, loadFixture, } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const hre = require("hardhat")
const { ethers } = hre
const { BigNumber } = ethers;
const coder = new ethers.utils.AbiCoder

const swapFee = '10000000'
const adminFee = '5000000000'
const feeDenominator = '10000000000'

const mintAmount = '100000000'
const pairTokenAmount0 = '1000000000'
const pairTokenAmount1 = '10000000'

describe("VolatilePair", function () {

    let addresses;
    let accounts;
    let owner;
    let ownerAddress;

    async function deployVolatilePair(swapFee0, adminFee0) {
        swapFee0 = swapFee0 == undefined ? swapFee : swapFee0;
        adminFee0 = adminFee0 == undefined ? adminFee : adminFee0;
        let swapFeeZero = swapFee0 == 0;
        let adminFeeZero = adminFee0 == 0;
        if (swapFeeZero) swapFee0 = 1
        if (adminFeeZero) adminFee0 = 1

        const ERC20 = await ethers.getContractFactory("contracts/test/MockERC20.sol:MockERC20");
        let tt0 = await ERC20.deploy('Test Token 0', 'TT0');
        let tt1 = await ERC20.deploy('Test Token 1', 'TT1');

        const Factory = await ethers.getContractFactory("PairFactory");
        const factory = await Factory.deploy(swapFee0, adminFee0);

        const VolatilePair = await ethers.getContractFactory("VolatilePair");
        const pairImpl = await VolatilePair.deploy();
        await factory.addPairType(pairImpl.address);

        if (swapFeeZero) await factory.setDefSwapFeeRate(0)
        if (adminFeeZero) await factory.setDefAdminFeeRate(0)

        let data = await ((await factory.createPair([tt0.address, tt1.address], '1', '0x')).wait());
        let createPairAddress = data.events[data.events.length - 1].args.pair

        let pair = VolatilePair.attach(createPairAddress)
        let token0 = await pair.token0();
        let token1 = await pair.token1();

        tt0 = ERC20.attach(token0);
        tt1 = ERC20.attach(token1);

        accounts = await ethers.getSigners();
        owner = accounts[0];
        ownerAddress = await owner.getAddress();

        addresses = await Promise.all(accounts.map(async (a) => {
            let address = await a.getAddress();

            // There is a fixed quantity in the contract
            await tt0.allocateTo(address, ethers.utils.parseEther(mintAmount));
            await tt1.allocateTo(address, ethers.utils.parseEther(mintAmount));

            return address;
        }));

        await tt0.allocateTo(ownerAddress, ethers.utils.parseEther(pairTokenAmount0));
        await tt1.allocateTo(ownerAddress, ethers.utils.parseEther(pairTokenAmount1));

        await tt0.transfer(pair.address, ethers.utils.parseEther(pairTokenAmount0));
        await tt1.transfer(pair.address, ethers.utils.parseEther(pairTokenAmount1));

        await pair.mint(ownerAddress)
        return { tt0, tt1, pair, factory }
    }

    describe("swap", function () {

        it("Bundle swap and sync or skim test", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);
            let token0 = await pair.token0();
            let tokenOrder = token0 == tt0.address;

            const { parts } = getRandomNumbersInRange(ethers.utils.parseEther('100'), ethers.utils.parseEther('1000'), 2);
            await pair.skim(ownerAddress)

            let amountIn = parts[0]

            let amountOut = await pair.getAmountOut(tt0.address, tt1.address, amountIn);
            let amountOut0 = tokenOrder ? '0' : amountOut;
            let amountOut1 = tokenOrder ? amountOut : '0';

            await tt0.transfer(pair.address, amountIn);
            await pair.swap(amountOut0, amountOut1, ownerAddress, '0x')

            await pair.sync();

            amountIn = parts[1]

            amountOut = await pair.getAmountOut(tt0.address, tt1.address, amountIn);
            amountOut0 = tokenOrder ? '0' : amountOut;
            amountOut1 = tokenOrder ? amountOut : '0';

            await tt0.transfer(pair.address, amountIn);
            await pair.swap(amountOut0, amountOut1, ownerAddress, '0x')

            await pair.skim(ownerAddress)

            let [balance0, balance1] = await pair.getRealBalanceOf();
            let [reserve0, reserve1] = await pair.getReserves();

            expect(balance0.toString()).to.be.equal(reserve0.toString());
            expect(balance1.toString()).to.be.equal(reserve1.toString());
        })

        it("Increase amount according to getAmountOut but not increase amountIn", async () => {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);
            const { parts } = getRandomNumbersInRange(ethers.utils.parseEther('100'), ethers.utils.parseEther('1000'), 1);
            let token0 = await pair.token0();
            let tokenOrder = token0 == tt0.address;

            let amountOut = await pair.getAmountOut(tt0.address, tt1.address, parts[0]);
            let amountOut0 = tokenOrder ? '0' : amountOut.add(1);
            let amountOut1 = tokenOrder ? amountOut.add(1) : '0';

            await tt0.transfer(pair.address, parts[0]);

            await expect(pair.swap(amountOut0, amountOut1, ownerAddress, '0x')).to.be.revertedWith(
                "VolatilePair: K"
            );
        })

        it("0 swapFee and adminFee to correctly swap", async () => {
            const { tt0, tt1, pair } = await deployVolatilePair(0, 0);
            const { parts } = getRandomNumbersInRange(ethers.utils.parseEther('100'), ethers.utils.parseEther('1000'), 1);
            let token0 = await pair.token0();
            let tokenOrder = token0 == tt0.address;

            let amountOut = await pair.getAmountOut(tt0.address, tt1.address, parts[0]);
            let amountOut0 = tokenOrder ? '0' : amountOut;
            let amountOut1 = tokenOrder ? amountOut : '0';

            let balance0 = await tt1.balanceOf(ownerAddress);

            await tt0.transfer(pair.address, parts[0]);
            await pair.swap(amountOut0, amountOut1, ownerAddress, '0x')

            let balance1 = await tt1.balanceOf(ownerAddress);
            let actualAmountOut = balance1.sub(balance0).toString()
            expect(amountOut.toString()).to.be.equal(actualAmountOut);
        })

        it("max swapFee and adminFee to correctly swap", async () => {
            let maxFeeRate = BigNumber.from(10).pow(8).sub(1)
            const { tt0, tt1, pair } = await deployVolatilePair(maxFeeRate, maxFeeRate);
            const { parts } = getRandomNumbersInRange(ethers.utils.parseEther('100'), ethers.utils.parseEther('1000'), 1);
            let token0 = await pair.token0();
            let tokenOrder = token0 == tt0.address;

            let amountOut = await pair.getAmountOut(tt0.address, tt1.address, parts[0]);
            let amountOut0 = tokenOrder ? '0' : amountOut;
            let amountOut1 = tokenOrder ? amountOut : '0';

            let balance0 = await tt1.balanceOf(ownerAddress);

            await tt0.transfer(pair.address, parts[0]);
            await pair.swap(amountOut0, amountOut1, ownerAddress, '0x')

            let balance1 = await tt1.balanceOf(ownerAddress);
            let actualAmountOut = balance1.sub(balance0).toString()
            expect(amountOut.toString()).to.be.equal(actualAmountOut);
        })

        it("Random swap single token to get the correct fee ", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            const swapCount = 100;

            let amountInMin = ethers.utils.parseEther('100');
            let amountInMax = ethers.utils.parseEther('1000')

            //tt0 info
            const { parts: parts0, totalSwapAmount: totalSwapAmount0 } = getRandomNumbersInRange(amountInMin, amountInMax, swapCount);
            //tt1 info
            const { parts: parts1, totalSwapAmount: totalSwapAmount1 } = getRandomNumbersInRange(amountInMin, amountInMax, swapCount);

            // console.log("totalSwapAmount0:", totalSwapAmount0);
            // console.log("totalSwapAmount1:", totalSwapAmount1);

            for (let i = 0; i < swapCount; i++) {
                let swapOrder = Boolean(Math.round(Math.random()));

                let amountIn = swapOrder ? parts0[i] : parts1[i];

                let from = swapOrder ? tt0 : tt1;
                let to = swapOrder ? tt1 : tt0;

                let amountOut = await pair.getAmountOut(from.address, to.address, amountIn);
                let amountOut0 = swapOrder ? '0' : amountOut;
                let amountOut1 = swapOrder ? amountOut : '0';

                let calculateAdminFee = amountIn.mul(swapFee).mul(adminFee).div(feeDenominator).div(feeDenominator);

                //10 is accounts number
                let account = accounts[i % 10]
                let address = addresses[i % 10];

                await from.connect(account).transfer(pair.address, amountIn);
                let data = await (await pair.connect(account).swap(amountOut0, amountOut1, address, '0x')).wait();

                let realityAdminFee = data.events[1].args.swapFees[swapOrder ? 0 : 1]
                // console.log("realityAdminFee:", realityAdminFee.toString());
                // console.log("calculateAdminFee:", calculateAdminFee.toString());
                // console.log("realityAdminFee:", realityAdminFee);
                // console.log("calculateAdminFee:", calculateAdminFee);

                expect(realityAdminFee).to.be.closeTo(calculateAdminFee, 1);
            }
        });

        it("Random swap double token to get the correct fee ", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            const swapCount = 100;

            let amountInMin = ethers.utils.parseEther('100');
            let amountInMax = ethers.utils.parseEther('1000')

            //tt0 info
            const { parts: parts0, totalSwapAmount: totalSwapAmount0 } = getRandomNumbersInRange(amountInMin, amountInMax, swapCount);
            //tt1 info
            const { parts: parts1, totalSwapAmount: totalSwapAmount1 } = getRandomNumbersInRange(amountInMin, amountInMax, swapCount);

            // console.log("totalSwapAmount0:", totalSwapAmount0);
            // console.log("totalSwapAmount1:", totalSwapAmount1);

            //random swap amount
            let token0 = await pair.token0();
            let token1 = await pair.token1();
            let tokenOrder = token0 == tt0.address;

            for (let i = 0; i < swapCount; i++) {
                let amountIn0 = parts0[i];
                let amountIn1 = parts1[i];

                amountIn0 = tokenOrder ? amountIn0 : amountIn1;
                amountIn1 = tokenOrder ? amountIn1 : amountIn0;

                let from = tokenOrder ? tt0 : tt1;
                let to = tokenOrder ? tt1 : tt0;

                let amountOut1 = await pair.getAmountOut(from.address, to.address, amountIn0);
                let amountOut0 = await pair.getAmountOut(to.address, from.address, amountIn1);

                let calculateAdminFee0 = amountIn0.mul(swapFee).mul(adminFee).div(feeDenominator).div(feeDenominator);
                let calculateAdminFee1 = amountIn1.mul(swapFee).mul(adminFee).div(feeDenominator).div(feeDenominator);

                //10 is accounts number
                let account = accounts[i % 10]
                let address = addresses[i % 10];

                await from.connect(account).transfer(pair.address, amountIn0);
                await to.connect(account).transfer(pair.address, amountIn1);
                let data = await (await pair.connect(account).swap(amountOut0, amountOut1, address, '0x')).wait();

                // console.log(data.events);

                let realityAdminFee0 = data.events[2].args.swapFees[0]
                let realityAdminFee1 = data.events[2].args.swapFees[1]
                // console.log("realityAdminFee0:", realityAdminFee0.toString());
                // console.log("realityAdminFee1:", realityAdminFee1.toString());
                // console.log("calculateAdminFee0:", calculateAdminFee0.toString());
                // console.log("calculateAdminFee1:", calculateAdminFee1.toString());

                expect(realityAdminFee0).to.be.closeTo(calculateAdminFee0, 1);
                expect(realityAdminFee1).to.be.closeTo(calculateAdminFee1, 1);
            }
        });

        describe("Validations", function () {
            it("should reverse with the right error if random reentry pair", async function () {
                const { tt0, tt1, pair, factory } = await loadFixture(deployVolatilePair);
                const MockRouter = await ethers.getContractFactory("MockRouter");
                const router = await MockRouter.deploy(factory.address);

                const swapCount = 100;
                const { parts } = getRandomNumbersInRange(ethers.utils.parseEther('100'), ethers.utils.parseEther('1000'), swapCount);

                for (let i = 0; i < swapCount; i++) {
                    let action = getRandomAction(5) + 1;
                    let swapOrder = Boolean(Math.round(Math.random()));

                    let data = coder.encode(['uint256'], [action])

                    await expect(router.callSwap(pair.address, swapOrder, parts[i], data)).to.be.revertedWith(
                        "VolatilePair: LOCKED"
                    );
                }
            })
        })
    })

    describe("other action", function () {
        it("Random mint and burn to get the correct reserve and balance", async function () {
            const { tt0, tt1, pair, factory } = await loadFixture(deployVolatilePair);

            let manager = await factory.manager();

            const ERC20 = await ethers.getContractFactory("contracts/test/ERC20.sol:ERC20");

            let token0 = ERC20.attach(await pair.token0())
            let token1 = ERC20.attach(await pair.token1())

            const swapCount = 100;

            let amountInMin = ethers.utils.parseEther('100');
            let amountInMax = ethers.utils.parseEther('1000')

            //mint info
            const { parts: parts0 } = getRandomNumbersInRange(amountInMin, amountInMax, swapCount);
            //burn info
            const { parts: parts1 } = getRandomNumbersInRange(ethers.utils.parseEther('10'), ethers.utils.parseEther('100'), swapCount);

            let mintList = []
            let mintNum = 0;
            let burnNum = 0;
            let syncNum = 0;
            let skimNum = 0;
            let claimFeeNum = 0;

            for (let i = 0; i < swapCount; i++) {
                let account = accounts[i % 10]
                let address = addresses[i % 10]
                let action = getRandomAction(5);
                if (action == 0) {
                    let lp = await mint(tt0, tt1, account, pair, parts0[i]);
                    mintList.push({ account: i % 10, lp: lp });
                    mintNum++;
                }

                if (action == 1 && mintList.length > 1) {
                    let info = mintList[0];
                    await burn(pair, accounts[info.account], info.lp)
                    mintList.shift()
                    burnNum++;
                }

                if (action == 2) {
                    await pair.connect(account).sync()
                    syncNum++;
                }

                if (action == 3) {
                    let token0In = parts0[i];
                    let token1In = parts1[i];
                    await tt0.connect(account).transfer(pair.address, token0In);
                    await expect(pair.connect(account).skim(address)).to.changeTokenBalances(tt0, [pair.address, address], [BigNumber.from(token0In).mul(-1), token0In]);

                    await tt1.connect(account).transfer(pair.address, token1In);
                    await expect(pair.connect(account).skim(address)).to.changeTokenBalances(tt1, [pair.address, address], [BigNumber.from(token1In).mul(-1), token1In]);
                    skimNum++
                }

                if (action == 4) {
                    let adminFee0 = await pair.totalAdminFee0()
                    let adminFee1 = await pair.totalAdminFee1()

                    let pairToken1Balance0 = await token1.balanceOf(pair.address)
                    let managerToken1Balance0 = await token1.balanceOf(ownerAddress);

                    await expect(pair.connect(account).claimFees()).to.changeTokenBalances(token0, [manager, pair.address], [adminFee0, BigNumber.from(adminFee0).mul(-1)])

                    expect(pairToken1Balance0.sub(await token1.balanceOf(pair.address)).toString()).to.eq(adminFee1.toString());
                    expect((await token1.balanceOf(ownerAddress)).sub(managerToken1Balance0).toString()).to.eq(adminFee1.toString());

                    expect((await pair.totalAdminFee0()).toString()).to.eq('0')
                    expect((await pair.totalAdminFee1()).toString()).to.eq('0')

                    claimFeeNum++;
                }
                let [balance0, balance1] = await pair.getRealBalanceOf();
                [reserve0, reserve1] = await pair.getReserves();

                expect(balance0.toString()).to.be.equal(reserve0.toString());
                expect(balance1.toString()).to.be.equal(reserve1.toString());
            }
            console.log("mintNum:", mintNum, ", burnNum:", burnNum, ", syncNum:", syncNum, ", skimNum:", skimNum, ", claimFeeNum:", claimFeeNum);
        })
    })

    describe("Validations", function () {
        it("should reverse with the right error if Second call to initialize", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);
            await expect(pair.initialize([tt0.address, tt1.address], '0x')).to.be.revertedWith(
                "Initializable: contract is already initialized"
            );
        })

        it("should reverse with the right error if Greater than MAX_SWAP_FEE", async function () {
            const { tt0, tt1 } = await loadFixture(deployVolatilePair);
            const VolatilePair = await ethers.getContractFactory("VolatilePair");
            const pair = await VolatilePair.deploy();

            let data = coder.encode(['uint256', 'uint256'], [BigNumber.from(10).pow(8).add(1), adminFee]);

            await expect(pair.initialize([tt0.address, tt1.address], data)).to.be.revertedWith(
                "VolatilePair: SwapFee is greater than the maximum value"
            );
        })

        it("should reverse with the right error if Greater than MAX_ADMIN_FEE", async function () {
            const { tt0, tt1 } = await loadFixture(deployVolatilePair);
            const VolatilePair = await ethers.getContractFactory("VolatilePair");
            const pair = await VolatilePair.deploy();

            let data = coder.encode(['uint256', 'uint256'], [swapFee, BigNumber.from(10).pow(10).add(1)]);

            await expect(pair.initialize([tt0.address, tt1.address], data)).to.be.revertedWith(
                "VolatilePair: AdminFee is greater than the maximum value"
            );
        })

        it("should reverse with the right error if getAmountOut() passes in an amount less than 1", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.getAmountOut(tt0.address, tt1.address, 0)).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_INPUT_AMOUNT"
            );
        })

        it("should reverse with the right error if Query getAmountOut() when there is no reserve", async function () {
            const { tt0, tt1 } = await loadFixture(deployVolatilePair);
            const VolatilePair = await ethers.getContractFactory("VolatilePair");
            const pair = await VolatilePair.deploy();

            let data = coder.encode(['uint256', 'uint256'], [swapFee, adminFee]);
            await pair.initialize([tt0.address, tt1.address], data)

            await expect(pair.getAmountOut(tt0.address, tt1.address, 1)).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_LIQUIDITY"
            );
        })

        it("should reverse with the right error if _update() overflow uint112", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await tt0.allocateTo(ownerAddress, BigNumber.from(2).pow(112));
            await tt0.transfer(pair.address, BigNumber.from(2).pow(112).add(1));

            await expect(pair.sync()).to.be.revertedWith(
                "VolatilePair: OVERFLOW"
            );
        })

        it("should reverse with the right error if Mint does not give token", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.mint(ownerAddress)).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_LIQUIDITY_MINTED"
            );
        })

        it("should reverse with the right error if burn when there is no lp", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.burn(ownerAddress)).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_LIQUIDITY_BURNED"
            );
        })

        it("should reverse with the right error if The amountOut is not passed in during swap", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.swap(0, 0, ownerAddress, '0x')).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_OUTPUT_AMOUNT"
            );
        })

        it("should reverse with the right error if amountOut is greater than reserve when calling swap", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            let [reserve0, reserve1] = await pair.getReserves()

            await expect(pair.swap(reserve0.add(1), 1, ownerAddress, '0x')).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_LIQUIDITY"
            );
        })

        it("should reverse with the right error if _to is one of the token addresses when calling swap", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.swap(1, 1, tt0.address, '0x')).to.be.revertedWith(
                "VolatilePair: INVALID_TO"
            );
        })

        it("should reverse with the right error if Do not transfer token when calling swap", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            await expect(pair.swap(1, 1, ownerAddress, '0x')).to.be.revertedWith(
                "VolatilePair: INSUFFICIENT_INPUT_AMOUNT"
            );
        })
    })

    describe("onlyManager and other view", function () {
        it("setSwapFeeRate()", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);
            let newSwapFeeRate = BigNumber.from(10).pow(7).add(1).toString()

            await pair.setSwapFeeRate(newSwapFeeRate);

            let getSwapFeeRate = await pair.swapFeeRate()
            expect(newSwapFeeRate).to.be.eq(getSwapFeeRate.toString())
        })

        it("setAdminFeeRate()", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);
            let newAdminFeeRate = BigNumber.from(10).pow(9).add(1).toString()

            await pair.setAdminFeeRate(newAdminFeeRate);

            let getAdminFeeRate = await pair.adminFeeRate()
            expect(newAdminFeeRate).to.be.eq(getAdminFeeRate.toString())
        })

        it("tokens()", async function () {
            const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

            let tokens = await pair.tokens();

            expect(tokens[0]).to.be.eq(tt0.address)
            expect(tokens[1]).to.be.eq(tt1.address)
        })

        describe("Validations", function () {
            it("should reverse with the right error if MAX_SWAP_FEE exceeded when call setSwapFeeRate()", async function () {
                const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

                await expect(pair.setSwapFeeRate(BigNumber.from(10).pow(8).add(1).toString())).to.be.revertedWith(
                    "VolatilePair: SwapFee is greater than the maximum value"
                );
            })

            it("should reverse with the right error if MAX_ADMIN_FEE exceeded when call setAdminFeeRate()", async function () {
                const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

                await expect(pair.setAdminFeeRate(BigNumber.from(10).pow(10).add(1).toString())).to.be.revertedWith(
                    "VolatilePair: AdminFee is greater than the maximum value"
                );
            })

            it("should reverse with the right error if Non-manager calls onlyManager function", async function () {
                const { tt0, tt1, pair } = await loadFixture(deployVolatilePair);

                await expect(pair.connect(accounts[1]).setAdminFeeRate(BigNumber.from(10).pow(9).add(1).toString())).to.be.revertedWith(
                    "VolatilePair: not manager"
                );
            })

        })
    })
});

async function mint(token0, token1, account, pair, amount) {
    try {
        let lp0 = await pair.balanceOf(account.getAddress());
        let [reserve0, reserve1] = await pair.getReserves();
        const { amountIn, amountOut } = getAddLPAmount(amount, reserve0, reserve1);
        await token0.connect(account).transfer(pair.address, amountIn);
        await token1.connect(account).transfer(pair.address, amountOut);
        await pair.connect(account).mint(account.getAddress());
        let lp1 = await pair.balanceOf(account.getAddress());
        return lp1.sub(lp0).toString()
    } catch (error) {
        console.log(error);
    }
}

async function burn(pair, account, amount) {
    try {
        await pair.connect(account).transfer(pair.address, amount);
        await pair.connect(account).burn(account.getAddress())
    } catch (error) {
        console.log("burn error:", error);
    }
}

function getRandomAction(num) {
    const randomNumber = Math.floor(Math.random() * num);
    // console.log(randomNumber);
    return randomNumber;
}

function getAddLPAmount(amountIn, reserve0, reserve1) {
    let amountOut = reserve1.mul(amountIn).div(reserve0);
    amountIn = amountOut.mul(reserve0).div(reserve1)
    return { amountIn, amountOut };
}

function getRandomNumbersInRange(min, max, count) {
    const range = BigNumber.from(max).sub(BigNumber.from(min));
    let length = range.toString().length;
    const randomNumbers = [];
    let totalSwapAmount = BigNumber.from(0);
    for (let i = 0; i < count; i++) {
        const randomNumber = ethers.utils.parseUnits(Math.random().toFixed(length), length).mul(range).div(BigNumber.from(10).pow(length))
        randomNumbers.push(randomNumber.add(BigNumber.from(min)));
        totalSwapAmount = totalSwapAmount.add(randomNumber);
    }
    return { parts: randomNumbers, totalSwapAmount: totalSwapAmount };
}