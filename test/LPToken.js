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

describe("LPToken", function () {

    async function deployLPToken() {

        const LPToken = await ethers.getContractFactory("LPToken");
        const lPToken = await LPToken.deploy();
        await lPToken.initialize("Stable lp token impl", "slti");

        return { lPToken };
    }

    before(async () => {
        accounts = await ethers.getSigners();
        addresses = await Promise.all(
            accounts.map(async (a) => await a.getAddress())
        );

        owner = await accounts[0].getAddress();
    });

    it("should reverse with the right error if The to address of mint and transfer cannot be it own", async function () {
        const { lPToken } = await loadFixture(deployLPToken);

        await expect(lPToken.mint(lPToken.address, 10)).to.be.revertedWith(
            "LPToken: cannot send to itself"
        );

        await expect(lPToken.transfer(lPToken.address, 10)).to.be.revertedWith(
            "LPToken: cannot send to itself"
        );
    })

})