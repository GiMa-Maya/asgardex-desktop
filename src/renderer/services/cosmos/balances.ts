import { AssetATOM } from '../../../shared/utils/asset'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { client$ } from './common'

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)

const resetReloadBalances = () => {
  setReloadBalances(false)
}

const reloadBalances = () => {
  setReloadBalances(true)
}

// State of balances loaded by Client
const balances$ = ({
  walletAccount,
  walletType,
  walletIndex,
  hdMode
}: {
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}): C.WalletBalancesLD =>
  C.balances$({
    client$,
    trigger$: reloadBalances$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType: 'all',
    // ATOM only - no IBC assets etc.
    assets: [AssetATOM]
  })

// State of balances loaded by Client and Address
const getBalanceByAddress$ = C.balancesByAddress$({
  client$,
  trigger$: reloadBalances$,
  walletBalanceType: 'all',
  // ATOM only - no IBC assets etc.
  assets: [AssetATOM]
})

export { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances }
