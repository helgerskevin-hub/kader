# Using Claude with eToro for Crypto Copy Trading

## The Reality: No Direct Automation

You **cannot** directly connect Claude to eToro to automate copy trading.

While eToro is famous for its native **CopyTrader** feature (which lets you automatically mirror human traders) and has a developer API, they do **not** offer a plug-and-play integration for Claude or any other external AI to execute automated trades. Furthermore, Claude cannot browse the live web or log into your private broker accounts to click buttons for you.

However, you **can** use Claude as your personal **Trading Quant and Strategy Analyst**. You can feed Claude market data, ask it to evaluate eToro traders, or have it write the code for a custom trading bot.

This document outlines how to practically use Claude to supercharge your eToro crypto trading strategy.

---

## The Strategy: How to Use Claude with eToro

Since you can't build a direct "Claude-to-eToro" pipe without heavy programming, the most effective way to combine them is to use Claude to **vet and audit the "Popular Investors"** you want to copy on eToro.

Instead of guessing who to follow, you use Claude to analyze their historical performance, risk metrics, and asset allocations to build a "Smart Portfolio" of traders.

---

## Step-by-Step Guide: Evaluating eToro Traders with Claude

### Step 1: Find Potential Traders on eToro

Log into your eToro account and head to the **Discover** tab, then select **CopyTrader**. Filter for investors who focus primarily on **Crypto**. Look for candidates with a solid track record (at least 1–2 years) and a risk score that fits your comfort level.

### Step 2: Extract the Data for Claude

eToro doesn't make it easy to export a trader's data into a neat Excel sheet, so you'll need to gather it manually:

- Go to the trader's profile and click on **Stats**.
- Highlight and copy their monthly returns table, their maximum drawdown (how much they've lost at their lowest point), and their average holding time.
- Go to their **Portfolio** tab and note down their current top crypto allocations (e.g., 40% Bitcoin, 30% Ethereum, 10% Solana).

### Step 3: Prompt Claude for a Risk & Performance Audit

Paste that data into Claude. To get a truly professional analysis, use a structured prompt that forces Claude to look past the "green percentages."

**Copy and paste this prompt template into Claude:**

> "Act as a professional crypto hedge fund risk manager. I am considering copy trading this eToro investor with $1,000. Analyze their performance data and portfolio mix below. Identify their hidden risks, evaluate if their returns justify their drawdowns, and tell me if their crypto portfolio is well-diversified or overly exposed to high-risk altcoins. Here is their data: `[Paste the stats and portfolio data here]`"

### Step 4: Review Claude's Verdict

Claude will break down the data and highlight things human eyes easily miss, such as:

- **Consistency vs. Luck:** Did the trader make all their money on one lucky meme-coin spike, or do they have steady month-over-month gains?
- **Risk-Adjusted Return:** Are they risking a 50% loss just to make a 10% profit?
- **Over-allocation:** Are they holding too many highly correlated assets that will all crash at the exact same time?

### Step 5: Execute the Copy Trade on eToro

If Claude gives the trader a green light and you are comfortable with the parameters:

1. Go back to that trader's profile on eToro.
2. Click the blue **Copy** button.
3. Set your investment amount (minimum is typically $200 per trader).
4. Set your **Copy Stop Loss (CSL)** — this acts as an automatic circuit breaker to protect your funds if the trader has a bad week.
5. Click **Invest**.

---

> ⚠️ **A Note on Automated Bots:** If you see tutorials online claiming Claude can fully automate live crypto trades via eToro's API, they are referring to custom-built Python applications using Claude's Developer API keys. This requires intermediate-to-advanced coding knowledge to handle API authentication, order execution, and error handling so a bug doesn't accidentally drain your account. For 95% of users, using Claude as an analytical assistant is much safer and highly effective.

---

## Helpful Claude Skills

Claude **Skills** are reusable folders of instructions Claude loads on demand to do specialized tasks better. The ones below are the most useful for the trader-vetting workflow above. A plain-text copy of these links also lives in `claude-skills-links.txt` in this folder.

- **[tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills)** — *Most relevant.* Claude Code skills for equity investors/traders: market regime & breadth analysis, technical charting, screeners (VCP, CANSLIM, momentum), position sizing, risk management, and trade journaling. Designed to *structure* analysis, not auto-trade. Some screeners need a free Financial Modeling Prep API key.
- **[anthropics/financial-services](https://github.com/anthropics/financial-services)** — Anthropic's official finance reference architectures (skills + connectors + subagents) for tasks like DCF models, investment-committee memos, and morning research notes. Useful for adapting the audit prompt into a repeatable workflow.
- **[anthropics/skills](https://github.com/anthropics/skills)** — Anthropic's official Skills repository, including the `docx`, `pdf`, `pptx`, and `xlsx` skills — handy for turning Claude's trader audit into a clean spreadsheet or PDF report.
- **[travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)** — Curated community list of Claude Skills and tools for discovering more (finance, data, productivity).
- **[ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)** — Another curated directory of Claude Skills worth browsing.

### How to use a skill
- **Claude web/desktop app:** download the skill's `.skill` package and upload it via **Settings → Skills**.
- **Claude Code (CLI/desktop):** copy the skill folder into your Skills directory (**Settings → Skills → Open Skills Folder**), then restart.
