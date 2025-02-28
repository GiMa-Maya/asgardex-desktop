import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX, AVAX_GAS_ASSET_DECIMAL, AVAXChain } from '@xchainjs/xchain-avax'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC, BSC_GAS_ASSET_DECIMAL, BSCChain } from '@xchainjs/xchain-bsc'
import { COSMOS_DECIMAL } from '@xchainjs/xchain-cosmos'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGE_DECIMAL } from '@xchainjs/xchain-doge'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTC_DECIMAL } from '@xchainjs/xchain-litecoin'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  assetFromString,
  bnOrZero,
  baseAmount,
  Asset,
  assetToString,
  isValidBN,
  bn,
  BaseAmount,
  Address
} from '@xchainjs/xchain-util'
import { Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import * as P from 'fp-ts/lib/Predicate'

import { AssetATOM, AssetBCH, AssetBTC, AssetDOGE, AssetETH, AssetLTC } from '../../../shared/utils/asset'
import { isEnabledChain } from '../../../shared/utils/chain'
import { optionFromNullableString } from '../../../shared/utils/fp'
import { convertBaseAmountDecimal, isUSDAsset, THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { eqAsset, eqChain, eqOAddress } from '../../helpers/fp/eq'
import { ordPricePool } from '../../helpers/fp/ord'
import { getDeepestPool, RUNE_POOL_ADDRESS, RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { AssetWithAmount } from '../../types/asgardex'
import { PricePoolAssets, PricePools, PricePoolAsset, PricePool, PoolData } from '../../views/pools/Pools.types'
import { InboundAddress } from '../thorchain/types'
import {
  PoolAssetDetails as PoolAssetsDetail,
  PoolDetails,
  PoolsStateRD,
  SelectedPricePoolAsset,
  PoolAssetDetail,
  PoolShares,
  PoolShare,
  PoolAddress,
  PoolAddresses,
  PoolsDataMap,
  GetPoolsPeriodEnum,
  GetPoolPeriodEnum
} from './types'

export const getPricePools = (details: PoolDetails, whitelist: PricePoolAssets): PricePools => {
  const oUSDPricePool: O.Option<PricePool> = FP.pipe(
    whitelist,
    A.filter(isUSDAsset),
    (usdAssets) =>
      details.filter((detail) =>
        usdAssets.find((asset) => detail.asset.toLowerCase() === assetToString(asset).toLowerCase())
      ),
    getDeepestPool,
    O.chain((detail) =>
      FP.pipe(
        assetFromString(detail.asset),
        O.fromNullable,
        O.map((asset) => ({
          asset,
          poolData: toPoolData(detail)
        }))
      )
    )
  )

  const pricePoolAssets: PricePoolAssets = FP.pipe(whitelist, A.filter(P.not(isUSDAsset)))

  return FP.pipe(
    details,
    // filter details for using assets in whitelist only
    A.filterMap((detail) => {
      const asset = pricePoolAssets.find((asset) => detail.asset === assetToString(asset))
      return asset ? O.some(detail) : O.none
    }),
    // Map `PoolDetail` -> `PricePool`
    A.filterMap(
      (detail: PoolDetail): O.Option<PricePool> =>
        FP.pipe(
          assetFromString(detail.asset),
          O.fromNullable,
          O.map((asset) => ({
            asset,
            poolData: toPoolData(detail)
          }))
        )
    ),
    // Add USD price pool (if available)
    (pricePools) =>
      FP.pipe(
        oUSDPricePool,
        O.map((usdPricePool) => [...pricePools, usdPricePool]),
        O.getOrElse(() => pricePools)
      ),
    // Add RUNE price pool
    A.append(RUNE_PRICE_POOL),
    // sort by weights
    NEA.sort(ordPricePool),
    // reverse to start with hihger weight
    NEA.reverse
  )
}

/**
 * Selector to get a `PricePool` from a list of `PricePools` by a given `PricePoolAsset`
 *
 * It will always return a `PricePool`:
 * - (1) `PricePool` from list of pools (if available)
 * - (2) OR BUSDB (if available in list of pools)
 * - (3) OR RUNE (if no other pool is available)
 */
export const pricePoolSelector = (pools: PricePools, oAsset: O.Option<PricePoolAsset>): PricePool =>
  FP.pipe(
    oAsset,
    // (1) Check if `PricePool` is available in `PricePools`
    O.chainNullableK((asset) => pools.find((pool) => eqAsset.equals(pool.asset, asset))),
    // (2) If (1) fails, check if USD pool is available in `PricePools`
    O.fold(() => O.fromNullable(pools.find((pool) => isUSDAsset(pool.asset))), O.some),
    // (3) If (2) failes, return RUNE pool, which is always first entry in pools list
    O.getOrElse(() => NEA.head(pools))
  )

/**
 * Similar to `pricePoolSelector`, but taking `PoolsStateRD` instead of `PoolsState`
 */
export const pricePoolSelectorFromRD = (
  poolsRD: PoolsStateRD,
  selectedPricePoolAsset: SelectedPricePoolAsset
): PricePool =>
  FP.pipe(
    RD.toOption(poolsRD),
    O.chain((pools) => pools.pricePools),
    O.map((pricePools) => pricePoolSelector(pricePools, selectedPricePoolAsset)),
    O.getOrElse(() => RUNE_PRICE_POOL)
  )

/**
 * Gets a `PoolDetail by given Asset
 * It returns `None` if no `PoolDetail` has been found
 * Adjusted to handle synth assets
 */
export const getPoolDetail = (details: PoolDetails, asset: Asset): O.Option<PoolDetail> =>
  FP.pipe(
    details.find((detail: PoolDetail) =>
      FP.pipe(
        detail.asset,
        assetFromString,
        O.fromNullable,
        O.map((detailAsset) => {
          const res =
            detailAsset.chain.toUpperCase() === asset.chain.toUpperCase() &&
            detailAsset.symbol.toUpperCase() === asset.symbol.toUpperCase() &&
            detailAsset.ticker.toUpperCase() === asset.ticker.toUpperCase()
          return res
        }),
        O.getOrElse(() => false)
      )
    ),
    O.fromNullable
  )

/**
 * Converts `PoolDetails` to `PoolsDataMap`
 * Keys of the end HasMap is PoolDetails[i].asset
 */
export const toPoolsData = (poolDetails: Array<Pick<PoolDetail, 'asset' | 'assetDepth' | 'runeDepth'>>): PoolsDataMap =>
  poolDetails.reduce<PoolsDataMap>((acc, cur) => ({ ...acc, [cur.asset]: toPoolData(cur) }), {})

/**
 * Converts a `BaseAmount` string into `PoolData` balance (always `1e8` decimal based)
 */
export const toPoolBalance = (baseAmountString: string): BaseAmount => baseAmount(baseAmountString, THORCHAIN_DECIMAL)

/**
 * Transforms `PoolDetail` into `PoolData` (provided by `asgardex-util`)
 *
 * Note: Balances of `PoolData` are always `1e8` based
 */
export const toPoolData = ({ assetDepth, runeDepth }: Pick<PoolDetail, 'assetDepth' | 'runeDepth'>): PoolData => ({
  assetBalance: toPoolBalance(assetDepth),
  dexBalance: toPoolBalance(runeDepth)
})

/**
 * Filter out mini tokens from pool assets
 */
export const filterPoolAssets = (poolAssets: string[]) => {
  return poolAssets.filter((poolAsset) => assetFromString(poolAsset) || { symbol: '' })
}

export const getPoolAddressesByChain = (addresses: PoolAddresses, chain: Chain): O.Option<PoolAddress> =>
  FP.pipe(
    addresses,
    A.findFirst((address) => eqChain.equals(address.chain, chain))
  )

/**
 * Helper to get outbound fees by given `outbound_fee` and `chain`
 *
 * Note: It includes fees for asset side only (not for RUNE side).
 */
export const getOutboundAssetFeeByChain = (
  addresses: Pick<InboundAddress, 'chain' | 'outbound_fee'>[],
  chain: Chain
): O.Option<AssetWithAmount> =>
  FP.pipe(
    addresses,
    A.findFirst((address) => eqChain.equals(address.chain, chain)),
    // extract outbound fee
    O.map(({ outbound_fee }) => outbound_fee),
    // Ignore undefined values
    O.chain(O.fromNullable),
    O.map(bn),
    // Valid BigNumbers only
    O.chain(O.fromPredicate(isValidBN)),
    // Convert fee values to `BaseAmount` to put into `AssetWithAmount`
    O.chain((value) => {
      if (!isEnabledChain(chain)) return O.none

      switch (chain) {
        case BTCChain:
          return O.some({
            amount: baseAmount(value, BTC_DECIMAL),
            asset: AssetBTC
          })
        case BCHChain:
          return O.some({
            amount: baseAmount(value, BCH_DECIMAL),
            asset: AssetBCH
          })
        case LTCChain:
          return O.some({
            amount: baseAmount(value, LTC_DECIMAL),
            asset: AssetLTC
          })
        case DOGEChain:
          return O.some({
            amount: baseAmount(value, DOGE_DECIMAL),
            asset: AssetDOGE
          })
        case ETHChain: {
          return O.some({
            // Convertion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), ETH_GAS_ASSET_DECIMAL),
            asset: AssetETH
          })
        }
        case AVAXChain: {
          return O.some({
            // Convertion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), AVAX_GAS_ASSET_DECIMAL),
            asset: AssetAVAX
          })
        }
        case BSCChain: {
          return O.some({
            // Convertion of decimal needed: 1e8 (by default in THORChain) -> 1e18 (ETH)
            amount: convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), BSC_GAS_ASSET_DECIMAL),
            asset: AssetBSC
          })
        }
        case GAIAChain: {
          // Convertion of decimal needed: 1e8 (by default in THORChain) -> 1e6 (COSMOS)
          const amount = convertBaseAmountDecimal(baseAmount(value, THORCHAIN_DECIMAL), COSMOS_DECIMAL)
          return O.some({
            amount,
            asset: AssetATOM
          })
        }
        // 'THORChain can be ignored - fees for asset side only
        // Other chains can be ignored since they are for mayachain
        case THORChain:
        case DASHChain:
        case MAYAChain:
        case KUJIChain:
        case ARBChain:
          return O.none
      }
    })
  )

export const inboundToPoolAddresses = (
  addresses: Pick<InboundAddress, 'chain' | 'address' | 'router' | 'halted'>[]
): PoolAddresses =>
  FP.pipe(
    addresses,
    A.map(({ address, router, chain, halted }) => ({
      chain,
      address,
      router: optionFromNullableString(router),
      halted
    })),
    // Add "empty" rune "pool address" - we never had such pool, but do need it to calculate tx
    A.prepend(RUNE_POOL_ADDRESS)
  )

/**
 * Combines 'asym` + `sym` `Poolshare`'s of an `Asset` into a single `Poolshare` for this `Asset`
 *
 * @returns `PoolShares` List of combined `PoolShare` items for each `Asset`
 */
export const combineShares = (shares: PoolShares): PoolShares =>
  FP.pipe(
    shares,
    A.reduce<PoolShare, PoolShares>([], (acc, cur) =>
      FP.pipe(
        acc,
        A.findFirst(({ asset }) => eqAsset.equals(asset, cur.asset)),
        O.fold(
          () => [...acc, { ...cur, type: 'all' }],
          (value) => {
            value.units = cur.units.plus(value.units)
            value.assetAddedAmount = baseAmount(cur.assetAddedAmount.amount().plus(value.assetAddedAmount.amount()))
            value.type = 'all'
            return acc
          }
        )
      )
    )
  )

/**
 * Combines 'asym` + `sym` `Poolshare`'s into a single `Poolshare` by given `Asset` only
 *
 * @returns `O.Option<PoolShare>`  If `Poolshare`'s for given `Asset` exists, it combinens its `PoolShare`. If not, it returns `O.none`
 */
export const combineSharesByAsset = (shares: PoolShares, asset: Asset): O.Option<PoolShare> =>
  FP.pipe(
    shares,
    // filter shares for given asset
    A.filter(({ asset: poolAsset }) => eqAsset.equals(asset, poolAsset)),
    // merge shares
    A.reduce<PoolShare, O.Option<PoolShare>>(O.none, (oAcc, cur) => {
      return FP.pipe(
        oAcc,
        O.map(
          (acc): PoolShare => ({
            ...acc,
            units: cur.units.plus(acc.units),
            assetAddedAmount: baseAmount(cur.assetAddedAmount.amount().plus(acc.assetAddedAmount.amount())),
            assetAddress: acc.assetAddress,
            runeAddress: O.isSome(acc.runeAddress) ? acc.runeAddress : cur.runeAddress,
            type: 'all'
          })
        ),
        O.getOrElse<PoolShare>(() => ({ ...cur, type: 'all' })),
        O.some
      )
    })
  )

/**
 * Filters 'asym` or `sym` `Poolshare`'s by given `Asset`
 */
export const getSharesByAssetAndType = ({
  shares,
  asset,
  type
}: {
  shares: PoolShares
  asset: Asset
  type: 'sym' | 'asym'
}): O.Option<PoolShare> =>
  FP.pipe(
    shares,
    A.filter(({ asset: sharesAsset, type: sharesType }) => eqAsset.equals(asset, sharesAsset) && type === sharesType),
    A.head
  )

/**
 * Filters `sym` `Poolshare`'s by given asset `Address`
 */
export const getSymSharesByAddress = (shares: PoolShares, assetAddress: Address): PoolShares =>
  FP.pipe(
    shares,
    A.filter(
      ({ type, assetAddress: oAssetAddress }) =>
        eqOAddress.equals(oAssetAddress, O.some(assetAddress)) && type === 'sym'
    )
  )

export const getPoolAssetDetail = ({
  asset: assetString,
  assetPrice
}: Pick<PoolDetail, 'assetPrice' | 'asset'>): O.Option<PoolAssetDetail> =>
  FP.pipe(
    assetString,
    assetFromString,
    O.fromNullable,
    O.map((asset) => ({
      asset,
      assetPrice: bnOrZero(assetPrice)
    }))
  )

export const getPoolAssetsDetail: (_: Array<Pick<PoolDetail, 'assetPrice' | 'asset'>>) => PoolAssetsDetail = (
  poolDetails
) => FP.pipe(poolDetails, A.filterMap(getPoolAssetDetail))

export const poolsPeriodToPoolPeriod = (period: GetPoolsPeriodEnum): GetPoolPeriodEnum => {
  switch (period) {
    case GetPoolsPeriodEnum.All:
      return GetPoolPeriodEnum.All
    case GetPoolsPeriodEnum._365d:
      return GetPoolPeriodEnum._365d
    case GetPoolsPeriodEnum._180d:
      return GetPoolPeriodEnum._180d
    case GetPoolsPeriodEnum._100d:
      return GetPoolPeriodEnum._100d
    case GetPoolsPeriodEnum._90d:
      return GetPoolPeriodEnum._90d
    case GetPoolsPeriodEnum._30d:
      return GetPoolPeriodEnum._30d
    case GetPoolsPeriodEnum._7d:
      return GetPoolPeriodEnum._7d
    case GetPoolsPeriodEnum._24h:
      return GetPoolPeriodEnum._24h
    case GetPoolsPeriodEnum._1h:
      return GetPoolPeriodEnum._1h
    default:
      throw new Error(`Unexpected period: ${period}`)
  }
}
