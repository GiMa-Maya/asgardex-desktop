import { useCallback, useEffect } from 'react'

import { XChainClient } from '@xchainjs/xchain-client'
import { Address, Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { useChainContext } from '../contexts/ChainContext'
import { eqChain } from '../helpers/fp/eq'
import { AddressValidation, AddressValidationAsync } from '../services/clients'

export const useValidateAddress = (
  chain: Chain
): { validateAddress: AddressValidation; validateSwapAddress: AddressValidationAsync } => {
  const { clientByChain$ } = useChainContext()
  const [oClient, chainUpdated] = useObservableState<O.Option<XChainClient>, Chain>(
    (chain$) =>
      FP.pipe(
        chain$,
        RxOp.distinctUntilChanged(eqChain.equals) /* compare prev./current value - just for performance reason */,
        RxOp.switchMap(clientByChain$)
      ),
    O.none
  )

  // `chainUpdated` needs to be called whenever chain has been updated
  // to trigger `useObservableState` properly to get a client depending on chain
  useEffect(() => chainUpdated(chain), [chain, chainUpdated])

  const validateAddress = useCallback(
    (address: Address) =>
      FP.pipe(
        oClient,
        O.map((client) => client.validateAddress(address)),
        // In case client is not available (it should never happen), skip validation by returning always `true`
        O.getOrElse<boolean>(() => true)
      ),
    [oClient]
  )
  const validateSwapAddress = useCallback(
    async (address: Address) =>
      FP.pipe(
        oClient,
        O.map(async (client) => {
          return client.validateAddress(address)
        }),
        // In case client is not available (it should never happen), skip validation by returning always `true`
        O.getOrElse<Promise<boolean>>(() => Promise.resolve(true))
      ),
    [oClient]
  )

  return { validateAddress, validateSwapAddress }
}
