const hre = require("hardhat");
const { ethers, deployments } = hre
const { deploy } = deployments;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function deployAndVerify(name, contract, args) {
    const { deployer } = await getNamedAccounts();

    let contracted = await deploy(name, {
        from: deployer, contract: contract,
        args: args, log: true, skipIfAlreadyDeployed: true,
    });
    await verify(contracted.address, args)
    return contracted
}

async function verify(address, args) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: args,
        });
    } catch (error) {
        await delay(5000)
        verify(address, args)
    }
}

module.exports = {
    deployAndVerify: deployAndVerify,
    verify: verify,
}