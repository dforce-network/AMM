const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const Router = await hre.ethers.getContractFactory("Router");
  const routerAddress = (await deployments.get('Router')).address;
  console.log("routerAddress:", routerAddress);
  const router = Router.attach(routerAddress);

  let data = await router.getReserves(["0x30c37419e71C435eB17C0ADc8De551C686a6aC8B", "0xa77CfE70179A3cfc7a21c22Af7919BdA8FafD1f0"])

  console.log(data);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
