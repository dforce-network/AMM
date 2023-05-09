const { ethers } = require("hardhat");
const params = { //weth
    "1": '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    "56": '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    "42161": '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    "10": '0x4200000000000000000000000000000000000006',
    "31337": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    "5": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    "11155111": '0x62fB5AaDdc4bd26C6DC50fa5dE679CAa6fa8B44b'
}

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = (await getChainId()).toString();

    const factoryAddress = (await deployments.get('PairFactory')).address

    let volatileRouter = await deploy('VolatileRouter', {
        from: deployer,
        args: [factoryAddress, params[chainId]],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    let stableRouter = await deploy('StableRouter', {
        from: deployer,
        args: [factoryAddress, params[chainId]],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    let implAddress;
    try {
        implAddress = (await deployments.get('RouterImpl')).address
    } catch (error) {
    }

    let impl = await deploy('RouterImpl', {
        from: deployer,
        contract: 'Router',
        args: [factoryAddress, params[chainId]],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const Router = await ethers.getContractFactory('Router')
    const routerImpl = Router.attach(impl.address)

    const fragment = Router.interface.getFunction('initialize(address,address)');
    const routerProxyData = routerImpl.interface.encodeFunctionData(fragment, [factoryAddress, params[chainId]]);

    let proxyAdminAddress = '';
    if (proxyAdminAddress == '') {
        proxyAdminAddress = (await deployments.get('ProxyAdmin')).address;
    }

    const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = ProxyAdmin.attach(proxyAdminAddress);

    let router = await deploy('Router', {
        from: deployer,
        contract: 'MyTransparentUpgradeableProxy',
        args: [impl.address, proxyAdminAddress, routerProxyData],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    if (implAddress !== ethers.constants.AddressZero && implAddress !== impl.address) {
        await proxyAdmin.upgrade(router.address, impl.address);
        console.log("upgrade router impl done");
    }

    router = Router.attach(router.address);

    let pairType1 = await router.pairTypes('1');
    if (pairType1 != volatileRouter.address) {
        await router.setPairTypes(volatileRouter.address)
        console.log("router add volatile type done");
    }

    let pairType2 = await router.pairTypes('2');
    if (pairType2 != stableRouter.address) {
        await router.setPairTypes(stableRouter.address)
        console.log("router add stable type done");
    }

};
module.exports.tags = ['Router'];