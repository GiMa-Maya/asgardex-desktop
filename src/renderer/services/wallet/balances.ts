import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isEnabledChain } from '../../../shared/utils/chain'
import { HDMode, WalletAddress, WalletBalanceType, WalletType } from '../../../shared/wallet/types'
import { filterEnabledChains } from '../../helpers/chainHelper'
import { eqBalancesRD } from '../../helpers/fp/eq'
import { sequenceTOptionFromArray } from '../../helpers/fpHelpers'
import { liveData } from '../../helpers/rx/liveData'
import { addressFromOptionalWalletAddress } from '../../helpers/walletHelper'
import { Network$ } from '../app/types'
import * as ARB from '../arb'
import * as AVAX from '../avax'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as BSC from '../bsc'
import { WalletBalancesLD, WalletBalancesRD } from '../clients'
import * as COSMOS from '../cosmos'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as ETH from '../ethereum'
import * as KUJI from '../kuji'
import * as LTC from '../litecoin'
import * as MAYA from '../mayachain'
import * as THOR from '../thorchain'
import { INITIAL_BALANCES_STATE } from './const'
import {
  ChainBalances$,
  ChainBalance$,
  BalancesService,
  ChainBalancesService,
  BalancesState$,
  KeystoreState$,
  KeystoreState,
  ChainBalance,
  GetLedgerAddressHandler
} from './types'
import { hasImportedKeystore } from './util'

export const createBalancesService = ({
  keystore$,
  network$,
  getLedgerAddress$
}: {
  keystore$: KeystoreState$
  network$: Network$
  getLedgerAddress$: GetLedgerAddressHandler
}): BalancesService => {
  // reload all balances
  const reloadBalances: FP.Lazy<void> = () => {
    BTC.reloadBalances()
    DASH.reloadBalances()
    BCH.reloadBalances()
    ETH.reloadBalances()
    ARB.reloadBalances()
    AVAX.reloadBalances()
    BSC.reloadBalances()
    THOR.reloadBalances()
    MAYA.reloadBalances()
    LTC.reloadBalances()
    DOGE.reloadBalances()
    COSMOS.reloadBalances()
    KUJI.reloadBalances()
  }

  // Returns lazy functions to reload balances by given chain
  const reloadBalancesByChain = (chain: Chain) => {
    if (!isEnabledChain(chain)) return FP.constVoid

    switch (chain) {
      case BTCChain:
        return BTC.reloadBalances
      case DASHChain:
        return DASH.reloadBalances
      case BCHChain:
        return BCH.reloadBalances
      case ETHChain:
        return ETH.reloadBalances
      case ARBChain:
        return ARB.reloadBalances
      case AVAXChain:
        return AVAX.reloadBalances
      case BSCChain:
        return BSC.reloadBalances
      case THORChain:
        return THOR.reloadBalances
      case MAYAChain:
        return MAYA.reloadBalances
      case LTCChain:
        return LTC.reloadBalances
      case DOGEChain:
        return DOGE.reloadBalances
      case KUJIChain:
        return KUJI.reloadBalances
      case GAIAChain:
        return COSMOS.reloadBalances
    }
  }

  const getBalancesServiceByChain = ({
    chain,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType
  }: {
    chain: Chain
    walletType: WalletType
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
    walletBalanceType: WalletBalanceType
  }): ChainBalancesService => {
    if (!isEnabledChain(chain)) {
      return {
        reloadBalances: FP.constVoid,
        resetReloadBalances: FP.constVoid,
        balances$: Rx.EMPTY,
        reloadBalances$: Rx.EMPTY
      }
    }
    switch (chain) {
      case BTCChain:
        return {
          reloadBalances: BTC.reloadBalances,
          resetReloadBalances: BTC.resetReloadBalances,
          balances$: BTC.balances$({ walletType, walletAccount, walletIndex, walletBalanceType, hdMode }),
          reloadBalances$: BTC.reloadBalances$
        }
      case DASHChain:
        return {
          reloadBalances: DASH.reloadBalances,
          resetReloadBalances: DASH.resetReloadBalances,
          balances$: DASH.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: DASH.reloadBalances$
        }
      case BCHChain:
        return {
          reloadBalances: BCH.reloadBalances,
          resetReloadBalances: BCH.resetReloadBalances,
          balances$: BCH.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: BCH.reloadBalances$
        }
      case ETHChain:
        return {
          reloadBalances: ETH.reloadBalances,
          resetReloadBalances: ETH.resetReloadBalances,
          balances$: FP.pipe(
            network$,
            RxOp.switchMap((network) => ETH.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
          ),
          reloadBalances$: ETH.reloadBalances$
        }
      case ARBChain:
        return {
          reloadBalances: ARB.reloadBalances,
          resetReloadBalances: ARB.resetReloadBalances,
          balances$: FP.pipe(
            network$,
            RxOp.switchMap((network) => ARB.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
          ),
          reloadBalances$: ARB.reloadBalances$
        }
      case AVAXChain:
        return {
          reloadBalances: AVAX.reloadBalances,
          resetReloadBalances: AVAX.resetReloadBalances,
          balances$: FP.pipe(
            network$,
            RxOp.switchMap((network) => AVAX.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
          ),
          reloadBalances$: AVAX.reloadBalances$
        }
      case BSCChain:
        return {
          reloadBalances: BSC.reloadBalances,
          resetReloadBalances: BSC.resetReloadBalances,
          balances$: FP.pipe(
            network$,
            RxOp.switchMap((network) => BSC.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
          ),
          reloadBalances$: BSC.reloadBalances$
        }
      case THORChain:
        return {
          reloadBalances: THOR.reloadBalances,
          resetReloadBalances: THOR.resetReloadBalances,
          balances$: THOR.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: THOR.reloadBalances$
        }
      case MAYAChain:
        return {
          reloadBalances: MAYA.reloadBalances,
          resetReloadBalances: MAYA.resetReloadBalances,
          balances$: MAYA.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: MAYA.reloadBalances$
        }
      case LTCChain:
        return {
          reloadBalances: LTC.reloadBalances,
          resetReloadBalances: LTC.resetReloadBalances,
          balances$: LTC.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: LTC.reloadBalances$
        }
      case DOGEChain:
        return {
          reloadBalances: DOGE.reloadBalances,
          resetReloadBalances: DOGE.resetReloadBalances,
          balances$: DOGE.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: DOGE.reloadBalances$
        }
      case KUJIChain:
        return {
          reloadBalances: KUJI.reloadBalances,
          resetReloadBalances: KUJI.resetReloadBalances,
          balances$: KUJI.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: KUJI.reloadBalances$
        }
      case GAIAChain:
        return {
          reloadBalances: COSMOS.reloadBalances,
          resetReloadBalances: COSMOS.resetReloadBalances,
          balances$: COSMOS.balances$({ walletType, walletAccount, walletIndex, hdMode }),
          reloadBalances$: COSMOS.reloadBalances$
        }
    }
  }

  /**
   * Store previously successfully loaded results at the runtime-memory
   * to give to the user last balances he loaded without re-requesting
   * balances data which might be very expensive.
   */
  const walletBalancesState: Map<
    { chain: Chain; walletType: WalletType; walletBalanceType: WalletBalanceType },
    WalletBalancesRD
  > = new Map()

  // Whenever network is changed, reset stored balances
  const networkSub = network$.subscribe(() => {
    walletBalancesState.clear()
  })

  // Whenever keystore has been removed, reset stored balances
  const keystoreSub = keystore$.subscribe((keystoreState: KeystoreState) => {
    if (!hasImportedKeystore(keystoreState)) {
      walletBalancesState.clear()
    }
  })

  const getChainBalance$ = ({
    chain,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType
  }: {
    chain: Chain
    walletType: WalletType
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
    walletBalanceType: WalletBalanceType
  }): WalletBalancesLD => {
    const chainService = getBalancesServiceByChain({
      chain,
      walletType,
      walletAccount,
      walletIndex,
      hdMode,
      walletBalanceType
    })
    const reload$ = FP.pipe(
      chainService.reloadBalances$,
      RxOp.finalize(() => {
        // on finish a stream reset reload-trigger
        // unsubscribe will be initiated on any View unmount
        chainService.resetReloadBalances()
      })
    )

    return FP.pipe(
      reload$,
      RxOp.switchMap((shouldReloadData) => {
        const savedResult = walletBalancesState.get({ chain, walletType, walletBalanceType })
        // For every new simple subscription return cached results if they exist
        if (!shouldReloadData && savedResult) {
          return Rx.of(savedResult)
        }

        // If there is no cached data for appropriate chain request for it
        // Re-request data ONLY for manual calling update trigger with `trigger`
        // value inside of trigger$ stream
        return FP.pipe(
          chainService.balances$,
          // For every successful load save results to the memory-based cache
          // to avoid unwanted data re-requesting.
          liveData.map((balances) => {
            walletBalancesState.set({ chain, walletType, walletBalanceType }, RD.success(balances))
            return balances
          }),
          RxOp.startWith(savedResult || RD.initial)
        )
      })
    )
  }

  /**
   * Transforms THOR balances into `ChainBalances`
   */
  const thorChainBalance$: ChainBalance$ = Rx.combineLatest([
    THOR.addressUI$,
    getChainBalance$({
      chain: THORChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: THORChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * Transforms MAYA balances into `ChainBalances`
   */
  const mayaChainBalance$: ChainBalance$ = Rx.combineLatest([
    MAYA.addressUI$,
    getChainBalance$({
      chain: MAYAChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: MAYAChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * Factory to create a stream of ledger balances by given chain
   */
  const ledgerChainBalance$ = ({
    chain,
    walletBalanceType,
    getBalanceByAddress$
  }: {
    chain: Chain
    walletBalanceType: WalletBalanceType
    getBalanceByAddress$: ({
      address,
      walletAccount,
      walletType,
      walletIndex,
      hdMode,
      walletBalanceType
    }: {
      address: Address
      walletType: WalletType
      walletAccount: number
      walletIndex: number
      hdMode: HDMode
      walletBalanceType: WalletBalanceType
    }) => WalletBalancesLD
  }): ChainBalance$ =>
    FP.pipe(
      getLedgerAddress$(chain),
      RxOp.switchMap((oAddress) =>
        FP.pipe(
          oAddress,
          O.fold(
            () =>
              // In case we don't get an address,
              // just return `ChainBalance` w/ initial (empty) balances
              Rx.of<ChainBalance>({
                walletType: 'ledger',
                chain,
                walletAddress: O.none,
                balances: RD.initial,
                balancesType: walletBalanceType
              }),
            ({ address, walletAccount, walletIndex, hdMode }) =>
              // Load balances by given Ledger address
              // and put it's RD state into `balances` of `ChainBalance`
              FP.pipe(
                getBalanceByAddress$({
                  address,
                  walletType: 'ledger',
                  walletAccount,
                  walletIndex,
                  walletBalanceType,
                  hdMode
                }),
                RxOp.map<WalletBalancesRD, ChainBalance>((balances) => ({
                  walletType: 'ledger',
                  chain,
                  walletAddress: O.some(address),
                  balances,
                  balancesType: walletBalanceType,
                  hdMode
                }))
              )
          )
        )
      )
    )

  /**
   * THOR Ledger balances
   */
  const thorLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: THORChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: THOR.getBalanceByAddress$
  })

  /**
   * MAYA Ledger balances
   */
  const mayaLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: MAYAChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: MAYA.getBalanceByAddress$
  })

  /**
   * Transforms LTC balances into `ChainBalances`
   */
  const ltcBalance$: ChainBalance$ = Rx.combineLatest([
    LTC.addressUI$,
    getChainBalance$({
      chain: LTCChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: LTCChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * Transforms Dash balances into `ChainBalances`
   */
  const dashBalance$: ChainBalance$ = Rx.combineLatest([
    DASH.addressUI$,
    getChainBalance$({
      chain: DASHChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: DASHChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      balances,
      balancesType: 'all'
    }))
  )
  /**
   * DASH Ledger balances
   */
  const dashLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: DASHChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: DASH.getBalanceByAddress$
  })

  /**
   * LTC Ledger balances
   */
  const ltcLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: LTCChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: LTC.getBalanceByAddress$
  })

  /**
   * Transforms BCH balances into `ChainBalances`
   */
  const bchChainBalance$: ChainBalance$ = Rx.combineLatest([
    BCH.addressUI$,
    getChainBalance$({
      chain: BCHChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      walletBalanceType: 'all',
      hdMode: 'default'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: BCHChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * BCH Ledger balances
   */
  const bchLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: BCHChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: BCH.getBalanceByAddress$
  })

  /**
   * BTC Ledger balances
   */
  const btcLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: BTCChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: BTC.getBalanceByAddress$('all')
  })
  /**
   * BTC Ledger confirmed balances
   */
  const btcLedgerChainBalanceConfirmed$: ChainBalance$ = ledgerChainBalance$({
    chain: BTCChain,
    walletBalanceType: 'confirmed',
    getBalanceByAddress$: BTC.getBalanceByAddress$('confirmed')
  })

  /**
   * Transforms BTC balances into `ChainBalance`
   */
  const btcChainBalance$: ChainBalance$ = Rx.combineLatest([
    BTC.addressUI$,
    getChainBalance$({
      chain: BTCChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: BTCChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )
  /**
   * Transforms BTC balances into `ChainBalance`
   */
  const btcChainBalanceConfirmed$: ChainBalance$ = Rx.combineLatest([
    BTC.addressUI$,
    getChainBalance$({
      chain: BTCChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'confirmed'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: BTCChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'confirmed'
    }))
  )

  /**
   * Transforms DOGE balances into `ChainBalance`
   */
  const dogeChainBalance$: ChainBalance$ = Rx.combineLatest([
    DOGE.addressUI$,
    getChainBalance$({
      chain: DOGEChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: DOGEChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )
  /**
   * Transforms KUJI balances into `ChainBalance`
   */
  const kujiChainBalance$: ChainBalance$ = Rx.combineLatest([
    KUJI.addressUI$,
    getChainBalance$({
      chain: KUJIChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: KUJIChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )
  /**
   * KUJI Ledger balances
   */
  const kujiLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: KUJIChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: KUJI.getBalanceByAddress$
  })

  /**
   * DOGE Ledger balances
   */
  const dogeLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: DOGEChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: DOGE.getBalanceByAddress$
  })

  const ethBalances$ = getChainBalance$({
    chain: ETHChain,
    walletType: 'keystore',
    walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
    walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
    hdMode: 'default',
    walletBalanceType: 'all'
  })
  /**
   * Transforms ETH data (address + `WalletBalance`) into `ChainBalance`
   */
  const ethChainBalance$: ChainBalance$ = Rx.combineLatest([ETH.addressUI$, ethBalances$]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: ETHChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  const arbBalances$ = getChainBalance$({
    chain: ARBChain,
    walletType: 'keystore',
    walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
    walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
    hdMode: 'default',
    walletBalanceType: 'all'
  })

  /**
   * Transforms ARB data (address + `WalletBalance`) into `ChainBalance`
   */
  const arbChainBalance$: ChainBalance$ = Rx.combineLatest([ARB.addressUI$, arbBalances$]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: ARBChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  const avaxBalances$ = getChainBalance$({
    chain: AVAXChain,
    walletType: 'keystore',
    walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
    walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
    hdMode: 'default',
    walletBalanceType: 'all'
  })

  /**
   * Transforms AVAX data (address + `WalletBalance`) into `ChainBalance`
   */
  const avaxChainBalance$: ChainBalance$ = Rx.combineLatest([AVAX.addressUI$, avaxBalances$]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: AVAXChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  const bscBalances$ = getChainBalance$({
    chain: BSCChain,
    walletType: 'keystore',
    walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
    walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
    hdMode: 'default',
    walletBalanceType: 'all'
  })

  /**
   * Transforms AVAX data (address + `WalletBalance`) into `ChainBalance`
   */
  const bscChainBalance$: ChainBalance$ = Rx.combineLatest([BSC.addressUI$, bscBalances$]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: BSCChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * Transforms COSMOS balances into `ChainBalance`
   */
  const cosmosChainBalance$: ChainBalance$ = Rx.combineLatest([
    COSMOS.addressUI$,
    getChainBalance$({
      chain: GAIAChain,
      walletType: 'keystore',
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // walletIndex=0 (as long as we don't support HD wallets for keystore)
      hdMode: 'default',
      walletBalanceType: 'all'
    })
  ]).pipe(
    RxOp.map<[O.Option<WalletAddress>, WalletBalancesRD], ChainBalance>(([oWalletAddress, balances]) => ({
      walletType: 'keystore',
      chain: GAIAChain,
      walletAddress: addressFromOptionalWalletAddress(oWalletAddress),
      walletAccount: 0, // walletAccount=0 (as long as we don't support HD wallets for keystore)
      walletIndex: 0, // Always 0 as long as we don't support HD wallets for keystore
      balances,
      balancesType: 'all'
    }))
  )

  /**
   * Cosmos Ledger balances
   */
  const cosmosLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: GAIAChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: COSMOS.getBalanceByAddress$
  })

  /**
   * ETH Ledger balances
   */
  const ethLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: ETHChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: ETH.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * ARB Ledger balances
   */
  const arbLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: ARBChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: ARB.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * AVAX Ledger balances
   */
  const avaxLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: AVAXChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: AVAX.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * BSC Ledger balances
   */
  const bscLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: BSCChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: BSC.getBalanceByAddress$(network)
      })
    )
  )

  /**
   * List of `ChainBalances` for all available chains (order is important)
   *
   * It includes keystore + Ledger balances
   * For BTC only: Plus `confirmed` balances
   */
  const chainBalances$: ChainBalances$ = FP.pipe(
    Rx.combineLatest(
      filterEnabledChains({
        THOR: [thorChainBalance$, thorLedgerChainBalance$],
        MAYA: [mayaChainBalance$, mayaLedgerChainBalance$],
        // for BTC we store `confirmed` or `all` (confirmed + unconfirmed) balances
        BTC: [btcChainBalance$, btcChainBalanceConfirmed$, btcLedgerChainBalance$, btcLedgerChainBalanceConfirmed$],
        BCH: [bchChainBalance$, bchLedgerChainBalance$],
        DASH: [dashBalance$, dashLedgerChainBalance$],
        ETH: [ethChainBalance$, ethLedgerChainBalance$],
        ARB: [arbChainBalance$, arbLedgerChainBalance$],
        AVAX: [avaxChainBalance$, avaxLedgerChainBalance$],
        BSC: [bscChainBalance$, bscLedgerChainBalance$],
        LTC: [ltcBalance$, ltcLedgerChainBalance$],
        DOGE: [dogeChainBalance$, dogeLedgerChainBalance$],
        GAIA: [cosmosChainBalance$, cosmosLedgerChainBalance$],
        KUJI: [kujiChainBalance$, kujiLedgerChainBalance$]
      })
    ),
    // we ignore all `ChainBalances` with state of `initial` balances
    // (e.g. a not connected Ledger )
    RxOp.map(A.filter(({ balances }) => !RD.isInitial(balances))),
    RxOp.shareReplay(1)
  )

  /**
   * Transform a list of BalancesLD
   * into a "single" state of `BalancesState`
   * to provide loading / error / data states of nested `balances` in a single "state" object
   *
   * @param {BalancesStateFilter} filter Options to filter balances by `walletBalancesType`
   *
   * Note: Empty list of balances won't be included in `BalancesState`
   */
  const balancesState$: BalancesState$ = (filter) =>
    FP.pipe(
      chainBalances$,
      RxOp.map((chainBalances) => ({
        balances: FP.pipe(
          chainBalances,
          // filter balances by given `filter`
          A.filter(({ balancesType, chain }) => {
            if (isEnabledChain(chain) && filter[chain]) return balancesType === filter[chain]

            return true
          }),

          // filter results out
          // Transformation: RD<ApiError, WalletBalances>[]`-> `WalletBalances[]`
          A.filterMap(({ balances }) => RD.toOption(balances)),
          A.flatten,
          NEA.fromArray
        ),

        loading: FP.pipe(
          chainBalances,
          // get list of balances
          A.map(({ balances }) => balances),
          A.elem(eqBalancesRD)(RD.pending)
        ),
        errors: FP.pipe(
          chainBalances,
          // get list of balances
          A.map(({ balances }) => balances),
          // filter errors out
          A.filter(RD.isFailure),
          // Transformation to get Errors out of RD:
          // `RemoteData<Error, never>[]` -> `RemoteData<never, Error>[]` -> `O.some(Error)[]`
          A.map(FP.flow(RD.recover(O.some), RD.toOption)),
          // Transformation: `O.some(Error)[]` -> `O.some(Error[])`
          sequenceTOptionFromArray,
          O.chain(NEA.fromArray)
        )
      })),
      RxOp.startWith(INITIAL_BALANCES_STATE)
    )

  /**
   * Dispose references / subscriptions (if needed)
   */
  const dispose = () => {
    networkSub.unsubscribe()
    keystoreSub.unsubscribe()
    walletBalancesState.clear()
  }

  return {
    reloadBalances,
    reloadBalancesByChain,
    chainBalances$,
    balancesState$,
    dispose
  }
}
