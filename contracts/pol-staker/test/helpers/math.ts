/** Calculation functions as in Solidity. */
import * as constants from "../../constants/constants";
import { ethers } from "./connection";

export const parseEther = (n: number): bigint => ethers.parseEther(n.toString());

export const calculateSharePrice = (
  totalStaked: bigint,
  claimedRewards: bigint,
  totalRewards: bigint,
  totalShares: bigint,
  fee: bigint,
  feePrecision: bigint,
): [bigint, bigint] => {
  const totalAssetsTimesFeePrecision =
    (totalStaked + claimedRewards) * feePrecision + (feePrecision - fee) * totalRewards;

  const priceNum = totalAssetsTimesFeePrecision * parseEther(1);
  const priceDenom = totalShares * feePrecision;

  return [priceNum, priceDenom];
};

export const calculateSharesFromAmount = (amount: bigint, sharePrice: [bigint, bigint]): bigint =>
  (amount * parseEther(1) * sharePrice[1]) / sharePrice[0];

export const calculateAmountFromShares = (shares: bigint, sharePrice: [bigint, bigint]): bigint =>
  (shares * sharePrice[0]) / sharePrice[1] / parseEther(1);

export const calculateTrsyWithdrawFees = (totalRewards: bigint, sharePrice: [bigint, bigint]): bigint =>
  (totalRewards * constants.FEE * sharePrice[1] * parseEther(1)) / (sharePrice[0] * constants.FEE_PRECISION);

export const divSharePrice = (sharePrice: [bigint, bigint]): bigint => sharePrice[0] / sharePrice[1];

export const sharePriceEquality = (sharePrice0: [bigint, bigint], sharePrice1: [bigint, bigint]): boolean =>
  sharePrice0[0] * sharePrice1[1] === sharePrice1[0] * sharePrice0[1];

export const sharesToPOL = async (amount: bigint, staker) => {
  // Get vault share price
  const [globalSharePriceNumerator, globalSharePriceDenominator]: [bigint, bigint] = await staker.sharePrice();

  // Convert truPOL to POL at share price
  const POL = (amount * globalSharePriceNumerator) / globalSharePriceDenominator / parseEther(1);

  return POL;
};
