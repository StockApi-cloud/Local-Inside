const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;
const moment = require('moment-timezone');
const axios = require('axios');
const schedule = require('node-schedule');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const stocks = [
    "AXISBANK.NS", "AUBANK.NS", "BANDHANBNK.NS", "BANKBARODA.NS", "BANKINDIA.NS",
    "CANBK.NS", "CUB.NS", "FEDERALBNK.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "IDFCFIRSTB.NS", "INDUSINDBK.NS", "KOTAKBANK.NS", "PNB.NS", "RBLBANK.NS",
    "SBIN.NS", "YESBANK.NS", "ABCAPITAL.NS", "ANGELONE.NS", "BAJFINANCE.NS",
    "BAJAJFINSV.NS", "CANFINHOME.NS", "CHOLAFIN.NS", "HDFCAMC.NS", "HDFCLIFE.NS",
    "ICICIGI.NS", "ICICIPRULI.NS", "M&MFIN.NS", "MANAPPURAM.NS", "MUTHOOTFIN.NS",
    "PEL.NS", "PFC.NS", "POONAWALLA.NS", "RECLTD.NS", "SBICARD.NS",
    "SBILIFE.NS", "SHRIRAMFIN.NS", "ADANIGREEN.NS", "ADANIPORTS.NS", "BPCL.NS",
    "GAIL.NS", "GUJGASLTD.NS", "IGL.NS", "IOC.NS", "MGL.NS",
    "NTPC.NS", "OIL.NS", "ONGC.NS", "PETRONET.NS", "POWERGRID.NS",
    "RELIANCE.NS", "SJVN.NS", "TATAPOWER.NS", "ADANIENSOL.NS", "NHPC.NS",
    "ACC.NS", "AMBUJACEM.NS", "DALBHARAT.NS", "JKCEMENT.NS", "RAMCOCEM.NS",
    "SHREECEM.NS", "ULTRACEMCO.NS", "APLAPOLLO.NS", "HINDALCO.NS", "HINDCOPPER.NS",
    "JINDALSTEL.NS", "JSWSTEEL.NS", "NATIONALUM.NS", "NMDC.NS", "SAIL.NS",
    "TATASTEEL.NS", "VEDL.NS", "BSOFT.NS", "COFORGE.NS", "CYIENT.NS",
    "INFY.NS", "LTIM.NS", "LTTS.NS", "MPHASIS.NS", "PERSISTENT.NS",
    "TATAELXSI.NS", "TCS.NS", "TECHM.NS", "WIPRO.NS", "ASHOKLEY.NS",
    "BAJAJ-AUTO.NS", "BHARATFORG.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "M&M.NS",
    "MARUTI.NS", "MOTHERSON.NS", "TATAMOTORS.NS", "TVSMOTOR.NS", "ABFRL.NS",
    "DMART.NS", "NYKAA.NS", "PAGEIND.NS", "PAYTM.NS", "TRENT.NS",
    "VBL.NS", "ZOMATO.NS", "ASIANPAINT.NS", "BERGEPAINT.NS", "BRITANNIA.NS",
    "COLPAL.NS", "DABUR.NS", "GODREJCP.NS", "HINDUNILVR.NS", "ITC.NS",
    "MARICO.NS", "NESTLEIND.NS", "TATACONSUM.NS", "UBL.NS", "ALKEM.NS",
    "APLLTD.NS", "AUROPHARMA.NS", "BIOCON.NS", "CIPLA.NS", "DIVISLAB.NS",
    "DRREDDY.NS", "GLENMARK.NS", "GRANULES.NS", "LAURUSLABS.NS", "LUPIN.NS",
    "SUNPHARMA.NS", "SYNGENE.NS", "TORNTPHARM.NS", "APOLLOHOSP.NS", "LALPATHLAB.NS",
    "MAXHEALTH.NS", "METROPOLIS.NS", "BHARTIARTL.NS", "HFCL.NS", "IDEA.NS",
    "INDUSTOWER.NS", "DLF.NS", "GODREJPROP.NS", "LODHA.NS", "OBEROIRLTY.NS",
    "PRESTIGE.NS", "GUJGASLTD.NS", "IGL.NS", "MGL.NS", "CONCOR.NS",
    "CESC.NS", "HUDCO.NS", "IRFC.NS", "ABBOTINDIA.NS", "BEL.NS",
    "CGPOWER.NS", "CUMMINSIND.NS", "HAL.NS", "SIEMENS.NS", "TIINDIA.NS",
    "CHAMBLFERT.NS", "COROMANDEL.NS", "GNFC.NS", "PIIND.NS", "BSE.NS",
    "DELHIVERY.NS", "GMRAIRPORT.NS", "IRCTC.NS", "KEI.NS", "NAVINFLUOR.NS",
    "POLYCAB.NS", "SUNTV.NS", "UPL.NS"
];

const PREVIOUS_DAY_API = "https://local-high-production.up.railway.app/stocks";
let lastInsideBarsData = null;
let lastFetchTime = null; // To track the last fetch time

// Function to fetch inside bar stocks
const fetchHourlyCandleData = async (motherStart, motherEnd, babyStart, babyEnd) => {
    let insideBars = [];

    try {
        const prevDayResponse = await axios.get(PREVIOUS_DAY_API);
        const prevDayData = prevDayResponse.data;

        for (const stock of stocks) {
            try {
                // Fetch mother candle data
                const motherResult = await yahooFinance.chart(stock, {
                    period1: motherStart.toISOString(),
                    period2: motherEnd.toISOString(),
                    interval: '1h'
                });

                // Fetch baby candle data
                const babyResult = await yahooFinance.chart(stock, {
                    period1: babyStart.toISOString(),
                    period2: babyEnd.toISOString(),
                    interval: '1h'
                });

                if (!motherResult || !motherResult.quotes || motherResult.quotes.length < 1) {
                    console.log(`⚠️ Not enough candles for ${stock} (Mother)`);
                    insideBars.push({ symbol: stock, isInsideBar: false });
                    continue;
                }

                if (!babyResult || !babyResult.quotes || babyResult.quotes.length < 1) {
                    console.log(`⚠️ Not enough candles for ${stock} (Baby)`);
                    insideBars.push({ symbol: stock, isInsideBar: false });
                    continue;
                }

                const motherCandle = motherResult.quotes[motherResult.quotes.length - 1];
                const babyCandle = babyResult.quotes[babyResult.quotes.length - 1];

                const isInsideBar = babyCandle.high <= motherCandle.high && babyCandle.low >= motherCandle.low;

                const prevDayStock = prevDayData.find(item => item.symbol === stock);
                const prevDayHigh = prevDayStock ? prevDayStock.high : null;
                const prevDayLow = prevDayStock ? prevDayStock.low : null;

                let type = "Neutral Inside Bar";
                if (isInsideBar && prevDayHigh !== null && prevDayLow !== null) {
                    if (motherCandle.high > prevDayHigh) type = "Bullish Inside Bar";
                    else if (motherCandle.low < prevDayLow) type = "Bearish Inside Bar";
                }

                let motherCandleChange = ((motherCandle.close - motherCandle.open) / motherCandle.open) * 100;

                insideBars.push({
                    symbol: stock,
                    isInsideBar,
                    type: isInsideBar ? type : "N/A",
                    motherCandle: {
                        timestamp: moment(motherCandle.date).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
                        high: motherCandle.high,
                        low: motherCandle.low,
                        change: motherCandleChange.toFixed(2) + "%"
                    },
                    babyCandle: {
                        timestamp: moment(babyCandle.date).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
                        high: babyCandle.high,
                        low: babyCandle.low
                    },
                    prevDay: {
                        high: prevDayHigh,
                        low: prevDayLow
                    }
                });
            } catch (error) {
                console.error(`❌ Error fetching data for ${stock}:`, error.message);
                insideBars.push({ symbol: stock, isInsideBar: false });
            }
        }
    } catch (error) {
        console.error("❌ Error fetching previous day data:", error.message);
    }

    lastInsideBarsData = insideBars;
    lastFetchTime = moment(); // Update the last fetch time
    return insideBars;
};

// Function to schedule tasks dynamically
const scheduleTasks = () => {
    const now = moment().tz("Asia/Kolkata");
    const today = now.clone().startOf('day');

    const scheduleTimes = [
        { hour: 11, minute: 17 },
        { hour: 12, minute: 17 },
        { hour: 13, minute: 17 },
        { hour: 14, minute: 17 },
        { hour: 15, minute: 17 }
    ];

    scheduleTimes.forEach(({ hour, minute }, index) => {
        const motherStart = today.clone().add(9 + index, 'hours').add(15, 'minutes'); // 9:15 AM + index hours
        const motherEnd = motherStart.clone().add(1, 'hours'); // 1 hour later
        const babyStart = motherEnd.clone(); // Start of baby candle is end of mother candle
        const babyEnd = babyStart.clone().add(1, 'hours'); // 1 hour later

        schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
            console.log(`🔄 Fetching inside bars at ${moment().tz("Asia/Kolkata").format("HH:mm")}`);
            await fetchHourlyCandleData(motherStart, motherEnd, babyStart, babyEnd);
        });
    });
};

// Start scheduling tasks
scheduleTasks();

// API Route to get inside bars
app.get('/inside-bars', async (req, res) => {
    const now = moment().tz("Asia/Kolkata");
    const scheduledTimes = [
        { hour: 11, minute: 17 },
        { hour: 12, minute: 17 },
        { hour: 13, minute: 17 },
        { hour: 14, minute: 17 },
        { hour: 15, minute: 17 }
    ];

    const isScheduledTime = scheduledTimes.some(({ hour, minute }) => {
        const scheduledMoment = moment.tz(now.clone().set({ hour, minute, second: 0, millisecond: 0 }), "Asia/Kolkata");
        return now.isSame(scheduledMoment, 'minute');
    });

    if (!isScheduledTime) {
        // If not a scheduled time, return the last fetched data
        if (lastInsideBarsData) {
            return res.json(lastInsideBarsData);
        } else {
            return res.status(404).json({ message: "No data available yet." });
        }
    }

    // If it is a scheduled time, check if data is available
    if (!lastInsideBarsData || !lastFetchTime || now.diff(lastFetchTime, 'minutes') >= 60) {
        return res.status(503).json({ message: "Data is being fetched, please try again later." });
    } else {
        return res.json(lastInsideBarsData);
    }
});

// Manual test endpoint to fetch data immediately
app.get('/test-fetch', async (req, res) => {
    console.log("🔄 Manually fetching inside bars data...");
    const data = await fetchHourlyCandleData();
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});