const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;
const moment = require('moment-timezone');
const axios = require('axios');

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
    "ICICIGI.NS", "ICICIPRULI.NS", "LICIHSGFIN.NS", "M&MFIN.NS", "MANAPPURAM.NS",
    "MUTHOOTFIN.NS", "PEL.NS", "PFC.NS", "POONAWALLA.NS", "RECLTD.NS", "SBICARD.NS",
    "SBILIFE.NS", "SHRIRAMFIN.NS", "ADANIGREEN.NS", "ADANIPORTS.NS", "BPCL.NS",
    "GAIL.NS", "GUJGASLTD.NS", "IGL.NS", "IOC.NS", "MGL.NS", "NTPC.NS", "OIL.NS",
    "ONGC.NS", "PETRONET.NS", "POWERGRID.NS", "RELIANCE.NS", "SJVN.NS", "TATAPOWER.NS",
    "ADANIENSOL.NS", "NHPC.NS", "ACC.NS", "AMBUJACEM.NS", "DALBHARAT.NS", "JKCEMENT.NS",
    "RAMCOCEM.NS", "SHREECEM.NS", "ULTRACEMCO.NS", "APLAPOLLO.NS", "HINDALCO.NS",
    "HINDCOPPER.NS", "JINDALSTEL.NS", "JSWSTEEL.NS", "NATIONALUM.NS", "NMDC.NS",
    "SAIL.NS", "TATASTEEL.NS", "VEDL.NS", "BSOFT.NS", "COFORGE.NS", "CYIENT.NS",
    "INFY.NS", "LTIM.NS", "LTTS.NS", "MPHASIS.NS", "PERSISTENT.NS", "TATAELXSI.NS",
    "TCS.NS", "TECHM.NS", "WIPRO.NS", "ASHOKLEY.NS", "BAJAJ-AUTO.NS", "BHARATFORG.NS",
    "EICHERMOT.NS", "HEROMOTOCO.NS", "M&M.NS", "MARUTI.NS", "MOTHERSON.NS",
    "TATAMOTORS.NS", "TVSMOTOR.NS", "ABFRL.NS", "DMART.NS", "NYKAA.NS", "PAGEIND.NS",
    "PAYTM.NS", "TRENT.NS", "VBL.NS", "ZOMATO.NS", "ASIANPAINT.NS", "BERGEPAINT.NS",
    "BRITANNIA.NS", "COLPAL.NS", "DABUR.NS", "GODREJCP.NS", "HINDUNILVR.NS",
    "ITC.NS", "MARICO.NS", "NESTLEIND.NS", "TATACONSUM.NS", "UBL.NS", "UNITEDSPR.NS", 
    "ALKEM.NS", "APLLTD.NS", "AUROPHARMA.NS", "BIOCON.NS", "CIPLA.NS",
    "DIVISLAB.NS", "DRREDDY.NS", "GLENMARK.NS", "GRANULES.NS", "LAURUSLABS.NS", "LUPIN.NS",
    "SUNPHARMA.NS", "SYNGENE.NS", "TORNTPHARM.NS", "APOLLOHOSP.NS", "LALPATHLAB.NS",
    "MAXHEALTH.NS", "METROPOLIS.NS", "BHARTIARTL.NS", "HFCL.NS", "IDEA.NS", "INDUSTOWER.NS",
    "DLF.NS", "GODREJPROP.NS", "LODHA.NS", "OBEROIRLTY.NS", "PRESTIGE.NS", "GUJGASLTD.NS",
    "IGL.NS", "MGL.NS", "CONCOR.NS", "CESC.NS", "HUDCO.NS", "IRFC.NS", "ABBOTINDIA.NS",
    "BEL.NS", "CGPOWER.NS", "CUMMINSIND.NS", "HAL.NS", "L&T.NS", "SIEMENS.NS", "TIINDIA.NS",
    "CHAMBLFERT.NS", "COROMANDEL.NS", "GNFC.NS", "PIIND.NS", "BSE.NS", "DELHIVERY.NS",
    "GMRAIRPORT.NS", "IRCTC.NS", "KEI.NS", "NAVINFLUOR.NS", "POLYCAB.NS", "SUNTV.NS", "UPL.NS"
];

const PREVIOUS_DAY_URL = "https://local-high-production.up.railway.app/stocks";
let lastInsideBarsData = null;

const fetchHourlyCandleData = async (manualRun = false) => {
    let insideBars = [];
    const now = moment().tz("Asia/Kolkata");
    
    // If manual run, fetch last complete candle pair
    let end = manualRun ? now.startOf('hour') : now.startOf('hour').subtract(1, 'hour');
    let start = end.clone().subtract(2, 'hour'); // Fetch last 2 completed candles

    try {
        const previousDayDataResponse = await axios.get(PREVIOUS_DAY_URL);
        const previousDayData = previousDayDataResponse.data;

        for (const stock of stocks) {
            try {
                const result = await yahooFinance.chart(stock, {
                    period1: start.toISOString(),
                    period2: end.toISOString(),
                    interval: '1h'
                });

                if (!result || !result.quotes || result.quotes.length < 2) {
                    console.log(`⚠️ Not enough candles for ${stock}`);
                    continue;
                }

                const candles = result.quotes.slice(-2); // Last 2 candles
                const motherCandle = candles[0]; // (T-2) to (T-1)
                const babyCandle = candles[1]; // (T-1) to T

                const motherHigh = motherCandle.high || 0;
                const motherLow = motherCandle.low || 0;
                const babyHigh = babyCandle.high || 0;
                const babyLow = babyCandle.low || 0;

                const isInsideBar = babyHigh <= motherHigh && babyLow >= motherLow;

                let type = "Neutral Inside Bar";
                let prevDayHigh = previousDayData.find(s => s.symbol === stock)?.high || 0;
                let prevDayLow = previousDayData.find(s => s.symbol === stock)?.low || 0;

                if (isInsideBar) {
                    if (motherHigh > prevDayHigh) {
                        type = "Bullish Inside Bar";
                    } else if (motherLow < prevDayLow) {
                        type = "Bearish Inside Bar";
                    }

                    let motherCandleChange = ((motherCandle.close - motherCandle.open) / motherCandle.open) * 100;
                    let babyCandleChange = ((babyCandle.close - babyCandle.open) / babyCandle.open) * 100;

                    insideBars.push({
                        symbol: stock,
                        isInsideBar: true,
                        type: type,
                        motherCandle: {
                            timestamp: moment(motherCandle.date).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
                            high: motherHigh,
                            low: motherLow,
                            change: motherCandleChange.toFixed(2) + "%"
                        },
                        babyCandle: {
                            timestamp: moment(babyCandle.date).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
                            high: babyHigh,
                            low: babyLow,
                            change: babyCandleChange.toFixed(2) + "%"
                        }
                    });
                }
            } catch (error) {
                console.error(`Error fetching data for ${stock}:`, error.message);
            }
        }

        lastInsideBarsData = insideBars;
        return insideBars;
    } catch (error) {
        console.error("Error fetching previous day data:", error.message);
        return [];
    }
};

app.get('/inside-bars', async (req, res) => {
    const result = await fetchHourlyCandleData(false);
    res.json(result);
});

// Manual run endpoint
app.get('/manual-run', async (req, res) => {
    if (lastInsideBarsData) {
        return res.json(lastInsideBarsData);
    }

    const result = await fetchHourlyCandleData(true);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
