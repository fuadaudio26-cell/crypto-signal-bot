require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.BOT_TOKEN);

// =====================================
// ANTI DUPLICATE
// =====================================

const sentTokens = new Set();

// =====================================
// RUGCHECK
// =====================================

async function checkTokenSafety(contract) {

    try {

        const response = await axios.get(
            `https://api.rugcheck.xyz/v1/tokens/${contract}/report`
        );

        const data = response.data;

        // HONEYPOT
        if (data.honeypot === true) {

            console.log("Honeypot skip");

            return false;
        }

        // HIGH RISK
        if (data.riskLevel === "HIGH") {

            console.log("High risk skip");

            return false;
        }

        return true;

    } catch (error) {

        console.log("Rugcheck skip");

        return false;
    }
}

// =====================================
// MAIN SCAN
// =====================================

async function getNewTokens() {

    try {

        const response = await axios.get(
            "https://api.dexscreener.com/token-profiles/latest/v1"
        );

        const tokens = response.data;

        for (const pair of tokens) {

            // =====================================
            // BASIC DATA
            // =====================================

            const chain =
                pair.chainId || "Unknown";

            const name =
                pair.tokenName ||
                pair.baseToken?.name ||
                "Unknown";

            const symbol =
                pair.tokenSymbol ||
                pair.baseToken?.symbol ||
                "Unknown";

            const contract =
                pair.tokenAddress ||
                pair.baseToken?.address ||
                "Unknown";

            // =====================================
            // ANTI DUPLICATE
            // =====================================

            if (sentTokens.has(contract)) {

                console.log("Duplicate skip");

                continue;
            }

            const website =
                pair.info?.websites?.[0]?.url ||
                "No Website";

            const twitter =
                pair.info?.socials?.find(
                    s => s.type === "twitter"
                )?.url || "No Twitter";

            const liquidity =
                pair.liquidity?.usd || 0;

            const volume =
                pair.volume?.h24 || 0;

            const marketcap =
                pair.marketCap || 0;

            // =====================================
            // AGE TOKEN
            // =====================================

            const createdAt =
                pair.pairCreatedAt || 0;

            const ageMinutes =
                (Date.now() - createdAt) / 1000 / 60;

            // =====================================
            // FILTER CHAIN
            // =====================================

            if (
                chain !== "solana" &&
                chain !== "ethereum" &&
                chain !== "bsc"
            ) {

                console.log("Chain skip");

                continue;
            }

            // =====================================
            // FILTER AGE
            // =====================================

            if (ageMinutes > 15) {

                console.log("Age skip");

                continue;
            }

            // =====================================
            // FILTER SOCIAL
            // =====================================

            if (
                website === "No Website" &&
                twitter === "No Twitter"
            ) {

                console.log("Social skip");

                continue;
            }

            // =====================================
            // FILTER LIQUIDITY
            // =====================================

            if (liquidity < 10000) {

                console.log("Liquidity skip");

                continue;
            }

            // =====================================
            // FILTER VOLUME
            // =====================================

            if (volume < 20000) {

                console.log("Volume skip");

                continue;
            }

            // =====================================
            // FILTER MARKETCAP
            // =====================================

            if (
                marketcap < 20000 ||
                marketcap > 500000
            ) {

                console.log("Marketcap skip");

                continue;
            }

            // =====================================
            // RUGCHECK
            // =====================================

            const isSafe =
                await checkTokenSafety(contract);

            if (!isSafe) {

                continue;
            }

            // =====================================
            // MESSAGE
            // =====================================

            const message = `
🚀 NEW TOKEN DETECTED

🪙 Name:
${name} (${symbol})

⛓ Chain:
${chain}

⏱ Age:
${Math.floor(ageMinutes)} minutes

💧 Liquidity:
$${Number(liquidity).toLocaleString()}

📈 Volume 24H:
$${Number(volume).toLocaleString()}

💰 Marketcap:
$${Number(marketcap).toLocaleString()}

🌐 Website:
${website}

🐦 Twitter:
${twitter}

📜 Contract:
${contract}
`;

            console.log(message);

            await bot.sendMessage(
                process.env.CHAT_ID,
                message
            );

            // =====================================
            // SIMPAN TOKEN
            // =====================================

            sentTokens.add(contract);
        }

    } catch (error) {

        console.log("ERROR:");
        console.log(error.message);
    }
}

// =====================================
// START
// =====================================

getNewTokens();

// =====================================
// AUTO SCAN
// =====================================

setInterval(() => {

    console.log("Scanning new tokens...");

    getNewTokens();

}, 30000);