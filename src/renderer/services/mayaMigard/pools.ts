import * as RD from '@devexperts/remote-data-ts'
import { DefaultApi } from '@xchainjs/xchain-mayamidgard'
import { Asset, assetFromString, assetToString, bn, Chain, currencySymbolByAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as P from 'fp-ts/lib/Predicate'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import { DEFAULT_GET_POOLS_PERIOD_MAYA, ONE_BN, PRICE_POOLS_WHITELIST } from '../../const'
import { validAssetForETH, isPricePoolAsset, midgardAssetFromString } from '../../helpers/assetHelper'
import { isEthChain } from '../../helpers/chainHelper'
import { eqAsset, eqOAsset, eqOPoolAddresses, eqHaltedChain } from '../../helpers/fp/eq'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { LiveData, liveData } from '../../helpers/rx/liveData'
import { observableState, triggerStream, TriggerStream$ } from '../../helpers/stateHelper'
import { roundUnixTimestampToMinutes } from '../../helpers/timeHelper'
import { PricePool, PricePoolAsset, PricePools } from '../../views/pools/Pools.types'
import { network$ } from '../app/service'
import { PoolFeeLD } from '../chain/types'
import { InboundAddresses, InboundAddressesLD } from '../mayachain/types'
import { ErrorId } from '../wallet/types'
import {
  getPoolAddressesByChain,
  getPoolAssetDetail,
  getPricePools,
  pricePoolSelector,
  pricePoolSelectorFromRD,
  inboundToPoolAddresses,
  getOutboundAssetFeeByChain,
  toPoolsData,
  poolsPeriodToPoolPeriod
} from './/utils'
import {
  PoolAssetDetailsLD,
  PendingPoolsStateLD,
  PoolAssetsLD,
  PoolDetailsLD,
  PoolsService,
  PoolsStateLD,
  SelectedPricePoolAsset,
  PoolAddressesLD,
  ValidatePoolLD,
  PoolAddress$,
  PoolAddressLD,
  PoolAddress,
  PoolFilter,
  PoolStatsDetailLD,
  PoolLiquidityHistoryLD,
  PoolLiquidityHistoryParams,
  PoolDetailLD,
  SwapHistoryLD,
  ApiGetSwapHistoryParams,
  GetSwapHistoryParams,
  GetDepthHistoryParams,
  DepthHistoryLD,
  ApiGetDepthHistoryParams,
  EarningsHistoryLD,
  PoolEarningHistoryLD,
  PoolAddresses,
  PoolsState,
  HaltedChainsLD,
  SelectedPoolAsset,
  PoolType,
  MidgardUrlLD,
  GetPoolsPeriodEnum,
  GetPoolsRequest,
  GetPoolStatsRequest,
  GetPoolStatsPeriodEnum,
  GetEarningsHistoryRequest,
  GetLiquidityHistoryRequest,
  GetPoolsStatusEnum
} from './types'

const PRICE_POOL_KEY = 'asgdx-price-pool'

const getStoredSelectedPricePoolAsset = (): SelectedPricePoolAsset =>
  FP.pipe(
    localStorage.getItem(PRICE_POOL_KEY) as string,
    O.fromNullable,
    O.map(assetFromString),
    O.chain(O.fromNullable),
    O.filter(isPricePoolAsset)
  )

const roundToFiveMinutes = roundUnixTimestampToMinutes(5)

const createPoolsService = ({
  midgardUrl$,
  getMidgardDefaultApi,
  selectedPoolAsset$,
  loadInboundAddresses$,
  inboundAddressesShared$
}: {
  midgardUrl$: MidgardUrlLD
  getMidgardDefaultApi: (basePath: string) => DefaultApi
  selectedPoolAsset$: Rx.Observable<SelectedPoolAsset>
  loadInboundAddresses$: () => InboundAddressesLD
  inboundAddressesShared$: InboundAddressesLD
}): PoolsService => {
  const midgardDefaultApi$: LiveData<Error, DefaultApi> = FP.pipe(
    midgardUrl$,
    liveData.map(getMidgardDefaultApi),
    RxOp.shareReplay(1)
  )

  const {
    get$: poolsFilters$,
    set: _setPoolsFilter,
    get: _getPoolsFilter
  } = observableState<Record<PoolType, O.Option<PoolFilter>>>({
    active: O.none,
    pending: O.none
  })

  const setPoolsFilter = (poolKey: PoolType, filterValue: O.Option<PoolFilter>) => {
    const currentState = _getPoolsFilter()
    _setPoolsFilter({ ...currentState, [poolKey]: filterValue })
  }

  // Factory to get `Pools` from Midgard
  const apiGetPools$ = (request: GetPoolsRequest, reload$: TriggerStream$): PoolDetailsLD =>
    FP.pipe(
      Rx.combineLatest([midgardDefaultApi$, poolsPeriod$, reload$]),
      RxOp.switchMap(([apiRD, period, _]) =>
        FP.pipe(
          apiRD,
          RD.fold(
            () => Rx.EMPTY,
            () => Rx.EMPTY,
            (error: Error) => Rx.of(RD.failure(error)),
            (api: DefaultApi) =>
              FP.pipe(
                Rx.from(api.getPools(request.status, period)),
                RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
                RxOp.map(
                  RD.map(
                    A.filter(({ asset }) =>
                      FP.pipe(
                        asset,
                        midgardAssetFromString,
                        O.fold(
                          () => false,
                          ({ chain }) => isEnabledChain(chain)
                        )
                      )
                    )
                  )
                ),
                RxOp.startWith(RD.pending),
                RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
              )
          )
        )
      ),
      RxOp.shareReplay(1)
    )

  // `TriggerStream` to reload data of pools
  const { stream$: reloadPools$, trigger: reloadPools } = triggerStream()

  const { get$: _getPoolsPeriod$, set: setPoolsPeriod } =
    observableState<GetPoolsPeriodEnum>(DEFAULT_GET_POOLS_PERIOD_MAYA)

  const poolsPeriod$ = FP.pipe(_getPoolsPeriod$, RxOp.distinctUntilChanged(), RxOp.shareReplay(1))

  /**
   * Data of enabled `Pools` from Midgard
   */
  const apiGetPoolsEnabled$: PoolDetailsLD = apiGetPools$({ status: GetPoolsStatusEnum.Available }, reloadPools$)

  // `TriggerStream` to reload data of pending pools
  const { stream$: reloadPendingPools$, trigger: reloadPendingPools } = triggerStream()

  /**
   * Data of pending `Pools` from Midgard
   */
  const apiGetPoolsPending$: PoolDetailsLD = apiGetPools$({ status: GetPoolsStatusEnum.Staged }, reloadPendingPools$)

  // `TriggerStream` to reload data of all pools
  const { stream$: reloadAllPools$, trigger: reloadAllPools } = triggerStream()

  /**
   * Data of all `Pools`
   */
  const apiGetPoolsAll$: PoolDetailsLD = apiGetPools$({ status: undefined }, reloadAllPools$)

  /**
   * Helper to get (same) stream of `PoolDetailsLD` by given status
   *
   * If status is not set (or undefined), `PoolDetails` of all Pools will be loaded
   */
  const apiGetPoolsByStatus$ = (status?: GetPoolsStatusEnum): PoolDetailsLD => {
    switch (status) {
      case GetPoolsStatusEnum.Available:
        return apiGetPoolsEnabled$
      case GetPoolsStatusEnum.Staged:
        return apiGetPoolsPending$
      default:
        return apiGetPoolsAll$
    }
  }
  /**
   * Data of `AssetDetails` from Midgard
   */
  const apiGetAssetInfo$: (assetOrAssets: string | string[], status: GetPoolsStatusEnum) => PoolAssetDetailsLD = (
    assetOrAssets,
    status
  ) => {
    const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets]

    return FP.pipe(
      apiGetPoolsByStatus$(status),
      liveData.map(A.filter((pool) => assets.includes(pool.asset))),
      liveData.map(A.filterMap(getPoolAssetDetail)),
      RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
    )
  }

  /**
   * `PoolDetail data from Midgard
   */
  const apiGetPoolDetail$ = (asset: Asset): PoolDetailLD =>
    FP.pipe(
      Rx.combineLatest([midgardDefaultApi$, poolsPeriod$]),
      RxOp.map(([apiRD, period]) =>
        FP.pipe(
          apiRD,
          RD.map((api) => ({ api, period }))
        )
      ),
      liveData.chain(({ api, period }) => {
        return FP.pipe(
          Rx.from(api.getPool(assetToString(asset), poolsPeriodToPoolPeriod(period))),
          RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      })
    )

  /**
   * `PoolDetails` data by given `GetPoolsStatusEnum`
   */
  const apiGetPoolDetails$: (assetOrAssets: string | string[], status?: GetPoolsStatusEnum) => PoolDetailsLD = (
    assetOrAssets,
    status
  ) => {
    const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets]

    return FP.pipe(
      apiGetPoolsByStatus$(status),
      liveData.map(A.filter((poolDetail) => assets.includes(poolDetail.asset))),
      liveData.map(NEA.fromArray),
      liveData.chain(
        O.fold(
          // TODO (@thatStrangeGuy | @veado) Add i18n
          (): PoolDetailsLD => Rx.of(RD.failure(new Error('No pools available'))),
          (poolsDetails): PoolDetailsLD => Rx.of(RD.success(poolsDetails))
        )
      ),
      RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
    )
  }

  // Factory to create a stream to get data of `AssetDetails`
  const getAssetDetails$: (poolAssets$: PoolAssetsLD, status: GetPoolsStatusEnum) => PoolAssetDetailsLD = (
    poolAssets$,
    status
  ) =>
    FP.pipe(
      poolAssets$,
      liveData.map(A.map(assetToString)),
      liveData.map(NEA.fromArray),
      // provide an empty list of `AssetDetails` in case of empty list of pools
      liveData.chain(
        O.fold(
          () => liveData.of([]),
          (assets) => apiGetAssetInfo$(assets, status)
        )
      ),
      RxOp.shareReplay(1)
    )

  // Factory to create a stream to get data of `PoolDetails`
  const getPoolDetails$: (poolAssets$: PoolAssetsLD, status?: GetPoolsStatusEnum) => PoolDetailsLD = (
    poolAssets$,
    status
  ) =>
    FP.pipe(
      poolAssets$,
      liveData.map(A.map(assetToString)),
      liveData.map(NEA.fromArray),
      // provide an empty list of `PoolDetails` in case of empty list of pools
      liveData.chain(
        O.fold(
          () => liveData.of([]),
          (assets) => apiGetPoolDetails$(assets, status)
        )
      ),
      RxOp.shareReplay(1)
    )

  /**
   * Loading queue to get `PoolDetails` of all pools
   */
  const loadAllPoolDetails$ = (): PoolDetailsLD => {
    const poolAssets$: PoolAssetsLD = FP.pipe(
      apiGetPoolsAll$,
      // Filter out all unknown / invalid assets created from asset strings
      liveData.map(A.filterMap(({ asset }) => FP.pipe(asset, assetFromString, O.fromNullable))),
      // Filter pools by using enabled chains only
      liveData.map(A.filter(({ chain }) => isEnabledChain(chain))),
      RxOp.shareReplay(1)
    )

    return FP.pipe(
      getPoolDetails$(poolAssets$),
      RxOp.startWith(RD.pending),
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
    )
  }

  /**
   * `PoolDetails` of all pools
   */
  const allPoolDetails$: PoolDetailsLD = FP.pipe(
    reloadPools$,
    // start loading queue
    RxOp.switchMap(loadAllPoolDetails$),
    // cache it to avoid reloading data by every subscription
    RxOp.shareReplay(1)
  )

  /**
   * Loading queue to get all needed data for `PoolsState`
   */
  const loadPoolsStateData$ = (): PoolsStateLD => {
    const poolAssets$: PoolAssetsLD = FP.pipe(
      Rx.combineLatest([apiGetPoolsEnabled$, network$]),
      RxOp.switchMap(([pools, network]) =>
        Rx.of(
          FP.pipe(
            pools,
            // Filter out all unknown / invalid assets created from asset strings
            RD.map(A.filterMap(({ asset }) => FP.pipe(asset, assetFromString, O.fromNullable))),
            // Filter pools by using enabled chains only
            RD.map(A.filter(({ chain }) => isEnabledChain(chain))),
            // Filter pools based on ERC20Whitelist (mainnet + ETHChain only)
            RD.map(A.filter((asset) => !isEthChain(asset.chain) || validAssetForETH(asset, network)))
          )
        )
      ),
      RxOp.shareReplay(1)
    )
    const assetDetails$ = getAssetDetails$(poolAssets$, GetPoolsStatusEnum.Available)
    const poolDetails$ = getPoolDetails$(poolAssets$, GetPoolsStatusEnum.Available)

    const pricePools$: LiveData<Error, O.Option<PricePools>> = poolDetails$.pipe(
      RxOp.map((poolDetailsRD) =>
        FP.pipe(
          poolDetailsRD,
          RD.map((poolDetails) => O.some(getPricePools(poolDetails, PRICE_POOLS_WHITELIST)))
        )
      ),
      RxOp.shareReplay(1)
    )

    return FP.pipe(
      Rx.combineLatest([poolAssets$, assetDetails$, poolDetails$, pricePools$]),
      RxOp.map((state) => RD.combine(...state)),
      RxOp.map(
        RD.map(([poolAssets, assetDetails, poolDetails, pricePools]): PoolsState => {
          const prevAsset = getSelectedPricePoolAsset()
          const nullablePricePools = O.toNullable(pricePools)
          if (nullablePricePools) {
            const selectedPricePool = pricePoolSelector(nullablePricePools, prevAsset)
            setSelectedPricePoolAsset(selectedPricePool.asset)
          }
          // Provide `PoolData` map (needed for pricing)
          const poolsData = toPoolsData(poolDetails)

          return {
            poolAssets,
            assetDetails,
            poolsData,
            poolDetails,
            pricePools
          }
        })
      ),
      RxOp.startWith(RD.pending),
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
    )
  }

  /**
   * State of data of available pools
   */
  const poolsState$: PoolsStateLD = reloadPools$.pipe(
    // start loading queue
    RxOp.switchMap(loadPoolsStateData$),
    // cache it to avoid reloading data by every subscription
    RxOp.shareReplay(1)
  )

  /**
   * Loading queue to get all needed data for `PendingPoolsState`
   */
  const loadPendingPoolsStateData$ = (): PendingPoolsStateLD => {
    const poolAssets$: PoolAssetsLD = FP.pipe(
      Rx.combineLatest([apiGetPoolsPending$, network$]),
      RxOp.switchMap(([pools, network]) =>
        Rx.of(
          FP.pipe(
            pools,
            // Filter out all unknown / invalid assets created from asset strings
            RD.map(A.filterMap(({ asset }) => FP.pipe(asset, assetFromString, O.fromNullable))),
            // Filter pools by using enabled chains only
            RD.map(A.filter(({ chain }) => isEnabledChain(chain))),
            // Filter pools based on ERC20Whitelist (mainnet + ETH only)
            RD.map(A.filter((asset) => !isEthChain(asset.chain) || validAssetForETH(asset, network)))
          )
        )
      ),
      RxOp.shareReplay(1)
    )
    const assetDetails$ = getAssetDetails$(poolAssets$, GetPoolsStatusEnum.Staged)
    const poolDetails$ = getPoolDetails$(poolAssets$, GetPoolsStatusEnum.Staged)

    return FP.pipe(
      liveData.sequenceS({
        poolAssets: poolAssets$,
        assetDetails: assetDetails$,
        poolDetails: poolDetails$
      }),
      RxOp.startWith(RD.pending),
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
    )
  }

  /**
   * State of data of pendings pools
   */
  const pendingPoolsState$: PendingPoolsStateLD = FP.pipe(
    reloadPendingPools$,
    // start loading queue
    RxOp.switchMap(loadPendingPoolsStateData$),
    // cache it to avoid reloading data by every subscription
    RxOp.shareReplay(1)
  )

  const { get$: reloadSelectedPoolDetail$, set: _reloadSelectedPoolDetail } = observableState(0)

  /**
   * Stream of `PoolDetail` data based on selected pool asset
   * It's triggered by changes of selectedPoolAsset$` + `reloadSelectedPoolDetail$`
   */
  const selectedPoolDetail$: PoolDetailLD = Rx.combineLatest([selectedPoolAsset$, reloadSelectedPoolDetail$]).pipe(
    RxOp.switchMap(([oSelectedPoolAsset, delay]) =>
      FP.pipe(
        Rx.timer(delay),
        RxOp.switchMap(() => Rx.of(oSelectedPoolAsset))
      )
    ),
    RxOp.switchMap((selectedPoolAsset) => {
      return FP.pipe(
        selectedPoolAsset,
        O.fold(() => Rx.of(RD.initial), apiGetPoolDetail$)
      )
    }),
    RxOp.startWith(RD.pending)
  )

  const availableAssets$: PoolAssetsLD = FP.pipe(
    poolsState$,
    liveData.map((poolsState) => poolsState.poolAssets)
  )

  const {
    get: getSelectedPricePoolAsset,
    get$: selectedPricePoolAsset$,
    set: updateSelectedPricePoolAsset
  } = observableState<SelectedPricePoolAsset>(getStoredSelectedPricePoolAsset())

  /**
   * Update selected `PricePoolAsset`
   */
  const setSelectedPricePoolAsset = (asset: PricePoolAsset) => {
    localStorage.setItem(PRICE_POOL_KEY, assetToString(asset))
    updateSelectedPricePoolAsset(O.some(asset))
  }

  /**
   * Selected currency symbol
   */
  const selectedPricePoolAssetSymbol$: Rx.Observable<O.Option<string>> = selectedPricePoolAsset$.pipe(
    RxOp.map(O.map(currencySymbolByAsset))
  )

  /**
   * Selected price pool
   */
  const selectedPricePool$: Rx.Observable<PricePool> = Rx.combineLatest([poolsState$, selectedPricePoolAsset$]).pipe(
    RxOp.map(([poolsState, selectedPricePoolAsset]) => pricePoolSelectorFromRD(poolsState, selectedPricePoolAsset))
  )

  const haltedChains$: HaltedChainsLD = FP.pipe(
    inboundAddressesShared$,
    liveData.map(A.filterMap((inboundAddress) => (inboundAddress.halted ? O.some(inboundAddress.chain) : O.none)))
  )

  /**
   * Load pool addresses once
   * Use it whenever you do need latest data (e.g. for validation)
   */
  const poolAddresses$ = (): PoolAddressesLD => FP.pipe(loadInboundAddresses$(), liveData.map(inboundToPoolAddresses))

  /**
   * Get's (cached) pool addresses
   *
   * It will be updated as soon as `inboundAddressesInterval` is triggered
   * or by reloading via `reloadInboundAddresses`
   * All defined in `inboundAddressesShared$`
   */
  const poolAddressesShared$: PoolAddressesLD = FP.pipe(inboundAddressesShared$, liveData.map(inboundToPoolAddresses))

  const selectedPoolAddress$: PoolAddress$ = Rx.combineLatest([poolAddressesShared$, selectedPoolAsset$]).pipe(
    RxOp.map(([poolAddresses, oSelectedPoolAsset]) => {
      return FP.pipe(
        poolAddresses,
        RD.toOption,
        // TODO (@Veado) Will we ingore router for some cases (e.g. by withdrawing something from ETH vault not using router)=
        (oPoolAddresses) => sequenceTOption(oPoolAddresses, oSelectedPoolAsset),
        O.chain(([addresses, { chain }]) => getPoolAddressesByChain(addresses, chain))
      )
    })
  )

  const poolAddressesByChain$ = (chain: Chain): PoolAddressLD =>
    FP.pipe(
      poolAddressesShared$,
      liveData.map((addresses: PoolAddresses) => getPoolAddressesByChain(addresses, chain)),
      // Add error in case no address could be found
      liveData.chain(liveData.fromOption(() => Error('Could not find pool address')))
    )

  /**
   * (Cached) outbound fees by given chain
   * Note: Fees are for asset side only (not RUNE)
   *
   * Fees will be updated as soon as `inboundAddressesInterval` is triggered
   * OR by reloading via `reloadInboundAddresses`
   * All defined in `inboundAddressesShared$`
   */
  const outboundAssetFeeByChain$ = (chain: Chain): PoolFeeLD =>
    FP.pipe(
      inboundAddressesShared$,
      liveData.map((addresses: InboundAddresses) => getOutboundAssetFeeByChain(addresses, chain)),
      // Add error in case no address could be found
      liveData.chain(liveData.fromOption(() => Error(`Could not find outbound fee for ${chain}`)))
    )

  /**
   * Use this to convert asset's price to selected price asset by multiplying to the priceRation inner value
   */
  const priceRatio$: Rx.Observable<BigNumber> = FP.pipe(
    Rx.combineLatest([FP.pipe(poolsState$, RxOp.map(RD.toOption)), selectedPricePoolAsset$]),
    RxOp.map(([pools, selectedAsset]) => sequenceTOption(pools, selectedAsset)),
    RxOp.map(
      O.chain(([pools, selectedAsset]) =>
        FP.pipe(
          pools.assetDetails,
          A.findFirst(({ asset }) => eqAsset.equals(asset, selectedAsset))
        )
      )
    ),
    RxOp.map(O.map((detail) => ONE_BN.dividedBy(bn(detail.assetPrice || 1)))),
    RxOp.map(O.getOrElse(() => ONE_BN))
  )

  /**
   * Validates pool address
   *
   * @param poolAddress Pool address to validate
   * @param chain Chain of pool to validate
   */
  const validatePool$ = (poolAddress: PoolAddress, chain: Chain): ValidatePoolLD =>
    FP.pipe(
      poolAddresses$(),
      liveData.chain(
        (poolAddresses): PoolAddressesLD =>
          FP.pipe(
            poolAddresses,
            liveData.fromPredicate(
              (addresses) =>
                FP.pipe(
                  addresses,
                  A.map(({ chain, halted }) => ({ chain, halted })),
                  // Valid chains only that ones which are NOT included to the halted array
                  P.not(A.elem(eqHaltedChain)({ chain, halted: true }))
                ),
              () => new Error(`Trading for pools on ${chain} chain(s) is halted for maintenance.`)
            )
          )
      ),
      liveData.map((addresses) => getPoolAddressesByChain(addresses, chain)),
      liveData.chain((oAddresses) =>
        eqOPoolAddresses.equals(oAddresses, O.some(poolAddress))
          ? Rx.of(RD.success(true))
          : // TODO (@veado) Add i18n
            Rx.of(
              RD.failure(
                Error(
                  `Pool address ${poolAddress.address} ${FP.pipe(
                    poolAddress.router,
                    O.map((poolAddress) => `and/or router address ${poolAddress} are not available`),
                    O.getOrElse(() => 'is not available')
                  )}`
                )
              )
            )
      ),
      liveData.mapLeft((error) => ({
        errorId: ErrorId.VALIDATE_POOL,
        msg: error?.message ?? error.toString()
      })),
      RxOp.catchError((error: Error) =>
        Rx.of(
          RD.failure({
            errorId: ErrorId.VALIDATE_POOL,
            msg: error?.message ?? error.toString()
          })
        )
      )
    )

  // Factory to get pool stats detail from Midgard
  const apiGetPoolStatsDetail$ = (request: GetPoolStatsRequest): PoolStatsDetailLD =>
    FP.pipe(
      midgardDefaultApi$,
      liveData.chain((api) =>
        FP.pipe(
          Rx.from(api.getPoolStats(request.asset, request.period)),
          RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )

  const { stream$: reloadPoolStatsDetail$, trigger: reloadPoolStatsDetail } = triggerStream()

  const poolStatsDetail$: PoolStatsDetailLD = Rx.combineLatest([selectedPoolAsset$, reloadPoolStatsDetail$]).pipe(
    RxOp.map(([oSelectedPoolAsset]) => oSelectedPoolAsset),
    RxOp.switchMap((selectedPoolAsset) => {
      return FP.pipe(
        selectedPoolAsset,
        O.fold(
          () => Rx.of(RD.initial),
          (asset) =>
            apiGetPoolStatsDetail$({
              asset: assetToString(asset),
              period: GetPoolStatsPeriodEnum.All
            })
        )
      )
    }),
    RxOp.startWith(RD.pending)
  )

  // Factory to get earning history
  const apiGetEarningHistory$ = ({ from, to, ...request }: GetEarningsHistoryRequest): EarningsHistoryLD =>
    FP.pipe(
      midgardDefaultApi$,
      liveData.chain((api) =>
        FP.pipe(
          Rx.from(
            api.getEarningsHistory(
              request.interval,
              O.toUndefined(roundToFiveMinutes(from)),
              O.toUndefined(roundToFiveMinutes(to))
            )
          ),
          RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )

  const { stream$: reloadPoolEarningHistory$, trigger: reloadPoolEarningHistory } = triggerStream()

  const poolEarningHistory$: PoolEarningHistoryLD = Rx.combineLatest([
    selectedPoolAsset$,
    reloadPoolEarningHistory$
  ]).pipe(
    RxOp.switchMap(([oSelectedPoolAsset, _]) =>
      FP.pipe(
        oSelectedPoolAsset,
        O.fold(
          () => Rx.of(RD.initial),
          (asset) =>
            FP.pipe(
              apiGetEarningHistory$({}),
              liveData.map((history) =>
                history.meta.pools.find((pool) => eqOAsset.equals(midgardAssetFromString(pool.pool), O.some(asset)))
              ),
              liveData.map((pool) => O.fromNullable(pool))
            )
        )
      )
    ),
    RxOp.startWith(RD.pending)
  )

  const { stream$: reloadLiquidityHistory$, trigger: reloadLiquidityHistory } = triggerStream()

  // Factory to get liquidity history from Midgard
  const apiGetLiquidityHistory$ = ({ from, to, ...request }: GetLiquidityHistoryRequest): PoolLiquidityHistoryLD =>
    FP.pipe(
      Rx.combineLatest([midgardDefaultApi$, reloadLiquidityHistory$]),
      RxOp.map(([api, _]) => api),
      liveData.chain((api) =>
        FP.pipe(
          Rx.from(
            api.getLiquidityHistory(
              request.pool,
              request.interval,
              request.count,
              O.toUndefined(roundToFiveMinutes(from)),
              O.toUndefined(roundToFiveMinutes(to))
            )
          ),
          RxOp.map((response) =>
            response.data /* response.data is the actual LiquidityHistory object */
              ? RD.success(response.data)
              : RD.failure(Error('Failed to load liquidity history from Midgard'))
          ),
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )

  const getPoolLiquidityHistory$ = (params: PoolLiquidityHistoryParams): PoolLiquidityHistoryLD =>
    selectedPoolAsset$.pipe(
      RxOp.switchMap((selectedPoolAsset) =>
        FP.pipe(
          selectedPoolAsset,
          O.fold(
            () => Rx.of(RD.initial),
            (asset) =>
              apiGetLiquidityHistory$({
                pool: assetToString(asset),
                interval: params.interval,
                from: params.from,
                to: params.to
              })
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  // Factory to get swap history from Midgard
  const apiGetSwapHistory$ = (params: ApiGetSwapHistoryParams): SwapHistoryLD => {
    const { poolAsset, from, to, ...otherParams } = params
    const pool = FP.pipe(poolAsset, O.fromNullable, O.map(assetToString), O.toUndefined)
    return FP.pipe(
      midgardDefaultApi$,
      liveData.chain((api) =>
        FP.pipe(
          Rx.from(
            api.getSwapHistory(
              pool,
              otherParams.interval,
              otherParams.count,
              O.toUndefined(roundToFiveMinutes(from)),
              O.toUndefined(roundToFiveMinutes(to))
            )
          ),
          RxOp.map((response) => {
            return RD.success(response.data)
          }), // Extract data from AxiosResponse
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )
  }

  const { stream$: reloadSwapHistory$, trigger: reloadSwapHistory } = triggerStream()

  const getSelectedPoolSwapHistory$ = (params: GetSwapHistoryParams): SwapHistoryLD =>
    FP.pipe(
      Rx.combineLatest([selectedPoolAsset$, reloadSwapHistory$]),
      RxOp.filter(([oSelectedPoolAsset, _]) => O.isSome(oSelectedPoolAsset)),

      RxOp.switchMap(([oSelectedPoolAsset]) =>
        FP.pipe(
          oSelectedPoolAsset,
          O.fold(
            () => Rx.of(RD.initial),
            (selectedPoolAsset) =>
              apiGetSwapHistory$({
                poolAsset: selectedPoolAsset,
                ...params
              })
          )
        )
      ),
      RxOp.startWith(RD.initial)
    )

  // Factory to get depth history from Midgard
  const apiGetDepthHistory$ = (params: ApiGetDepthHistoryParams): DepthHistoryLD => {
    const { poolAsset, from, to, ...otherParams } = params

    return FP.pipe(
      midgardDefaultApi$,
      liveData.chain((api) =>
        FP.pipe(
          Rx.from(
            api.getDepthHistory(
              assetToString(poolAsset),
              otherParams.interval,
              otherParams.count,
              O.toUndefined(roundToFiveMinutes(from)),
              O.toUndefined(roundToFiveMinutes(to))
            )
          ),
          RxOp.map((response) =>
            response.data ? RD.success(response.data) : RD.failure(Error('Failed to load depth history from Midgard'))
          ), // Extract data from AxiosResponse
          RxOp.startWith(RD.pending),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )
  }

  const { stream$: reloadDepthHistory$, trigger: reloadDepthHistory } = triggerStream()

  const getDepthHistory$ = (params: GetDepthHistoryParams): DepthHistoryLD =>
    FP.pipe(
      Rx.combineLatest([selectedPoolAsset$, reloadDepthHistory$]),
      RxOp.switchMap(([oSelectedPoolAsset, _]) =>
        FP.pipe(
          oSelectedPoolAsset,
          O.fold(
            () => Rx.of(RD.initial),
            (selectedPoolAsset) =>
              apiGetDepthHistory$({
                poolAsset: selectedPoolAsset,
                ...params
              })
          )
        )
      ),
      RxOp.startWith(RD.initial)
    )

  return {
    setPoolsPeriod,
    poolsPeriod$,
    poolsState$,
    pendingPoolsState$,
    allPoolDetails$,
    setSelectedPricePoolAsset,
    selectedPricePoolAsset$,
    selectedPricePool$,
    selectedPricePoolAssetSymbol$,
    reloadPools,
    reloadPendingPools,
    reloadAllPools,
    selectedPoolAddress$,
    poolAddressesByChain$,
    selectedPoolDetail$,
    reloadSelectedPoolDetail: (delayTime = 0) => _reloadSelectedPoolDetail(delayTime),
    reloadLiquidityHistory,
    poolStatsDetail$,
    reloadPoolStatsDetail,
    poolEarningHistory$,
    reloadPoolEarningHistory,
    getPoolLiquidityHistory$,
    getSelectedPoolSwapHistory$,
    apiGetSwapHistory$,
    apiGetLiquidityHistory$,
    reloadSwapHistory,
    getDepthHistory$,
    reloadDepthHistory,
    priceRatio$,
    availableAssets$,
    validatePool$,
    poolsFilters$,
    setPoolsFilter,
    outboundAssetFeeByChain$,
    haltedChains$
  }
}

export { createPoolsService, getStoredSelectedPricePoolAsset as getSelectedPricePool }
