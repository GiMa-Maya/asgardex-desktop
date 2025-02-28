import { ARBChain, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AVAXChain, AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBTC, BTCChain, UPPER_FEE_BOUND as UPPER_FEE_BOUNDBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH, BCHChain, UPPER_FEE_BOUND as UPPER_FEE_BOUNDBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC, BSCChain } from '@xchainjs/xchain-bsc'
import { AssetATOM, GAIAChain } from '@xchainjs/xchain-cosmos'
import { AssetDASH, DASHChain, UPPER_FEE_BOUND as UPPER_FEE_BOUNDDASH } from '@xchainjs/xchain-dash'
import { AssetDOGE, DOGEChain, UPPER_FEE_BOUND as UPPER_FEE_BOUNDDOGE } from '@xchainjs/xchain-doge'
import { AssetETH, ETHChain } from '@xchainjs/xchain-ethereum'
import { AssetKUJI, KUJIChain } from '@xchainjs/xchain-kujira'
import { AssetLTC, LTCChain, UPPER_FEE_BOUND as UPPER_FEE_BOUNDLTC } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, Chain } from '@xchainjs/xchain-util'

import { isEnabledChain } from '../../shared/utils/chain'
import { eqChain } from './fp/eq'

// TODO (@veado) Return Maybe<Asset> instead of throwing an error
export const getChainAsset = (chain: Chain): Asset => {
  if (!isEnabledChain(chain)) throw Error(`${chain} is not supported for 'getChainAsset'`)
  switch (chain) {
    case BTCChain:
      return AssetBTC
    case ETHChain:
      return AssetETH
    case AVAXChain:
      return AssetAVAX
    case BSCChain:
      return AssetBSC
    case THORChain:
      return AssetRuneNative
    case MAYAChain:
      return AssetCacao
    case GAIAChain:
      return AssetATOM
    case BCHChain:
      return AssetBCH
    case LTCChain:
      return AssetLTC
    case DOGEChain:
      return AssetDOGE
    case DASHChain:
      return AssetDASH
    case KUJIChain:
      return AssetKUJI
    case ARBChain:
      return AssetAETH
  }
}
// TODO (@veado) Return Maybe<Asset> instead of throwing an error
export const getChainFeeBounds = (chain: Chain): number => {
  if (!isEnabledChain(chain)) throw Error(`${chain} is not supported for 'getChainAsset'`)
  switch (chain) {
    case BTCChain:
      return UPPER_FEE_BOUNDBTC
    case BCHChain:
      return UPPER_FEE_BOUNDBCH
    case LTCChain:
      return UPPER_FEE_BOUNDLTC
    case DOGEChain:
      return UPPER_FEE_BOUNDDOGE
    case DASHChain:
      return UPPER_FEE_BOUNDDASH
    default:
      return 0
  }
}

/**
 * Check whether chain is BTC chain
 */
export const isBtcChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), BTCChain)

/**
 * Check whether chain is LTC chain
 */
export const isLtcChain = (chain: Chain): boolean => eqChain.equals(chain, LTCChain)

/**
 * Check whether chain is THOR chain
 */
export const isThorChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), THORChain)

/**
 * Check whether chain is MAYA chain
 */
export const isMayaChain = (chain: Chain): boolean => eqChain.equals(chain, MAYAChain)

export const isDashChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), DASHChain)

/**
 * Check whether chain is ETH chain
 */
export const isEthChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), ETHChain)

/**
 * Check whether chain is ARB chain
 */
export const isArbChain = (chain: Chain): boolean => eqChain.equals(chain.toUpperCase(), ARBChain)

/**
 * Check whether chain is AVAX chain
 */
export const isAvaxChain = (chain: Chain): boolean => eqChain.equals(chain, AVAXChain)

/**
 * Check whether chain is BSC chain
 */
export const isBscChain = (chain: Chain): boolean => eqChain.equals(chain, BSCChain)

/**
 * Check whether chain is BCH chain
 */
export const isBchChain = (chain: Chain): boolean => eqChain.equals(chain, BCHChain)

/**
 * Check whether chain is DOGE chain
 */
export const isDogeChain = (chain: Chain): boolean => eqChain.equals(chain, DOGEChain)

/**
 * Check whether chain is KUJI chain
 */
export const isKujiChain = (chain: Chain): boolean => eqChain.equals(chain, KUJIChain)

/**
 * Check whether chain is Cosmos (GAIA) chain
 */
export const isCosmosChain = (chain: Chain): boolean => eqChain.equals(chain, GAIAChain)

type ChainValues<T> = {
  [k in Chain]?: T[]
}

export const filterEnabledChains = <T>(values: ChainValues<T>): T[] => {
  const result: T[] = []
  Object.entries(values).forEach(([chain, value]) => {
    if (isEnabledChain(chain) && value) result.push(...value)
  })

  return result
}

export const getChain = (chain: string): Chain => {
  switch (chain) {
    case 'ARB':
      return ARBChain
    case 'AVAX':
      return AVAXChain
    case 'BTC':
      return BTCChain
    case 'ETH':
      return ETHChain
    case 'THOR':
      return THORChain
    case 'GAIA':
      return GAIAChain
    case 'BCH':
      return BCHChain
    case 'LTC':
      return LTCChain
    case 'DOGE':
      return DOGEChain
    case 'BSC':
      return BSCChain
    case 'MAYA':
      return MAYAChain
    case 'DASH':
      return DASHChain
    case 'KUJI':
      return KUJIChain
    default:
      throw Error('Unknown chain')
  }
}
