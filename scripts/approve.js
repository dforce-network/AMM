const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const USDT = await hre.ethers.getContractFactory("TetherToken");
  const usdtAddress = (await deployments.get('USDT')).address;
  console.log("usdtAddress:", usdtAddress);
  const usdt = USDT.attach(usdtAddress);

  await usdt.approve('0x8323142E8121De7F5EC2635D2fDd910BFfAC21Fd', ethers.constants.MaxUint256);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
