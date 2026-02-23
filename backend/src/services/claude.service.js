import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[Claude Service] ❌ ANTHROPIC_API_KEY environment variable is not set');
  console.error('[Claude Service] Analysis will fail. Please set ANTHROPIC_API_KEY on Render.');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const getSessionContext = (timestamp) => {
  const hour = new Date(timestamp || Date.now()).getUTCHours();
  if (hour >= 0 && hour < 6)   return 'Asian Session (00:00-06:00 UTC) - Range-bound, accumulation phase';
  if (hour >= 7 && hour < 12)  return 'London Session (07:00-12:00 UTC) - High volatility, trend initiation';
  if (hour >= 13 && hour < 18) return 'New York Session (13:00-18:00 UTC) - High volume, trend continuation or reversal';
  return 'Session Overlap / Off-Hours';
};

export const analyzeMarketDataWithClaude = async (marketData, ictResults) => {
  const sessionContext = getSessionContext(marketData.timestamp || new Date());
  const bias = ictResults.summary?.bias || 'NEUTRAL';

  const prompt = `You are an expert ICT (Inner Circle Trader) swing trader. Analyze the following market data and provide a highly structured trading recommendation.

**Market Context:**
- Symbol: ${marketData.symbol}
- Timeframe: ${marketData.timeframe}
- Current Price: ${marketData.currentPrice}
- Session: ${sessionContext}
- ICT Algorithmic Bias: ${bias}

**ICT Analysis Data:**
${JSON.stringify({
  orderBlocks: ictResults.orderBlocks?.slice(-5),
  liquidityLevels: {
    recentHighs: ictResults.liquidityLevels?.highs?.slice(-3),
    recentLows: ictResults.liquidityLevels?.lows?.slice(-3)
  },
  fairValueGaps: ictResults.fvgs?.slice(-5),
  supplyDemandZones: ictResults.supplyDemandZones?.slice(-3),
  breakerBlocks: ictResults.breakerBlocks?.slice(-3),
  marketStructureShift: ictResults.mss?.slice(-3)
}, null, 2)}

**Required Analysis:**
1. **Market Bias with Score**: Rate conviction 1-10. Explain why bullish or bearish based on MSS and OB context.
2. **Premium/Discount Analysis**: Is price currently in premium (above equilibrium) or discount (below)? Reference the recent swing range.
3. **Point of Interest (POI)**: Identify the highest-confluence POI for entry - must be an OB, FVG, or SD zone confluence.
4. **Killzone Entry**: Given the current session, is there a valid killzone entry setup?
5. **Entry, Stop Loss, Take Profit**: Specific price levels with ICT justification.
6. **Confluence Count**: How many ICT concepts align at the POI?
7. **Confidence**: HIGH/MEDIUM/LOW with reason.
8. **ICT Rules Triggered**: List specific concepts (OB, FVG, LQ sweep, MSS, SD zone, breaker).

Provide your narrative analysis first, then end with a JSON block:

---JSON---
{
  "bias": "BULLISH" or "BEARISH" or "NEUTRAL",
  "biasScore": 1-10,
  "priceContext": "premium" or "discount" or "equilibrium",
  "poi": { "type": "OB|FVG|SDZ|Breaker", "high": number, "low": number },
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "riskReward": number,
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confluenceCount": number,
  "signal": "BUY" or "SELL" or null,
  "reason": "concise ICT reason"
}
---JSON---`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3500,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Claude API Error:', error);
    throw new Error(`Claude analysis failed: ${error.message}`);
  }
};

export const extractSignalFromAnalysis = async (claudeAnalysis) => {
  // Fast path: try to parse the embedded ---JSON--- block first
  const jsonBlockMatch = claudeAnalysis.match(/---JSON---\s*([\s\S]*?)\s*---JSON---/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      // Ensure it has the shape the rest of the code expects
      if (parsed.signal !== undefined) return parsed;
    } catch (_) {
      // Fall through to slow path
    }
  }

  // Slow path: ask Claude again (existing behavior)
  const extractionPrompt = `Based on this market analysis, extract a JSON object with the following structure. Return ONLY valid JSON:

{
  "signal": "BUY" or "SELL",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reason": "brief reason for the signal"
}

If no clear signal is present, return:
{
  "signal": null,
  "reason": "reason why no signal"
}

Analysis:
${claudeAnalysis}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: extractionPrompt
        }
      ]
    });

    const responseText = message.content[0].text;
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Signal extraction error:', error);
    return { signal: null, reason: 'Failed to extract signal' };
  }
};
