import { runStrategyBacktest } from '../src/services/strategyBacktest.service.js';

/**
 * Run professional ICT strategy backtest
 */
async function main() {
  try {
    console.log('\n🚀 Running Professional ICT Strategy Backtest\n');
    console.log('='.repeat(80));

    const symbol = 'BTCUSDT';
    const startDate = '2020-01-01';
    const endDate = '2024-12-31';
    const initialCapital = 10000;

    console.log(`\nConfiguration:`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Period: ${startDate} to ${endDate}`);
    console.log(`  Initial Capital: $${initialCapital}`);
    console.log(`\nRunning backtest...\n`);

    const results = await runStrategyBacktest(symbol, '5M', startDate, endDate, { initialCapital });

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 BACKTEST RESULTS\n');

    // Summary
    console.log('📈 SUMMARY STATISTICS:');
    console.log(`  Initial Capital:    $${results.summary.initialCapital.toFixed(2)}`);
    console.log(`  Final Balance:      $${results.summary.finalBalance.toFixed(2)}`);
    console.log(`  Total Profit/Loss:  $${results.summary.totalProfit.toFixed(2)}`);
    console.log(`  Total Return:       ${results.summary.totalReturn.toFixed(2)}%`);
    console.log(`  Max Drawdown:       ${results.summary.maxDrawdown}%`);
    console.log(`  Win Rate:           ${results.summary.winRate.toFixed(2)}%`);

    // Trades breakdown
    console.log(`\n📊 TRADES BREAKDOWN:`);
    console.log(`  Total Trades:       ${results.trades.total}`);
    console.log(`  Winning Trades:     ${results.trades.winning}`);
    console.log(`  Losing Trades:      ${results.trades.losing}`);
    console.log(`  Avg Win:            $${results.trades.avgWin.toFixed(2)}`);
    console.log(`  Avg Loss:           $${results.trades.avgLoss.toFixed(2)}`);

    // Quality breakdown
    console.log(`\n⭐ SIGNAL QUALITY BREAKDOWN:`);
    console.log(`  A+ Trades:          ${results.qualityBreakdown.aPlus}`);
    console.log(`  A  Trades:          ${results.qualityBreakdown.a}`);
    console.log(`  B  Trades:          ${results.qualityBreakdown.b}`);

    // Rule compliance
    console.log(`\n✅ RULE COMPLIANCE:`);
    console.log(`  Signals Generated:  ${results.ruleCompliance.totalSignalsGenerated}`);
    console.log(`  Rule Violations:    ${results.ruleCompliance.ruleViolations}`);
    console.log(`  Compliance Rate:    ${results.ruleCompliance.complianceRate.toFixed(2)}%`);

    // Sample trades
    if (results.trades && results.trades.length > 0) {
      console.log(`\n📋 RECENT TRADES (Last 5):`);
      const recent = results.trades.slice(-5);
      recent.forEach((trade, idx) => {
        console.log(`\n  Trade ${idx + 1}:`);
        console.log(`    Side:           ${trade.side}`);
        console.log(`    Quality:        ${trade.quality}`);
        console.log(`    Entry Price:    $${trade.entryPrice.toFixed(8)}`);
        console.log(`    Exit Price:     $${trade.exitPrice?.toFixed(8) || 'N/A'}`);
        console.log(`    Profit/Loss:    $${trade.profit?.toFixed(2) || 'N/A'}`);
        console.log(`    Exit Reason:    ${trade.exitReason || 'N/A'}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Backtest complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
