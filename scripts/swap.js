const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const Router = await hre.ethers.getContractFactory("Router");
  const routerAddress = (await deployments.get('Router')).address;
  const router = Router.attach(routerAddress);

  const routes = [
    [
      '0x016A0e9A1aD47B88FC624BFDb85382E2C82b58D2',
      '0xf73932254090dab19700e5a2D61df2CCDE6fCC11',
      '0x1A3ac523b98FD15610cd6e8AE93c08C754bb1752'
    ],
    [
      '0xf73932254090dab19700e5a2D61df2CCDE6fCC11',
      '0xa11FD3582E7E3D5C0d153dAb8DF4638712348AF4',
      '0x9829641Ee73EF79B25D6cEa2d8ebF99675022f30'
    ],
    [
      '0xa11FD3582E7E3D5C0d153dAb8DF4638712348AF4',
      '0x1dEeeb595E6e29f0f793Af5Cb9B9Fe7d7C09Ca28',
      '0x165B0b32115d4c781f00340582c19002A00cd5C5'
    ]
  ]

  let data = await router.swap(routes, '1000000', '1', '0xAE4bdBb0824C9B602589a5DaD2aD96C8A2AcC607', '1680788140')
  console.log(data);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
