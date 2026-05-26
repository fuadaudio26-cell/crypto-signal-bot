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
// MOMENTUM SCORE
// =====================================

function getMomentumScore(
    liquidity,
    volume,
    marketcap
) {

    let momentum = 0;

    const ratio =
        volume / liquidity;

    if (ratio >= 1) {

        momentum += 20;
    }

    if (ratio >= 2) {

        momentum += 20;
    }

    if (ratio >= 3) {

        momentum += 20;
    }

    // LOW MARKETCAP GEM

    if (marketcap < 150000) {

        momentum += 20;
    }

    return momentum;
}

// =====================================
// AI SCORE
// =====================================

function calculateScore(
    liquidity,
    volume,
    marketcap,
    socialScore,
    whaleBuy
) {

    let score = 0;

    // LIQUIDITY

    if (liquidity > 1500) score += 20;
    if (liquidity > 5000) score += 10;

    // VOLUME

    if (volume > 2000) score += 20;
    if (volume > 10000) score += 10;

    // MARKETCAP

    if (
        marketcap > 10000 &&
        marketcap < 150000
    ) {

        score += 20;
    }

    // SOCIAL

    score += socialScore * 10;

    // WHALE

    if (whaleBuy) {

        score += 10;
    }

    return score;
}

// =====================================
// SOCIAL SCORE
// =====================================

function getSocialScore(
    website,
    twitter
) {

    let socialScore = 0;

    if (website !== "No Website") {

        socialScore += 1;
    }

    if (twitter !== "No Twitter") {

        socialScore += 1;
    }

    return socialScore;
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

            // =====================================
            // SOCIAL
            // =====================================

            const website =
                pair.info?.websites?.[0]?.url ||
                "No Website";

            const twitter =
                pair.info?.socials?.find(
                    s => s.type === "twitter"
                )?.url || "No Twitter";

            // =====================================
            // MARKET DATA
            // =====================================

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
                (Date.now() - createdAt)
                / 1000 / 60;

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
            // FILTER LIQUIDITY
            // =====================================

            if (liquidity < 1500) {

                console.log("Liquidity skip");

                continue;
            }

            // =====================================
            // FILTER VOLUME
            // =====================================

            if (volume < 2000) {

                console.log("Volume skip");

                continue;
            }

            // =====================================
            // FILTER MARKETCAP
            // =====================================

            if (
                marketcap < 10000 ||
                marketcap > 150000
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
            // SOCIAL SCORE
            // =====================================

            const socialScore =
                getSocialScore(
                    website,
                    twitter
                );

            // WEBSITE ATAU TWITTER

            if (socialScore < 1) {

                console.log("Weak social skip");

                continue;
            }

            // =====================================
            // WHALE DETECTOR
            // =====================================

            let whaleBuy = false;

            if (
                volume > liquidity * 2
            ) {

                whaleBuy = true;
            }

            const whaleAlert =
                whaleBuy
                ? "🐋 BIG BUY DETECTED"
                : "Normal";

            // =====================================
            // AI SCORE
            // =====================================

            let score =
                calculateScore(
                    liquidity,
                    volume,
                    marketcap,
                    socialScore,
                    whaleBuy
                );

            // =====================================
            // MOMENTUM SCORE
            // =====================================

            const momentumScore =
                getMomentumScore(
                    liquidity,
                    volume,
                    marketcap
                );

            score += momentumScore;

            // =====================================
            // GEM PROBABILITY
            // =====================================

            let gemProbability = 0;

            if (score >= 25) {

                gemProbability = 40;
            }

            if (score >= 50) {

                gemProbability = 60;
            }

            if (score >= 70) {

                gemProbability = 80;
            }

            if (score >= 90) {

                gemProbability = 95;
            }

            // =====================================
            // SIGNAL LEVEL
            // =====================================

            let signal = "NORMAL";

            if (score >= 90) {

                signal = "🔥 ULTRA GEM";
            }

            else if (score >= 60) {

                signal = "🚀 STRONG";
            }

            else if (score >= 25) {

                signal = "⚠ MEDIUM";
            }

            // =====================================
            // PUMP DETECTOR
            // =====================================

            let pumpAlert = "Normal";

            if (
                volume > liquidity * 3
            ) {

                pumpAlert =
                    "🚀 POSSIBLE PUMP";
            }

            // =====================================
            // EXTRA FILTER
            // =====================================

            const bannedWords = [
                "test",
                "scam",
                "fake",
                "hack",
                "rug"
            ];

            const lowerName =
                name.toLowerCase();

            let banned = false;

            for (const word of bannedWords) {

                if (
                    lowerName.includes(word)
                ) {

                    banned = true;
                }
            }

            if (banned) {

                console.log("Meme skip");

                continue;
            }

            // =====================================
            // SCORE FILTER
            // =====================================

            if (score < 25) {

                console.log("Low score skip");

                continue;
            }

            // =====================================
            // DEX LINKS
            // =====================================

            const dexscreener =
            `https://dexscreener.com/${chain}/${contract}`;

            const dextools =
            `https://www.dextools.io/app/en/${chain}/pair-explorer/${contract}`;

            // =====================================
            // MESSAGE
            // =====================================

            const message = `
🚀 <b>NEW TOKEN DETECTED</b>

🪙 <b>${name} (${symbol})</b>

⛓ <b>Chain:</b>
${chain}

⏱ <b>Age:</b>
${Math.floor(ageMinutes)} minutes

💧 <b>Liquidity:</b>
$${Number(liquidity).toLocaleString()}

📈 <b>Volume:</b>
$${Number(volume).toLocaleString()}

💰 <b>Marketcap:</b>
$${Number(marketcap).toLocaleString()}

⚡ <b>Momentum Score:</b>
${momentumScore}

🤖 <b>AI Score:</b>
${score}/100

💎 <b>Gem Probability:</b>
${gemProbability}%

📊 <b>Signal:</b>
${signal}

🐋 <b>Whale Alert:</b>
${whaleAlert}

🚀 <b>Pump Alert:</b>
${pumpAlert}

🌐 <b>Website:</b>
${website}

🐦 <b>Twitter:</b>
${twitter}

📜 <b>Contract:</b>
<code>${contract}</code>

📊 <a href="${dexscreener}">DexScreener</a>

📈 <a href="${dextools}">DEXTools</a>
`;

            console.log(message);

            await bot.sendMessage(
                process.env.CHAT_ID,
                message,
                {
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                }
            );

            // =====================================
            // SAVE TOKEN
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