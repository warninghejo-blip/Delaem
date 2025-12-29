# Question for API Developers: Optimizing Requests for Fennec ID

## Problem

We are making **15-20 small requests** per audit, causing frequent **429 errors**. We need **fewer, larger requests** instead.

## Questions

### 1. Uniscan Summary API
- Can we get **detailed token lists and balances** in one request, or separate requests needed?
- What are **rate limits**? Can authentication increase them?
- How to generate `x-sign` and `x-ts` headers correctly?

### 2. InSwap All Balance API
- Can we get **LP positions** from `all_balance`, or need separate `my_pool_list`?
- Is there a `total_usd` field?
- What are **rate limits**? How to increase them?

### 3. UniSat API
- Is there **one endpoint** for BRC-20 + Runes + Ordinals together?
- What are **rate limits**? Can Wallet API with auth increase them?

### 4. First Transaction
- Is calculating `start = Math.floor(tx_count / 10) * 10` then fetching last page the **correct approach**?
- Is there a **dedicated endpoint** for first transaction?

## Ideal: 3 Requests Instead of 15-20

1. **One request** for all metadata (tx_count, runes, BRC-20, ordinals, first_tx)
2. **One request** for all tokens + balances + prices + total_usd
3. **One request** for all LP positions + values

**Thank you!**
