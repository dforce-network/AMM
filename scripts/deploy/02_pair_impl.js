const { ethers } = hre;
const coder = new ethers.utils.AbiCoder

const { defSwapFee, defAdminFee } = require("../config/params")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // console.log("stablePair at 0x83E3485f6492c890795D5aFEcD8D473f30ec8e0C");

    let swapUtils = await deploy('SwapUtils', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    let amplificationUtils = await deploy('AmplificationUtils', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    let stablePair = await deploy('StablePair', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
        libraries: {
            SwapUtils: swapUtils.address,
            AmplificationUtils: amplificationUtils.address
        }
    });

    let stableLpOld;
    try {
        stableLpOld = (await deployments.get('LPToken')).address
    } catch (error) {
    }

    let stableLpToken = await deploy('LPToken', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    if (stableLpOld != stableLpToken.address) {
        const LPToken = await hre.ethers.getContractFactory("LPToken");
        stableLpToken = LPToken.attach(stableLpToken.address);
        await stableLpToken.initialize("Stable lp token impl", "slti");
        console.log("stable lp token initialize done");
    }

    let volatilePair = await deploy('VolatilePair', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const StablePair = await ethers.getContractFactory('StablePair', {
        libraries: {
            SwapUtils: swapUtils.address,
            AmplificationUtils: amplificationUtils.address
        }
    })
    stablePair = StablePair.attach(stablePair.address);
    let hasFactory1 = await stablePair.factory();
    if (hasFactory1 == ethers.constants.AddressZero) {
        const lpToken = (await deployments.get('LPToken')).address;
        const usdt = (await deployments.get('USDT')).address;
        const usdc = (await deployments.get('USDC')).address;

        let data = coder.encode(['uint256', 'uint256', 'uint256', 'address'], [defSwapFee, defAdminFee, '10000', lpToken]);

        await stablePair.initialize([usdt, usdc], data);
        console.log("stable pair impl initialize done");
    }

    const VolatilePair = await ethers.getContractFactory('VolatilePair')
    volatilePair = VolatilePair.attach(volatilePair.address);
    let hasFactory0 = await volatilePair.factory();
    if (hasFactory0 == ethers.constants.AddressZero) {
        const usdt = (await deployments.get('USDT')).address;
        const usdc = (await deployments.get('USDC')).address;

        let data = coder.encode(['uint256', 'uint256'], [defSwapFee, defAdminFee]);

        await volatilePair.initialize([usdt, usdc], data);
        console.log("volatile piar impl initialize done");
    }

};
module.exports.tags = ['ProxyAdmin'];