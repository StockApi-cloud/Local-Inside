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
    "AXISBANK.NS", "AUBANK.NS", "BANDHANBNK.NS", "BANKBARODA.NS", "BANKINDIA.NS", "CANBK.NS", "CUB.NS", "FEDERALBNK.NS", "HDFCBANK.NS", "ICICIBANK.NS", "IDFCFIRSTB.NS", "INDUSINDBK.NS", "KOTAKBANK.NS", "PNB.NS", "RBLBANK.NS", "SBIN.NS", "YESBANK.NS", "ABCAPITAL.NS", "ANGELONE.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "CANFINHOME.NS", "CHOLAFIN.NS", "HDFCAMC.NS", "HDFCLIFE.NS", "ICICIGI.NS", "ICICIPRULI.NS", "M&MFIN.NS", "MANAPPURAM.NS", "MUTHOOTFIN.NS", "PEL.NS", "PFC.NS", "POONAWALLA.NS", "RECLTD.NS", "SBICARD.NS", "SBILIFE.NS", "SHRIRAMFIN.NS", "ADANIGREEN.NS", "ADANIPORTS.NS", "BPCL.NS", "GAIL.NS", "GUJGASLTD.NS", "IGL.NS", "IOC.NS", "MGL.NS", "NTPC.NS", "OIL.NS", "ONGC.NS", "PETRONET.NS", "POWERGRID.NS", "RELIANCE.NS", "SJVN.NS", "TATAPOWER.NS", "ADANIENSOL.NS", "NHPC.NS", "ACC.NS", "AMBUJACEM.NS", "DALBHARAT.NS", "JKCEMENT.NS", "RAMCOCEM.NS", "SHREECEM.NS", "ULTRACEMCO.NS", "APLAPOLLO.NS", "HINDALCO.NS", "HINDCOPPER.NS", "JINDALSTEL.NS", "JSWSTEEL.NS", "NATIONALUM.NS", "NMDC.NS", "SAIL.NS", "TATASTEEL.NS", "VEDL.NS", "BSOFT.NS", "COFORGE.NS", "CYIENT.NS", "INFY.NS", "LTIM.NS", "LTTS.NS", "MPHASIS.NS", "PERSISTENT.NS", "TATAELXSI.NS", "TCS.NS", "TECHM.NS", "WIPRO.NS", "ASHOKLEY.NS", "BAJAJ-AUTO.NS", "BHARATFORG.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "M&M.NS", "MARUTI.NS", "MOTHERSON.NS", "TATAMOTORS.NS", "TVSMOTOR.NS", "ABFRL.NS", "DMART.NS", "NYKAA.NS", "PAGEIND.NS", "PAYTM.NS", "TRENT.NS", "VBL.NS", "ZOMATO.NS", "ASIANPAINT.NS", "BERGEPAINT.NS", "BRITANNIA.NS", "COLPAL.NS", "DABUR.NS", "GODREJCP.NS", "HINDUNILVR.NS", "ITC.NS", "MARICO.NS", "NESTLEIND.NS", "TATACONSUM.NS", "UBL.NS", "ALKEM.NS", "APLLTD.NS", "AUROPHARMA.NS", "BIOCON.NS", "CIPLA.NS", "DIVISLAB.NS", "DRREDDY.NS", "GLENMARK.NS", "GRANULES.NS", "LAURUSLABS.NS", "LUPIN.NS", "SUNPHARMA.NS", "SYNGENE.NS", "TORNTPHARM.NS", "APOLLOHOSP.NS", "LALPATHLAB.NS", "MAXHEALTH.NS", "METROPOLIS.NS", "BHARTIARTL.NS", "HFCL.NS", "IDEA.NS", "INDUSTOWER.NS", "DLF.NS", "GODREJPROP.NS", "LODHA.NS", "OBEROIRLTY.NS", "PRESTIGE.NS", "GUJGASLTD.NS", "IGL.NS", "MGL.NS", "CONCOR.NS", "CESC.NS", "HUDCO.NS", "IRFC.NS", "ABBOTINDIA.NS", "BEL.NS", "CGPOWER.NS", "CUMMINSIND.NS", "HAL.NS","SIEMENS.NS", "TIINDIA.NS", "CHAMBLFERT.NS", "COROMANDEL.NS", "GNFC.NS", "PIIND.NS", "BSE.NS", "DELHIVERY.NS", "GMRAIRPORT.NS", "IRCTC.NS", "KEI.NS", "NAVINFLUOR.NS", "POLYCAB.NS", "SUNTV.NS", "UPL.NS"
];

const PREVIOUS_DAY_API = "https://previous-day-high-production.up.railway.app/stocks";
let lastInsideBarsData = null;
let lastFetchTime = null; // To track the last fetch time

// Function to fetch inside bar stocks
const fetchHourlyCandleData = async () => {
    const now = moment().tz("Asia/Kolkata");
    const end = now.clone().startOf('hour');
    const start = end.clone().subtract(2, 'hour');

    let insideBars = [];

    try {
        const prevDayResponse = await axios.get(PREVIOUS_DAY_API);
        const prevDayData = prevDayResponse.data;

        for (const stock of stocks) {
            try {
                const result = await yahooFinance.chart(stock, {
                    period1: start.toISOString(),
                    period2: end.toISOString(),
                    interval: '1h'
                });

                if (!result || !result.quotes || result.quotes.length < 2) {
                    console.log(`⚠️ Not enough candles for ${stock}`);
                    insideBars.push({ symbol: stock, isInsideBar: false });
                    continue;
                }

                const candles = result.quotes.slice(-2);
                const motherCandle = candles[0];
                const babyCandle = candles[1];

                const isInsideBar = babyCandle.high <= motherCandle.high && babyCandle.low >= motherCandle.low;

                
                const prevDayStock = prevDayData.find(item => item.symbol === stock);
                const prevDayHigh = prevDayStock ? prevDayStock.high : null;
                const prevDayLow = prevDayStock ? prevDayStock.low : null;

                let type = "Neutral Inside Bar";
                if (isInsideBar && prevDayHigh !== null && prevDayLow !== null) {
                    if (motherCandle.high > prevDayHigh) type = "Bullish Inside Bar";
                    else if (motherCandle.low < prevDayLow) type = "Bearish Inside Bar";
                }

                // Correctly calculate the change based on the open and low of the mother candle
                let motherCandleChange = ((motherCandle.close - motherCandle.open) / motherCandle.open) * 100;

                insideBars.push({
                    symbol: stock,
                    isInsideBar,
                    type: isInsideBar ? type : "N/A",
                    motherCandle: {
                        timestamp: moment(motherCandle.date).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
                        high: motherCandle.high,
                        low: motherCandle.low,  // Ensure this is the low of the mother candle
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
    lastFetchTime = now; // Update the last fetch time
    return insideBars;
};

// Schedule task at 11:17, 12:17, 13:17, 14:17, 15:17
const scheduleTimes = ['17 11 * * *', '17 12 * * *', '17 13 * * *', '17 14 * * *', '17 15 * * *'];
scheduleTimes.forEach(time => {
    schedule.scheduleJob(time, async () => {
        console.log(`🔄 Fetching inside bars at ${moment().tz("Asia/Kolkata").format("HH:mm")}`);
        await fetchHourlyCandleData();
    });
});

// API Route to get inside bars
app.get('/inside-bars', async (req, res) => {
    if (!lastInsideBarsData || !lastFetchTime || moment().tz("Asia/Kolkata").diff(lastFetchTime, 'minutes') >= 60) {
        await fetchHourlyCandleData();
    }
    res.json(lastInsideBarsData);
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
