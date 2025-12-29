# Failing API Requests - Investigation Needed

Based on the debug output from the latest audit, here are the API requests that are failing or need investigation:

## 1. Uniscan Summary API
- **Status**: Skipped (x-sign not provided)
- **URL**: `https://uniscan.cc/fractal-api/explorer-v1/address/summary?address={address}`
- **Issue**: `x-sign` generation is being skipped to avoid 403 errors
- **Debug Info**: `uniscan_summary_skipped: "x-sign not provided, skipping to avoid 403 error"`
- **Impact**: Missing data for tx_count, runes_count, brc20_count, ordinals_count from Uniscan
- **Action Needed**:
  - Investigate if `x-sign` is actually required for this endpoint
  - Check if there's an alternative endpoint that doesn't require `x-sign`
  - Verify if the endpoint works without `x-sign` (might be a false positive)

## 2. InSwap all_balance API
- **Status**: Using old URL (fallback)
- **Current URL**: `https://inswap.cc/fractal-api/swap-v1/all_balance?address={address}&pubkey={pubkey}`
- **New URL (should use)**: `https://inswap.cc/fractal-api/v1/brc20-swap/all_balance?address={address}`
- **Debug Info**: `all_balance_using_old_url: true`
- **Impact**: May be using deprecated endpoint
- **Action Needed**:
  - Verify if the new URL works without `pubkey` parameter
  - Check if `x-sign` is required for the new URL
  - Update code to use new URL if it works

## 3. Genesis Transaction Fetch
- **Status**: Error in debug (but might still work)
- **Error**: `genesis_error: "start is not defined"`
- **Issue**: This error message suggests a variable `start` is being referenced but doesn't exist
- **Impact**: May affect wallet age calculation
- **Action Needed**:
  - Check if the error is actually preventing the genesis transaction from being fetched
  - The code uses `cursor` and `size` parameters, not `start`, so this might be a false error
  - Verify that `first_tx_ts` is being calculated correctly despite this error

## 4. BRC-20 Count Discrepancy
- **Status**: Showing 26 instead of 27
- **Debug Info**:
  - `brc20_wallet_count: 23`
  - `brc20_inswap_count: 4`
  - `brc20_count_total: 26`
- **Expected**: 27 unique tokens
- **Issue**: One token is missing from the count
- **Possible Causes**:
  - Token exists in both wallet and InSwap but normalization is removing it
  - Token has balance 0 in wallet but balance > 0 in InSwap, and it's not being counted
  - Token name normalization is causing a duplicate to be removed incorrectly
- **Action Needed**:
  - Check the `brc20_final_list` in debug output to see which tokens are being counted
  - Compare with the actual list of tokens the user expects
  - Verify that tokens with balance 0 in wallet but balance > 0 in InSwap are being counted

## 5. Fennec Native Balance
- **Status**: Fixed (now sums wallet + InSwap)
- **Previous Issue**: Only counted wallet balance, not InSwap balance
- **Fix Applied**: Now sums `fennecWalletBalance + fennecInSwapBalance`
- **Debug Info**:
  - `fennec_wallet_balance`: Balance from wallet (brc20 summary)
  - `fennec_inswap_balance`: Balance from InSwap (all_balance)
  - `fennec_native_balance`: Sum of both

## Recommendations

1. **Test Uniscan Summary API without x-sign**: Try making a request without `x-sign` header to see if it works
2. **Update InSwap URL**: Test the new URL format and update if it works
3. **Verify Genesis Transaction**: Check if `first_tx_ts` is correct despite the error message
4. **Debug BRC-20 Count**: Add more detailed logging to see which token is missing
5. **Check API Documentation**: Verify the correct endpoints and required headers in Swagger/GitHub documentation

