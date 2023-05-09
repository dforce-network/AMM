const { ethers } = require("hardhat");
const { deployAndVerify } = require("../utils/deploy")

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = (await getChainId()).toString();

    if (chainId == "5" || chainId == '31337' || chainId == '11155111') {
        await deployAndVerify('BUSD', 'BUSDImplementation', []);

        await deployAndVerify('DAI', 'Dai', [chainId]);

        let dfAddress;
        try {
            dfAddress = (await deployments.get('DF')).address
        } catch (error) {
        }

        let df = await deployAndVerify('DF', 'DSToken', [ethers.utils.formatBytes32String("DF")]);
        if (dfAddress == undefined) {
            const DF = await ethers.getContractFactory('DSToken')
            df = DF.attach(df.address);
            await df.setName(ethers.utils.formatBytes32String("dForce"));
            console.log("df set name done");
        }

        await deployAndVerify('HBTC', 'HBTC', []);

        let time = await getCurrentTime()
        time = ethers.BigNumber.from(time).add(300).toString()
        await deployAndVerify('UNI', 'Uni', [deployer, deployer, time]);

        let usdcAddress;
        try {
            usdcAddress = (await deployments.get('USDC')).address
        } catch (error) {
        }
        let usdc = await deployAndVerify('USDC', 'FiatTokenV2_1', []);
        if (usdcAddress == undefined) {
            const USDC = await ethers.getContractFactory('FiatTokenV2_1')
            usdc = USDC.attach(usdc.address);
            await usdc.initialize('USD Coin', 'USDC', 'USD', '6', deployer, deployer, deployer, deployer);
            await usdc.initializeV2('USDC');
            await usdc.initializeV2_1(deployer);
            console.log("usdc initialize done");
        }

        await deployAndVerify('USDT', 'TetherToken', ["0", "Tether USD", "USDT", "6"]);

        await deployAndVerify('WBTC', 'WBTC', []);

        let usxAddress;
        try {
            usxAddress = (await deployments.get('USX')).address
        } catch (error) {
        }

        let usx = await deployAndVerify('USX', 'MSD', []);

        if (usxAddress == undefined) {
            const USX = await ethers.getContractFactory('MSD')
            usx = USX.attach(usx.address)
            await usx.initialize('dForce USD', 'USX', 18);
            console.log("usx initialize done");
        }

    } else {
        console.log("The official network does not need to deploy test tokens");
    }

}

module.exports.tags = ['TestToken'];

async function getCurrentTime() {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    return block.timestamp;
}