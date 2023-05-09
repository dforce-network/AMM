module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let proxyAdminAddress = '';

    if (proxyAdminAddress == '') {
        await deploy('ProxyAdmin', {
            from: deployer,
            args: [],
            log: true,
            skipIfAlreadyDeployed: true,
        });
    } else {
        console.log("ProxyAdmin address: ", proxyAdminAddress);
    }
};
module.exports.tags = ['ProxyAdmin'];