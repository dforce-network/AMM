const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const Router = await hre.ethers.getContractFactory("Router");
  const routerAddress = (await deployments.get('Router')).address;
  const router = Router.attach(routerAddress);

  const dai = (await deployments.get('DAI')).address;
  const df = (await deployments.get('DF')).address;

  await router.addLiquidity(
    '1',
    [dai, df],
    ['10000000000000000000', '10000000000000000000'],
    ['9700000000000000000', '9700000000000000000'],
    '969999999030',
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '1679368109'
  )
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
