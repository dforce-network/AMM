const hre = require("hardhat");
const { deployments, ethers, getChainId } = hre;
const { verify } = require('./utils/deploy')

const swapFee = '30000000';
const adminFee = '5000000000'

async function main() {
    const swapUtils = (await deployments.get('SwapUtils')).address;
    await verify(swapUtils, []);

    const amplificationUtils = (await deployments.get('AmplificationUtils')).address;
    await verify(amplificationUtils, []);

    const stablePair = (await deployments.get('StablePair')).address;
    await verify(stablePair, []);

    const lPToken = (await deployments.get('LPToken')).address;
    await verify(lPToken, []);

    const volatilePair = (await deployments.get('VolatilePair')).address;
    await verify(volatilePair, []);

    const pairFactoryImplAddress = (await deployments.get('PairFactoryImpl')).address;
    await verify(pairFactoryImplAddress, [swapFee, adminFee]);

    const proxyAdmin = (await deployments.get('ProxyAdmin')).address;
    const factoryAddress = (await deployments.get('PairFactory')).address

    const PairFactory = await ethers.getContractFactory('PairFactory')
    const pairFactoryImpl = PairFactory.attach(pairFactoryImplAddress)

    let fragment = PairFactory.interface.getFunction('initialize(uint256,uint256)');
    console.log(fragment);
    const factoryProxyData = pairFactoryImpl.interface.encodeFunctionData(fragment, [swapFee, adminFee]);
    console.log(factoryProxyData);
    await verify(factoryAddress, [pairFactoryImplAddress, proxyAdmin, factoryProxyData]);

    const routerParams = { //weth
        "1": '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        "56": '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        "42161": '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        "10": '0x4200000000000000000000000000000000000006',
        "31337": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
        "5": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
        "11155111": '0x62fB5AaDdc4bd26C6DC50fa5dE679CAa6fa8B44b'
    }
    const chainId = (await getChainId()).toString();

    const volatileRouter = (await deployments.get('VolatileRouter')).address;
    await verify(volatileRouter, [factoryAddress, routerParams[chainId]]);

    const stableRouter = (await deployments.get('StableRouter')).address;
    await verify(stableRouter, [factoryAddress, routerParams[chainId]]);

    const routerImplAddress = (await deployments.get('RouterImpl')).address;
    await verify(routerImplAddress, [factoryAddress, routerParams[chainId]]);

    const router = (await deployments.get('Router')).address;
    const Router = await ethers.getContractFactory('Router')
    const routerImpl = Router.attach(routerImplAddress)

    fragment = Router.interface.getFunction('initialize(address,address)');
    const routerProxyData = routerImpl.interface.encodeFunctionData(fragment, [factoryAddress, routerParams[chainId]]);
    await verify(router, [routerImplAddress, proxyAdmin, routerProxyData]);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
