# Question for API Developers: Optimizing API Usage for Fennec ID Audit

## Context

We are building a **Fennec ID audit system** that aggregates wallet data from multiple sources (UniSat, InSwap, Uniscan) to calculate a user's "Fennec Identity" score. The system needs to fetch:

- Transaction history and first transaction timestamp
- Native balance (FB/BTC)
- BRC-20 token counts and balances
- Runes counts and balances
- Ordinals counts
- LP (Liquidity Pool) positions and values
- Token prices in USD
- Staking balances

## Current Challenge: 429 Rate Limiting

We are experiencing frequent **429 (Too Many Requests)** errors, especially when multiple users access the site simultaneously. This is a critical issue that will worsen as user traffic increases.

## Optimization Opportunities

We have identified several API endpoints that appear to return comprehensive data in a single request, which could significantly reduce the number of API calls:

### 1. Uniscan Address Summary API

**Endpoint:** `https://uniscan.cc/fractal-api/explorer-v1/address/summary?address={address}`

**Question:**
- Is this endpoint the **recommended way** to get aggregated address data (tx_count, utxo_count, native_balance, runes_count, brc20_count, ordinals_count) in a single request?
- What are the **rate limits** for this endpoint?
- Does it support **user authentication/signatures** to increase rate limits?
- Are there any **required headers** (x-appid, x-front-version, x-signature, x-address) that we should include?
- What is the **recommended caching strategy** for this endpoint?
- Does this endpoint return **complete and accurate counts** compared to individual API calls?

### 2. InSwap All Balance API

**Endpoint:** `https://inswap.cc/fractal-api/swap-v1/all_balance?address={address}&pubkey={pubkey}`

**Question:**
- Is this endpoint the **recommended way** to get all token balances (sFB, sBTC, FENNEC, wangcai, etc.) and their USD prices in a single request?
- What are the **rate limits** for this endpoint?
- Is the `pubkey` parameter **required** or optional? What is its purpose?
- Does it support **user signatures** (x-signature header) to authenticate requests and potentially increase rate limits?
- Does this endpoint return a `total_usd` field with the overall balance in USD?
- Can we get **LP (Liquidity Pool) positions and values** from this endpoint, or do we still need `my_pool_list`?
- What is the **recommended caching strategy** for this endpoint?

### 3. UniSat Wallet API vs Open API

**Endpoints:**
- `https://wallet-api-fractal.unisat.io` (Wallet API - requires authentication)
- `https://open-api-fractal.unisat.io/v1` (Open API - public)

**Question:**
- What is the **difference** between these two APIs in terms of:
  - Rate limits
  - Data completeness/accuracy
  - Authentication requirements
  - Recommended use cases
- If we have a **user signature** from the wallet connection, can we use the Wallet API to get higher rate limits?
- What **authentication headers** are required for the Wallet API (x-signature, x-address, x-public-key)?
- Is there a **comprehensive endpoint** in either API that returns multiple data types (BRC-20, Runes, Ordinals) in a single request?

### 4. Transaction History and First Transaction

**Uniscan Endpoint:** `https://uniscan.cc/fractal-api/explorer-v1/transaction/batch/spent_txid?height=&address={address}&start={start}&limit=10`

**Question:**
- For finding the **first transaction (genesis)**, is it correct to:
  1. Get `tx_count` from the summary endpoint
  2. Calculate `start = Math.floor(tx_count / 10) * 10` (round down to nearest 10)
  3. Request the last page with `start={start}&limit=10`
  4. Find the oldest transaction among the returned results?
- Is there a **more efficient endpoint** specifically for getting the first transaction timestamp?
- What are the **rate limits** for this endpoint?

## General Questions

1. **Rate Limiting Strategy:**
   - What are the **official rate limits** for each endpoint?
   - Do rate limits increase with **user authentication/signatures**?
   - What is the **recommended throttling delay** between requests?
   - Is there a **rate limit per IP** vs **per authenticated user**?

2. **Authentication:**
   - How should we **implement user signatures** to authenticate API requests?
   - What **message format** should be signed?
   - Should signatures be included in **headers** (x-signature, x-address) or **query parameters**?
   - Do authenticated requests have **higher rate limits** or **priority**?

3. **Caching:**
   - What is the **recommended cache TTL** for different types of data?
   - Which data is **immutable** (can be cached for hours/days)?
   - Which data is **frequently updated** (should be cached for seconds/minutes)?

4. **Best Practices:**
   - What is the **recommended order** of API calls to minimize rate limiting?
   - Should we use **parallel requests** or **sequential requests** with delays?
   - Are there any **batch endpoints** that can replace multiple individual requests?

5. **Error Handling:**
   - What is the **recommended retry strategy** for 429 errors?
   - Should we use **exponential backoff**? What are the recommended delays?
   - How should we handle **partial failures** (some endpoints succeed, others fail)?

## Our Current Implementation

We are currently:
- Using **sequential API calls** with 2-4 second delays between requests
- Implementing **exponential backoff** (5s → 10s → 20s → 30s)** for 429 errors
- Caching responses for **60 seconds** (balances) and **5 minutes** (prices)
- Using **Uniscan Summary API** as the primary source for aggregated counts
- Using **InSwap all_balance** to get all token balances and prices
- Passing **user signatures** in headers (x-signature, x-address) when available

## Contact Information

If you have any questions or need more context about our use case, please feel free to reach out.

**Thank you for your time and assistance!**

