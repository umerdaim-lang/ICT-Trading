import { useState } from 'react';

export default function AnalysisLog({ analysis }) {
  const [expandedSection, setExpandedSection] = useState('summary');

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No analysis data available</p>
      </div>
    );
  }

  const Section = ({ title, id, children }) => (
    <div className="mb-4 border-l-2 border-slate-600 pl-4">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="flex items-center gap-2 text-white font-semibold mb-2 hover:text-blue-400 transition-colors"
      >
        <span className={`transition-transform ${expandedSection === id ? 'rotate-90' : ''}`}>
          ▶
        </span>
        {title}
      </button>
      {expandedSection === id && (
        <div className="text-gray-300 text-sm space-y-2 ml-6">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      {analysis.summary && (
        <Section title="Summary" id="summary">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500">Current Price</p>
              <p className="text-white font-mono">
                {parseFloat(analysis.summary.currentPrice).toFixed(5)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Bias</p>
              <p className={`font-bold ${
                analysis.summary.bias === 'BULLISH' ? 'text-green-400' :
                analysis.summary.bias === 'BEARISH' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {analysis.summary.bias}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Order Blocks</p>
              <p className="text-white">{analysis.summary.totalOrderBlocks}</p>
            </div>
            <div>
              <p className="text-gray-500">Liquidity Levels</p>
              <p className="text-white">{analysis.summary.totalLiquidityLevels}</p>
            </div>
          </div>
        </Section>
      )}

      {/* Order Blocks */}
      {analysis.orderBlocks && analysis.orderBlocks.length > 0 && (
        <Section title={`Order Blocks (${analysis.orderBlocks.length})`} id="orderblocks">
          <div className="space-y-2">
            {analysis.orderBlocks.slice(-5).map((block, idx) => (
              <div key={idx} className="bg-slate-900/50 p-2 rounded">
                <p className="font-semibold">
                  <span className={`px-2 py-1 rounded text-xs mr-2 ${
                    block.type === 'bullish' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                  }`}>
                    {block.type.toUpperCase()}
                  </span>
                </p>
                <p className="text-xs">High: {parseFloat(block.high).toFixed(5)}</p>
                <p className="text-xs">Low: {parseFloat(block.low).toFixed(5)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Fair Value Gaps */}
      {analysis.fairValueGaps && analysis.fairValueGaps.length > 0 && (
        <Section title={`Fair Value Gaps (${analysis.fairValueGaps.length})`} id="fvgs">
          <div className="space-y-2">
            {analysis.fairValueGaps.slice(-3).map((fvg, idx) => (
              <div key={idx} className="bg-slate-900/50 p-2 rounded">
                <p className="font-semibold">
                  <span className={`px-2 py-1 rounded text-xs mr-2 ${
                    fvg.type === 'bullish' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                  }`}>
                    {fvg.type.toUpperCase()}
                  </span>
                </p>
                <p className="text-xs">Top: {parseFloat(fvg.top).toFixed(5)}</p>
                <p className="text-xs">Bottom: {parseFloat(fvg.bottom).toFixed(5)}</p>
                <p className="text-xs text-gray-500">Size: {fvg.size.toFixed(5)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Claude Analysis */}
      {analysis.claudeAnalysis && (
        <Section title="Claude AI Analysis" id="claude">
          <div className="bg-slate-900/50 p-3 rounded whitespace-pre-wrap text-xs leading-relaxed">
            {analysis.claudeAnalysis}
          </div>
        </Section>
      )}
    </div>
  );
}
