/**
 * ICT (Inner Circle Trader) Analysis Service
 * Identifies order blocks, liquidity levels, FVGs, and market structure
 */

export const identifyOrderBlocks = (candles) => {
  const orderBlocks = [];
  const avgRange = calculateAverageRange(candles.slice(-20));

  for (let i = 2; i < candles.length - 1; i++) {
    const prevCandle = candles[i - 1];
    const currentCandle = candles[i];
    const nextCandle = candles[i + 1];

    // Bullish Order Block: Down candle followed by strong up move
    if (
      currentCandle.close < currentCandle.open &&
      nextCandle.close > nextCandle.open &&
      nextCandle.high - nextCandle.low > avgRange * 1.5
    ) {
      orderBlocks.push({
        type: 'bullish',
        high: currentCandle.high,
        low: currentCandle.low,
        timestamp: currentCandle.timestamp,
        strength: calculateBlockStrength(currentCandle, nextCandle, 'bullish')
      });
    }

    // Bearish Order Block: Up candle followed by strong down move
    if (
      currentCandle.close > currentCandle.open &&
      nextCandle.close < nextCandle.open &&
      nextCandle.high - nextCandle.low > avgRange * 1.5
    ) {
      orderBlocks.push({
        type: 'bearish',
        high: currentCandle.high,
        low: currentCandle.low,
        timestamp: currentCandle.timestamp,
        strength: calculateBlockStrength(currentCandle, nextCandle, 'bearish')
      });
    }
  }

  return orderBlocks;
};

export const identifyLiquidityLevels = (candles, lookback = 20) => {
  const highs = [];
  const lows = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    const before = candles.slice(Math.max(0, i - lookback), i);
    const after = candles.slice(i + 1, Math.min(candles.length, i + lookback + 1));

    const beforeHigh = Math.max(...before.map(c => parseFloat(c.high)));
    const beforeLow = Math.min(...before.map(c => parseFloat(c.low)));
    const afterHigh = Math.max(...after.map(c => parseFloat(c.high)));
    const afterLow = Math.min(...after.map(c => parseFloat(c.low)));

    const currentHigh = parseFloat(current.high);
    const currentLow = parseFloat(current.low);

    // Swing High
    if (currentHigh > beforeHigh && currentHigh > afterHigh) {
      highs.push({
        price: currentHigh,
        timestamp: current.timestamp,
        type: 'swing_high'
      });
    }

    // Swing Low
    if (currentLow < beforeLow && currentLow < afterLow) {
      lows.push({
        price: currentLow,
        timestamp: current.timestamp,
        type: 'swing_low'
      });
    }
  }

  return { highs, lows };
};

export const identifyFairValueGaps = (candles) => {
  const fvgs = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];

    const prevHigh = parseFloat(prev.high);
    const nextLow = parseFloat(next.low);
    const prevLow = parseFloat(prev.low);
    const nextHigh = parseFloat(next.high);

    // Bullish FVG: Gap between prev high and next low
    if (prevHigh < nextLow) {
      fvgs.push({
        type: 'bullish',
        top: nextLow,
        bottom: prevHigh,
        timestamp: candles[i].timestamp,
        size: nextLow - prevHigh
      });
    }

    // Bearish FVG: Gap between prev low and next high
    if (prevLow > nextHigh) {
      fvgs.push({
        type: 'bearish',
        top: prevLow,
        bottom: nextHigh,
        timestamp: candles[i].timestamp,
        size: prevLow - nextHigh
      });
    }
  }

  return fvgs;
};

export const identifyMarketStructureShift = (candles, swingPoints) => {
  const mss = [];

  if (swingPoints.length < 3) return mss;

  for (let i = 2; i < swingPoints.length; i++) {
    const current = swingPoints[i];
    const prev = swingPoints[i - 1];
    const prevPrev = swingPoints[i - 2];

    // Bullish MSS: Higher low breaks above previous swing high
    if (
      current.type === 'swing_low' &&
      prev.type === 'swing_high' &&
      prevPrev.type === 'swing_low' &&
      current.price > prevPrev.price
    ) {
      mss.push({
        type: 'bullish',
        breakLevel: prevPrev.price,
        timestamp: current.timestamp,
        description: 'Bullish shift - Higher low above previous swing low'
      });
    }

    // Bearish MSS: Lower high breaks below previous swing low
    if (
      current.type === 'swing_high' &&
      prev.type === 'swing_low' &&
      prevPrev.type === 'swing_high' &&
      current.price < prevPrev.price
    ) {
      mss.push({
        type: 'bearish',
        breakLevel: prevPrev.price,
        timestamp: current.timestamp,
        description: 'Bearish shift - Lower high below previous swing high'
      });
    }
  }

  return mss;
};

export const identifySupplyDemandZones = (candles) => {
  const zones = [];
  const avgBody = calculateAverageBody(candles.slice(-20));

  let i = 1;
  while (i < candles.length - 2) {
    const c = candles[i];
    const body = Math.abs(parseFloat(c.close) - parseFloat(c.open));

    // Small consolidation candle (base candle)
    if (body < avgBody * 0.6) {
      // Collect the cluster of base candles
      let clusterStart = i;
      let clusterHigh = parseFloat(c.high);
      let clusterLow = parseFloat(c.low);
      let j = i;

      while (j < candles.length - 1) {
        const nextBody = Math.abs(parseFloat(candles[j].close) - parseFloat(candles[j].open));
        if (nextBody < avgBody * 0.6) {
          clusterHigh = Math.max(clusterHigh, parseFloat(candles[j].high));
          clusterLow = Math.min(clusterLow, parseFloat(candles[j].low));
          j++;
        } else {
          break;
        }
      }

      // The candle after the cluster is the "impulse" candle
      const impulse = candles[j];
      const avgRange = calculateAverageRange(candles.slice(Math.max(0, i - 10), i));
      const impulseRange = parseFloat(impulse.high) - parseFloat(impulse.low);

      if (impulseRange > avgRange * 1.5) {
        const type = parseFloat(impulse.close) > parseFloat(impulse.open) ? 'demand' : 'supply';
        zones.push({
          type,
          high: clusterHigh,
          low: clusterLow,
          startTimestamp: candles[clusterStart].timestamp,
          endTimestamp: candles[j].timestamp,
          strength: impulseRange / avgRange
        });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return zones;
};

export const identifyBreakerBlocks = (candles, orderBlocks) => {
  const breakerBlocks = [];

  for (const block of orderBlocks) {
    // Find candles after this order block's timestamp
    const blockTime = new Date(block.timestamp).getTime();
    const subsequentCandles = candles.filter(
      c => new Date(c.timestamp).getTime() > blockTime
    );

    let broken = false;
    let brokenAt = null;

    for (const candle of subsequentCandles) {
      const candleClose = parseFloat(candle.close);
      if (block.type === 'bullish') {
        // Bullish OB is broken when price closes below its low
        if (candleClose < block.low) {
          broken = true;
          brokenAt = candle.timestamp;
          break;
        }
      } else if (block.type === 'bearish') {
        // Bearish OB is broken when price closes above its high
        if (candleClose > block.high) {
          broken = true;
          brokenAt = candle.timestamp;
          break;
        }
      }
    }

    if (broken) {
      // A breaker block becomes a reversal zone in the opposite direction
      breakerBlocks.push({
        type: block.type === 'bullish' ? 'bearish_breaker' : 'bullish_breaker',
        high: block.high,
        low: block.low,
        originalTimestamp: block.timestamp,
        brokenAt
      });
    }
  }

  return breakerBlocks;
};

export const analyzeAllICTConcepts = (candles) => {
  // Convert all prices to numbers for calculations
  const normalizedCandles = candles.map(c => ({
    ...c,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.volume) || 0
  }));

  const orderBlocks = identifyOrderBlocks(normalizedCandles);
  const liquidityLevels = identifyLiquidityLevels(normalizedCandles);
  const fvgs = identifyFairValueGaps(normalizedCandles);
  const supplyDemandZones = identifySupplyDemandZones(normalizedCandles);
  const breakerBlocks = identifyBreakerBlocks(normalizedCandles, orderBlocks);

  // Combine all swing points for MSS analysis
  const allSwingPoints = [
    ...liquidityLevels.highs,
    ...liquidityLevels.lows
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const mss = identifyMarketStructureShift(normalizedCandles, allSwingPoints);

  return {
    orderBlocks,
    liquidityLevels,
    fvgs,
    supplyDemandZones,
    breakerBlocks,
    mss,
    summary: generateSummary(normalizedCandles, orderBlocks, liquidityLevels, fvgs, mss)
  };
};

// Helper functions
const calculateAverageRange = (candles) => {
  if (candles.length === 0) return 0;
  const ranges = candles.map(c => parseFloat(c.high) - parseFloat(c.low));
  return ranges.reduce((a, b) => a + b, 0) / ranges.length;
};

const calculateAverageBody = (candles) => {
  if (candles.length === 0) return 0;
  const bodies = candles.map(c => Math.abs(parseFloat(c.close) - parseFloat(c.open)));
  return bodies.reduce((a, b) => a + b, 0) / bodies.length;
};

const calculateBlockStrength = (currentCandle, nextCandle, type) => {
  const currentSize = parseFloat(currentCandle.high) - parseFloat(currentCandle.low);
  const nextSize = parseFloat(nextCandle.high) - parseFloat(nextCandle.low);

  if (type === 'bullish') {
    const closePos = parseFloat(currentCandle.close);
    const proximity = 1 - (closePos - parseFloat(currentCandle.low)) / currentSize;
    return Math.min(100, (proximity * 50) + (nextSize / currentSize * 50));
  } else {
    const closePos = parseFloat(currentCandle.close);
    const proximity = (closePos - parseFloat(currentCandle.low)) / currentSize;
    return Math.min(100, (proximity * 50) + (nextSize / currentSize * 50));
  }
};

const generateSummary = (candles, orderBlocks, liquidityLevels, fvgs, mss) => {
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  return {
    currentPrice,
    totalOrderBlocks: orderBlocks.length,
    bullishOrderBlocks: orderBlocks.filter(o => o.type === 'bullish').length,
    bearishOrderBlocks: orderBlocks.filter(o => o.type === 'bearish').length,
    totalLiquidityLevels: liquidityLevels.highs.length + liquidityLevels.lows.length,
    unreachedFVGs: fvgs.length,
    marketStructureShifts: mss.length,
    bias: determineBias(orderBlocks, liquidityLevels, mss, currentPrice)
  };
};

const determineBias = (orderBlocks, liquidityLevels, mss, currentPrice) => {
  let bullishScore = 0;
  let bearishScore = 0;

  // Score based on recent order blocks
  const recentBlocks = orderBlocks.slice(-5);
  bullishScore += recentBlocks.filter(o => o.type === 'bullish').length * 2;
  bearishScore += recentBlocks.filter(o => o.type === 'bearish').length * 2;

  // Score based on recent MSS
  const recentMss = mss.slice(-3);
  bullishScore += recentMss.filter(m => m.type === 'bullish').length * 3;
  bearishScore += recentMss.filter(m => m.type === 'bearish').length * 3;

  // Position relative to liquidity
  if (liquidityLevels.highs.length > 0) {
    const nearestHigh = liquidityLevels.highs[liquidityLevels.highs.length - 1].price;
    if (currentPrice > nearestHigh * 0.99) bullishScore += 1;
  }

  if (liquidityLevels.lows.length > 0) {
    const nearestLow = liquidityLevels.lows[liquidityLevels.lows.length - 1].price;
    if (currentPrice < nearestLow * 1.01) bearishScore += 1;
  }

  if (bullishScore > bearishScore) return 'BULLISH';
  if (bearishScore > bullishScore) return 'BEARISH';
  return 'NEUTRAL';
};
