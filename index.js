# Full `index.js` — Professional Sniper Scanner

```javascript
require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const WebSocket = require("ws");

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

    if (liquidity > 3000) score += 20;
    if (liquidity > 10000) score += 10;

    // VOLUME

    if (volume > 5000) score += 20;
    if (volume > 20000) score += 10;

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
            "https://api.dexscreener.com/latest/dex/pairs/solana"
        );

        const tokens =
            response.data.pairs || [];

        for (const pair of tokens) {

            // =====================================
            // BASIC DATA
            // =====================================

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
            // LIQUIDITY RATIO
            // =====================================

            const liquidityRatio =
                liquidity / marketcap;

            // =====================================
            // HOLDER ESTIMATION
            // =====================================

            const estimatedHolders =
                Math.floor(
                    volume / 150
                );

            // =====================================
            // AGE TOKEN
            // =====================================

            const createdAt =
                pair.pairCreatedAt || 0;

            const ageMinutes =
                (Date.now() - createdAt)
                / 1000 / 60;

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

            if (
                liquidity < 3000
            ) {

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
            // ANTI FAKE VOLUME
            // =====================================

            if (
                volume > liquidity * 20
            ) {

                console.log(
                    "Fake volume skip"
                );

                continue;
            }

            // =====================================
            // ANTI WEAK LIQUIDITY
            // =====================================

            if (
                liquidityRatio < 0.15
            ) {

                console.log(
                    "Weak liquidity ratio"
                );

                continue;
            }

            // =====================================
            // ANTI DEAD TOKEN
            // =====================================

            if (
                volume < liquidity * 0.3
            ) {

                console.log(
                    "Dead token skip"
                );

                continue;
            }

            // =====================================
            // HOLDER FILTER
            // =====================================

            if (
                estimatedHolders < 20
            ) {

                console.log(
                    "Low holders skip"
                );

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
            // ONLY STRONG SIGNAL
            // =====================================

            if (score < 45) {

                console.log(
                    "Low score skip"
                );

                continue;
            }

            // =====================================
            // SAVE TOKEN
            // =====================================

            sentTokens.add(contract);

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

// =====================================
// PUMP.FUN REALTIME SCANNER
// =====================================

function startPumpFunScanner() {

    const ws = new WebSocket(
        "wss://pumpportal.fun/api/data"
    );

    ws.on("open", () => {

        console.log(
            "Pump.fun scanner connected"
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

            if (marketcap < 20) {

                console.log(
                    "Pump low MC skip"
                );

                return;
            }

            if (liquidity < 10) {

                console.log(
                    "Pump low liquidity"
                );

                return;
            }

            if (volume < 20) {

                console.log(
                    "Pump dead token"
                );

                return;
            }

            if (
                volume > liquidity * 20
            ) {

                console.log(
                    "Pump fake volume"
                );

                return;
            }

            if (
                liquidityRatio < 0.15
            ) {

                console.log(
                    "Pump weak liquidity"
                );

                return;
            }

            if (
                estimatedHolders < 10
            ) {

                console.log(
                    "Pump low holders"
                );

                return;
            }

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

                    console.log(
                        "Pump scam skip"
                    );

                    return;
                }
            }

            const isSafe =
                await checkTokenSafety(
                    contract
                );

            if (!isSafe) {

                return;
            }

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

            if (score < 45) {

                console.log(
                    "Pump low score"
                );

                return;
            }

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
                "Pumpfun parse error"
            );

            console.log(error.message);
        }
    });

    ws.on("close", () => {

        console.log(
            "Pump.fun disconnected"
        );

        setTimeout(() => {

            startPumpFunScanner();

        }, 5000);
    });
}

// =====================================
// START PUMP SCANNER
// =====================================

startPumpFunScanner();
```
