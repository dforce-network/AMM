const { ethers } = require("hardhat");

const { defSwapFee, defAdminFee } = require("../config/params")

//pairType, 1: volatilePair, 2:stablePair

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let implAddress;
    try {
        implAddress = (await deployments.get('PairFactoryImpl')).address
    } catch (error) {
    }

    const params = [defSwapFee, defAdminFee];

    let impl = await deploy('PairFactoryImpl', {
        from: deployer,
        contract: 'PairFactory',
        args: params,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const PairFactory = await ethers.getContractFactory('PairFactory')
    const pairFactoryImpl = PairFactory.attach(impl.address)

    const fragment = PairFactory.interface.getFunction('initialize(uint256,uint256)');
    const factoryProxyData = pairFactoryImpl.interface.encodeFunctionData(fragment, params);

    let proxyAdminAddress = '';
    if (proxyAdminAddress == '') {
        proxyAdminAddress = (await deployments.get('ProxyAdmin')).address;
    }

    let pairFactory = await deploy('PairFactory', {
        from: deployer,
        contract: 'TransparentUpgradeableProxy',
        args: [impl.address, proxyAdminAddress, factoryProxyData],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = ProxyAdmin.attach(proxyAdminAddress);

    if (implAddress !== ethers.constants.AddressZero && implAddress !== impl.address) {
        await proxyAdmin.upgrade(pairFactory.address, impl.address);
        console.log("upgrade PairFactory impl done");
    }

    pairFactory = PairFactory.attach(pairFactory.address);

    let pairImpl1 = (await pairFactory.pairParams('1')).impl;
    const volatilePairImpl = (await deployments.get('VolatilePair')).address;
    console.log("pairImpl1:", pairImpl1);
    console.log("volatilePairImpl:", volatilePairImpl);
    if (pairImpl1 != volatilePairImpl && pairImpl1 != ethers.constants.AddressZero) {
        await pairFactory.removePairType(pairImpl1);
        console.log("remove old pair volatile type done");
    }
    if (pairImpl1 != volatilePairImpl) {
        await pairFactory.addPairType(volatilePairImpl);
        console.log("add pair volatile type done");
    }

    let pairImpl2 = (await pairFactory.pairParams('2')).impl;
    const stablePairImpl = (await deployments.get('StablePair')).address;
    console.log("pairImpl2:", pairImpl2);
    console.log("stablePairImpl:", stablePairImpl);
    if (pairImpl2 != stablePairImpl && pairImpl2 != ethers.constants.AddressZero) {
        await pairFactory.removePairType(pairImpl2);
        console.log("remove old pair stable type done");
    }
    if (pairImpl2 != stablePairImpl) {
        await pairFactory.addPairType(stablePairImpl);
        console.log("add pair stable type done");
    }

};
module.exports.tags = ['PairFactory'];