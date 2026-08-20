const bitcore = require("bitcore-lib");
const { testnet } = require("bitcore-lib/lib/networks");

const createWallet = () => {
    const privateKey = new bitcore.PrivateKey();
    const address = privateKey.toAddress(testnet);

    console.log(`Private key: ${privateKey}`);
    console.log(`Address: ${address}`);
}

createWallet();
// Private key: b0cd0bf482e26479ac84338d856a26940d024816ac497d2e753935f7f2898e5f
// Address: n4q5UrCtvXWWwVLSuexxXk4GfqFcNcGn8B
