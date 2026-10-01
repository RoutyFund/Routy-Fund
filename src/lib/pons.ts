export const PONS_V2={chainId:4663,factory:"0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",feeEscrow:"0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",memeHook:"0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",buybackVault:"0x42df2a798f82289E177311362e8f5ccC45c1219c",locker:"0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952",launchAndBuy:"0xe33E9E479dF8802cb0866d5d05258bEc4cF62948",launchDeployer:"0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42",graduationExecutor:"0xC7819B64A1dAECD7eC19856d026cb14EfBd89046",graduationGuard:"0xf5695117b99B6f6401e67d4195BD653628176C6C",poolManager:"0x8366a39CC670B4001A1121B8F6A443A643e40951"} as const;

export const feeEscrowAbi=[
{type:"function",name:"balanceOf",stateMutability:"view",inputs:[{name:"recipient",type:"address"}],outputs:[{type:"uint256"}]},
{type:"function",name:"balanceOfToken",stateMutability:"view",inputs:[{name:"recipient",type:"address"},{name:"token",type:"address"}],outputs:[{type:"uint256"}]},
{type:"function",name:"claim",stateMutability:"nonpayable",inputs:[],outputs:[{name:"amount",type:"uint256"}]},
{type:"function",name:"claimToken",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"}],outputs:[{name:"amount",type:"uint256"}]}
] as const;

export const factoryReadAbi=[
{type:"function",name:"launchFee",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
{type:"function",name:"maxCreatorTaxBps",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
{type:"function",name:"launchConfigCount",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
{type:"function",name:"getLaunchConfig",stateMutability:"view",inputs:[{name:"id",type:"uint256"}],outputs:[{name:"config",type:"tuple",components:[{name:"supply",type:"uint256"},{name:"curveFeeBps",type:"uint256"},{name:"phantomQuote",type:"uint256"},{name:"graduationThreshold",type:"uint256"},{name:"poolFee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"enabled",type:"bool"}]}]},
{type:"function",name:"approvedPairTokens",stateMutability:"view",inputs:[{name:"pairToken",type:"address"}],outputs:[{type:"bool"}]},
{type:"function",name:"previewLaunchEconomics",stateMutability:"view",inputs:[{name:"launchConfigId",type:"uint256"},{name:"pairToken",type:"address"}],outputs:[{name:"economics",type:"bytes32"}]},
{type:"function",name:"getLaunchedToken",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{name:"launch",type:"tuple",components:[{name:"token",type:"address"},{name:"curve",type:"address"},{name:"deployer",type:"address"},{name:"creatorFeeRecipient",type:"address"},{name:"pairToken",type:"address"},{name:"graduationThreshold",type:"uint256"},{name:"poolFee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"creatorTaxBps",type:"uint16"},{name:"buybackEnabled",type:"bool"},{name:"phase",type:"uint8"},{name:"sweptQuote",type:"uint256"},{name:"sweptTokens",type:"uint256"},{name:"sweptAt",type:"uint256"},{name:"exists",type:"bool"}]}]}
] as const;

export const factoryLaunchAbi=[
{type:"function",name:"launchToken",stateMutability:"payable",inputs:[
{name:"params",type:"tuple",components:[
{name:"name",type:"string"},{name:"symbol",type:"string"},{name:"logo",type:"string"},{name:"description",type:"string"},
{name:"socials",type:"tuple",components:[{name:"twitter",type:"string"},{name:"telegram",type:"string"},{name:"discord",type:"string"},{name:"website",type:"string"},{name:"farcaster",type:"string"}]},
{name:"creatorFeeRecipient",type:"address"},{name:"creatorTaxBps",type:"uint16"},{name:"buybackEnabled",type:"bool"},{name:"expectedEconomics",type:"bytes32"},{name:"salt",type:"bytes32"}
]},
{name:"launchConfigId",type:"uint256"},{name:"pairToken",type:"address"}
],outputs:[{name:"token",type:"address"},{name:"curve",type:"address"}]},
{type:"event",name:"TokenLaunched",anonymous:false,inputs:[
{name:"token",type:"address",indexed:true},{name:"curve",type:"address",indexed:true},{name:"deployer",type:"address",indexed:true},
{name:"pairToken",type:"address",indexed:false},{name:"launchConfigId",type:"uint256",indexed:false},{name:"graduationThreshold",type:"uint256",indexed:false}
]}
] as const;
