require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair").ECPairFactory;
const tinysecp = require("tiny-secp256k1");
const bitcore = require("bitcore-lib");
const { testnet } = require("bitcore-lib/lib/networks");
const axios = require("axios");

// ==========================================
// CONFIG
// ==========================================

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const RECIPIENT_ADDRESS =
    process.env.RECIPIENT_TESTNET_ADDRESS;

const SEND_AMOUNT =
    Number(process.env.SEND_AMOUNT);

const FEE =
    Number(process.env.FEE);

// ==========================================
// ECC
// ==========================================

bitcoin.initEccLib(tinysecp);

const ECPair = ECPairFactory(tinysecp);

// ==========================================
// SEND BTC
// ==========================================

const sendBTC = async () => {

    // ------------------------------------------
    // Validate environment
    // ------------------------------------------

    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is missing");
    }

    if (!RECIPIENT_ADDRESS) {
        throw new Error(
            "RECIPIENT_TESTNET_ADDRESS is missing"
        );
    }

    if (!Number.isSafeInteger(SEND_AMOUNT) || SEND_AMOUNT <= 0) {
        throw new Error("Invalid SEND_AMOUNT");
    }

    if (!Number.isSafeInteger(FEE) || FEE < 0) {
        throw new Error("Invalid FEE");
    }

    try {

        // ------------------------------------------
        // 1. Import wallet
        // ------------------------------------------

        const privateKey =
            new bitcore.PrivateKey(
                PRIVATE_KEY,
                testnet
            );

        const publicKey =
            privateKey.toPublicKey();

        const senderAddress =
            new bitcore.Address(
                publicKey,
                testnet
            ).toString();

        console.log("");
        console.log("========== WALLET ==========");
        console.log(`Sender: ${senderAddress}`);
        console.log(`Recipient: ${RECIPIENT_ADDRESS}`);

        // ------------------------------------------
        // 2. Get UTXOs
        // ------------------------------------------

        const utxoURL =
            `https://blockstream.info/testnet/api/address/${senderAddress}/utxo`;

        const { data: utxos } =
            await axios.get(utxoURL, {
                timeout: 10000,
                family: 4
            });

        if (!Array.isArray(utxos) || utxos.length === 0) {
            throw new Error("No UTXOs available");
        }

        // ------------------------------------------
        // 3. Select UTXO
        // ------------------------------------------

        const utxo = utxos[0];

        console.log("");
        console.log("========== UTXO ==========");
        console.log(`TXID: ${utxo.txid}`);
        console.log(`Vout: ${utxo.vout}`);
        console.log(`Value: ${utxo.value} satoshis`);

        const totalInput =
            Number(utxo.value);

        // ------------------------------------------
        // 4. Check balance
        // ------------------------------------------

        const required =
            SEND_AMOUNT + FEE;

        if (totalInput < required) {
            throw new Error(
                `Insufficient balance. Have ${totalInput}, need ${required}`
            );
        }

        // ------------------------------------------
        // 5. Calculate change
        // ------------------------------------------

        const change =
            totalInput - SEND_AMOUNT - FEE;

        console.log("");
        console.log("========== AMOUNTS ==========");
        console.log(`Input:   ${totalInput} satoshis`);
        console.log(`Send:    ${SEND_AMOUNT} satoshis`);
        console.log(`Fee:     ${FEE} satoshis`);
        console.log(`Change:  ${change} satoshis`);

        // ------------------------------------------
        // 6. Download previous transaction
        // ------------------------------------------

        const txURL =
            `https://blockstream.info/testnet/api/tx/${utxo.txid}/hex`;

        const { data: previousTxHex } =
            await axios.get(txURL, {
                timeout: 10000,
                family: 4
            });

        if (!previousTxHex) {
            throw new Error(
                "Could not retrieve previous transaction"
            );
        }

        console.log("");
        console.log("Previous transaction downloaded.");

        // ------------------------------------------
        // 7. Create key pair
        // ------------------------------------------

        const keyPair =
            ECPair.fromPrivateKey(
                Buffer.from(PRIVATE_KEY, "hex"),
                {
                    network: bitcoin.networks.testnet
                }
            );

        // ------------------------------------------
        // 8. Create PSBT
        // ------------------------------------------

        const psbt =
            new bitcoin.Psbt({
                network: bitcoin.networks.testnet
            });

        // ------------------------------------------
        // 9. Add input
        // ------------------------------------------

        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo:
                Buffer.from(previousTxHex, "hex")
        });

        // ------------------------------------------
        // 10. Create recipient script
        // ------------------------------------------

        const recipientScript =
            bitcoin.address.toOutputScript(
                RECIPIENT_ADDRESS,
                bitcoin.networks.testnet
            );

        // ------------------------------------------
        // 11. Add recipient output
        // ------------------------------------------

        psbt.addOutput({
            script: recipientScript,
            value: BigInt(SEND_AMOUNT)
        });

        // ------------------------------------------
        // 12. Create change script
        // ------------------------------------------

        const changeScript =
            bitcoin.address.toOutputScript(
                senderAddress,
                bitcoin.networks.testnet
            );

        // ------------------------------------------
        // 13. Add change output
        // ------------------------------------------

        if (change > 0) {
            psbt.addOutput({
                script: changeScript,
                value: BigInt(change)
            });
        }

        console.log("");
        console.log("========== PSBT ==========");
        console.log(
            `Inputs: ${psbt.data.inputs.length}`
        );
        console.log(
            `Outputs: ${psbt.data.outputs.length}`
        );

        // ------------------------------------------
        // 14. Sign PSBT
        // ------------------------------------------

        console.log("");
        console.log("Signing PSBT...");

        psbt.signInput(
            0,
            keyPair
        );

        console.log("PSBT signed.");

        // ------------------------------------------
        // 15. Finalize PSBT
        // ------------------------------------------

        console.log("Finalizing PSBT...");

        psbt.finalizeAllInputs();

        console.log("PSBT finalized.");

        // ------------------------------------------
        // 16. Extract transaction
        // ------------------------------------------

        const transaction =
            psbt.extractTransaction();

        const rawTx =
            transaction.toHex();

        console.log("");
        console.log("========== RAW TRANSACTION ==========");
        console.log(rawTx);

        // ------------------------------------------
        // 17. Broadcast transaction
        // ------------------------------------------

        console.log("");
        console.log("Broadcasting transaction...");

        const broadcastURL =
            "https://blockstream.info/testnet/api/tx";

        const { data: txid } =
            await axios.post(
                broadcastURL,
                rawTx,
                {
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    timeout: 10000,
                    family: 4
                }
            );

        // ------------------------------------------
        // 18. Success
        // ------------------------------------------

        console.log("");
        console.log("================================");
        console.log("Transaction broadcast successfully!");
        console.log(`TXID: ${txid}`);
        console.log("================================");

        return txid;

    } catch (error) {

        console.log("");
        console.log("========== ERROR ==========");

        console.log(
            error.response?.data ||
            error.message
        );
    }
};

// ==========================================
// RUN
// ==========================================

sendBTC();
