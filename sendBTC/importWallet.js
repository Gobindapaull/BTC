require("dotenv").config();
const bitcore = require("bitcore-lib");
const { testnet } = require("bitcore-lib/lib/networks");

const PRIVATE_KEY= process.env.PRIVATE_KEY;

const importWallet = () => {
    const privateKey = new bitcore.PrivateKey(PRIVATE_KEY, testnet);
    const publicKey = privateKey.toPublicKey();
    const address = new bitcore.Address(publicKey, testnet);
    console.log(`Imported wallet address: ${address}`);
    return address.toString();
}

importWallet();
