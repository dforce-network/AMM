const hre = require("hardhat");
const { deployments, ethers, getNamedAccounts } = hre;

async function main() {
  const { deployer } = await getNamedAccounts();

  const routerAddress = (await deployments.get('Router')).address;

  const DF = await hre.ethers.getContractFactory("DSToken");
  const dfAddress = (await deployments.get('DF')).address;
  const df = DF.attach(dfAddress);

  const DAI = await hre.ethers.getContractFactory("Dai");
  const daiAddress = (await deployments.get('DAI')).address;
  const dai = DAI.attach(daiAddress);

  await df.allocateTo(deployer, ethers.utils.parseEther('10000'));
  await df.approve(routerAddress, ethers.utils.parseEther('10000'))

  await dai.allocateTo(deployer, ethers.utils.parseEther('10000'));
  await dai.approve(routerAddress, ethers.utils.parseEther('10000'))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
