// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { deployments, ethers, getNamedAccounts } = hre;
const { deploy } = deployments;
async function main() {
  const { deployer } = await getNamedAccounts();
  
  const LPToken = await hre.ethers.getContractFactory("LPToken");
  let stableLpToken = await deploy('LPToken', {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });


  let lPToken = LPToken.attach(stableLpToken.address)

  // if (stableLpOld != stableLpToken) {
  await lPToken.initialize("Stable lp token impl", "slti");
  console.log("stable lp token initialize done");
  // }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
