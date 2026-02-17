import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export const analyzeMarketDataWithClaude = async (marketData, ictResults) => {
  const prompt = `You are an expert ICT (Inner Circle Trader) swing trader. Analyze the following market data and provide trading recommendations.

**Market Data:**
- Symbol: ${marketData.symbol}
- Timeframe: ${marketData.timeframe}
- Current Price: ${marketData.currentPrice}

**ICT Analysis Results:**
${JSON.stringify({
  orderBlocks: ictResults.orderBlocks,
  liquidityLevels: ictResults.liquidityLevels,
  fairValueGaps: ictResults.fvgs,
  marketStructureShift: ictResults.mss
}, null, 2)}

**Analysis Required:**
1. Is there a valid swing trade setup based on ICT concepts?
2. What is the overall bias (bullish/bearish)?
3. What are the key entry, stop loss, and take profit levels?
4. What is the confluence of multiple ICT concepts?
5. What is the risk/reward ratio?
6. What is your confidence level (HIGH/MEDIUM/LOW)?
7. What specific ICT rules are being triggered?

Provide a detailed, actionable analysis with specific price levels.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
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
