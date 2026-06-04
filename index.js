require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const WebSocket = require("ws");

const bot = new TelegramBot(process.env.BOT_TOKEN);

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

        if (data.honeypot === true) {

            console.log("HONEYPOT SKIP");

            return false;
        }

        if (data.riskLevel === "HIGH") {

            console.log("HIGH RISK SKIP");

            return false;
        }

        return true;

    } catch (error) {

        console.log("RUGCHECK ERROR");

        return false;
    }
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

    if (liquidity > 3000) score += 20;
    if (liquidity > 10000) score += 10;

    if (volume > 5000) score += 20;
    if (volume > 20000) score += 10;

    if (
        marketcap > 10000 &&
        marketcap < 150000
    ) {

        score += 20;
    }

    score += socialScore * 10;

    if (whaleBuy) {

        score += 10;
    }

    return score;
}

// =====================================
// MOMENTUM
// =====================================

function getMomentumScore(
    liquidity,
    volume,
    marketcap
) {

    let momentum = 0;

    const ratio = volume / liquidity;

    if (ratio >= 1) momentum += 20;
    if (ratio >= 2) momentum += 20;
    if (ratio >= 3) momentum += 20;

    if (marketcap < 150000) {

        momentum += 20;
    }

    return momentum;
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
// DEXSCREENER SCANNER
// =====================================

async function getNewTokens() {

    try {

        const response = await axios.get(
            "https://api.dexscreener.com/token-profiles/latest/v1"
        );

        const tokens =
            response.data.pairs || [];

        for (const pair of tokens) {

            const chain =
                pair.chainId || "Unknown";

            const name =
                pair.baseToken?.name ||
                "Unknown";

            const symbol =
                pair.baseToken?.symbol ||
                "Unknown";

            const contract =
                pair.baseToken?.address ||
                "Unknown";

            if (sentTokens.has(contract)) {

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

            const liquidityRatio =
                liquidity / marketcap;

            const estimatedHolders =
                Math.floor(volume / 150);

            const createdAt =
                pair.pairCreatedAt || 0;

            const ageMinutes =
                (Date.now() - createdAt)
                / 1000 / 60;

            // =====================================
            // FILTERS
            // =====================================

            if (ageMinutes > 15) continue;

            if (liquidity < 3000) continue;

            if (volume < 2000) continue;

            if (
                volume > liquidity * 20
            ) continue;

            if (
                liquidityRatio < 0.15
            ) continue;

            if (
                volume < liquidity * 0.3
            ) continue;

            if (
                estimatedHolders < 20
            ) continue;

            if (
                marketcap < 10000 ||
                marketcap > 150000
            ) continue;

            // =====================================
            // RUGCHECK
            // =====================================

            const isSafe =
                await checkTokenSafety(contract);

            if (!isSafe) continue;

            // =====================================
            // SOCIAL
            // =====================================

            const socialScore =
                getSocialScore(
                    website,
                    twitter
                );

            if (socialScore < 1) continue;

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
                : "NORMAL";

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

            const momentumScore =
                getMomentumScore(
                    liquidity,
                    volume,
                    marketcap
                );

            score += momentumScore;
            // =====================================
// ANTI DUMP SCORE
// =====================================

let antiDumpPenalty = 0;

// MARKETCAP TERLALU BESAR
// DIBANDING LIQUIDITY

if (
    marketcap > liquidity * 12
) {

    antiDumpPenalty += 10;
}

// VOLUME TERLALU LIAR

if (
    volume > liquidity * 8
) {

    antiDumpPenalty += 10;
}

// LIQUIDITY RATIO RENDAH

if (
    liquidityRatio < 0.20
) {

    antiDumpPenalty += 15;
}

// KURANGI SCORE

score -= antiDumpPenalty;
console.log(
    `${symbol} | score=${score} | liquidity=${liquidity} | volume=${volume}`
);

            if (score < 45) continue;

            sentTokens.add(contract);

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

👥 <b>Estimated Holders:</b>
${estimatedHolders}

💦 <b>Liquidity Ratio:</b>
${(liquidityRatio * 100).toFixed(1)}%

⚡ <b>Momentum Score:</b>
${momentumScore}

🤖 <b>AI Score:</b>
${score}/100
🛡 <b>Anti Dump Penalty:</b>
${antiDumpPenalty}

🐋 <b>Whale Alert:</b>
${whaleAlert}

🌐 <b>Website:</b>
${website}

🐦 <b>Twitter:</b>
${twitter}

📜 <b>Contract:</b>
<code>${contract}</code>
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
        }

    } catch (error) {

        console.log(error.message);
    }
}

// =====================================
// START NORMAL SCANNER
// =====================================

/*
getNewTokens();

setInterval(() => {

    console.log("SCANNING TOKENS...");

    getNewTokens();

}, 30000);
*/

// =====================================
// PUMPFUN REALTIME SCANNER
// =====================================

function startPumpFunScanner() {

    const ws = new WebSocket(
        "wss://pumpportal.fun/api/data"
    );

    ws.on("open", () => {

        console.log(
            "PUMPFUN CONNECTED"
        );

        ws.send(
            JSON.stringify({
                method:
                "subscribeNewToken"
            })
        );
    });

    ws.on("message", async (data) => {

        try {

            const token =
                JSON.parse(data);

                console.log(
    `NEW TOKEN: ${token.name} (${token.symbol})`
);

            const name =
                token.name || "Unknown";

            const symbol =
                token.symbol || "Unknown";

            const contract =
                token.mint || "Unknown";

            if (
                sentTokens.has(contract)
            ) {

                return;
            }

            const marketcap =
                token.marketCapSol || 0;

            const liquidity =
                token.vSolInBondingCurve || 0;

            const volume =
                token.marketCapSol || 0;

            const estimatedHolders =
                Math.floor(
                    marketcap / 80
                );

            const liquidityRatio =
                liquidity / marketcap;

            // =====================================
            // FILTERS
            // =====================================

            if (marketcap < 5) return;

            if (liquidity < 3) return;

            if (volume < 5) return;

            if (
                volume > liquidity * 20
            ) return;

            if (
                liquidityRatio < 0.15
            ) return;

            if (
                estimatedHolders < 10
            ) return;

            const lowerName =
                name.toLowerCase();

            const bannedWords = [
                "test",
                "scam",
                "fake",
                "rug",
                "hack"
            ];

            for (const word of bannedWords) {

                if (
                    lowerName.includes(word)
                ) {

                    return;
                }
            }

            // =====================================
            // RUGCHECK
            // =====================================

            const isSafe =
                await checkTokenSafety(
                    contract
                );

            if (!isSafe) return;

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
                : "NORMAL";

            // =====================================
            // AI SCORE
            // =====================================

            const socialScore = 1;

            let score =
                calculateScore(
                    liquidity,
                    volume,
                    marketcap,
                    socialScore,
                    whaleBuy
                );

            const momentumScore =
                getMomentumScore(
                    liquidity,
                    volume,
                    marketcap
                );

score += momentumScore;

let antiDumpPenalty = 0;

if (marketcap > liquidity * 12)
    antiDumpPenalty += 10;

if (volume > liquidity * 8)
    antiDumpPenalty += 10;

if (liquidityRatio < 0.20)
    antiDumpPenalty += 15;

score -= antiDumpPenalty;

console.log(
    `${symbol} | score=${score}`
);

if (score < 45) return;

            sentTokens.add(contract);

            setTimeout(() => {

                sentTokens.delete(contract);

            }, 1000 * 60 * 60);

            const message = `
🔥 <b>PUMP.FUN SNIPER SIGNAL</b>

🪙 <b>${name} (${symbol})</b>

💰 <b>Marketcap:</b>
${marketcap.toFixed(2)} SOL

💧 <b>Liquidity:</b>
${liquidity.toFixed(2)} SOL

👥 <b>Estimated Holders:</b>
${estimatedHolders}

💦 <b>Liquidity Ratio:</b>
${(liquidityRatio * 100).toFixed(1)}%

⚡ <b>Momentum Score:</b>
${momentumScore}

🤖 <b>AI Score:</b>
${score}/100

🐋 <b>Whale Alert:</b>
${whaleAlert}

📜 <b>Contract:</b>

<code>${contract}</code>

🚀 <b>Source:</b>
Pump.fun
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

        } catch (error) {

            console.log(
                "PUMPFUN ERROR"
            );

            console.log(error.message);
        }
    });

    ws.on("close", () => {

        console.log(
            "PUMPFUN DISCONNECTED"
        );

        setTimeout(() => {

            startPumpFunScanner();

        }, 5000);
    });
}

// =====================================
// START PUMPFUN
// =====================================

startPumpFunScanner();