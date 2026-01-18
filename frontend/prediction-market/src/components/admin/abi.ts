// ABI for PredictionMarket contract - write functions
export const abi = [
  {
    inputs: [
      {
        internalType: "string",
        name: "_question",
        type: "string",
      },
      {
        internalType: "string",
        name: "_marketType",
        type: "string",
      },
      {
        internalType: "string",
        name: "_oracleUrl",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "_closeTime",
        type: "uint256",
      },
    ],
    name: "createMarket",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "_outcome",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "placeBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "_winningOutcome",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "_txHash",
        type: "bytes32",
      },
    ],
    name: "resolveMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "outcome", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "yesPrice", type: "uint256" },
      { indexed: false, name: "noPrice", type: "uint256" },
    ],
  },
] as const;

// ABI for PredictionMarket contract - Read functions (view)
export const readMarketsAbi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    name: "getMarketInfo",
    outputs: [
      {
        internalType: "string",
        name: "question",
        type: "string",
      },
      {
        internalType: "string",
        name: "marketType",
        type: "string",
      },
      {
        internalType: "string",
        name: "oracleUrl",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "closeTime",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "resolved",
        type: "bool",
      },
      {
        internalType: "uint8",
        name: "winningOutcome",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "totalPool",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "marketCounter",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "uint8",
        name: "_outcome",
        type: "uint8",
      },
    ],
    name: "getUserBet",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "_outcome",
        type: "uint8",
      },
    ],
    name: "getOutcomePool",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    name: "getPrices",
    outputs: [
      {
        internalType: "uint256",
        name: "yesPriceCents",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "noPriceCents",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

