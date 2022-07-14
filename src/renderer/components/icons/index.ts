// All icons used as <MysvgIcon> components
// Note: CRA5 + webpack has some issues by importing svg properly
// Workaround: Use `file-loader` explicit for imports
// See https://github.com/facebook/create-react-app/issues/11770#issuecomment-1022024494
/* eslint-disable import/no-webpack-loader-syntax */
import atomIcon from '!file-loader!../../assets/svg/asset-atom.svg'
import bnbRuneIcon from '!file-loader!../../assets/svg/asset-bnb-rune.svg'
import bnbIcon from '!file-loader!../../assets/svg/asset-bnb.svg'
import btcIcon from '!file-loader!../../assets/svg/asset-btc.svg'
import ethIcon from '!file-loader!../../assets/svg/asset-eth.svg'
import lunaIcon from '!file-loader!../../assets/svg/asset-luna.svg'
import runeIcon from '!file-loader!../../assets/svg/asset-rune.svg'
import ustIcon from '!file-loader!../../assets/svg/asset-ust.svg'
import xRuneIcon from '!file-loader!../../assets/svg/asset-xrune.svg'
import terraIcon from '!file-loader!../../assets/svg/terra.svg'
import dogeIcon from '../../assets/png/asset-doge.png'
import tgtIcon from '../../assets/png/asset-tgt.png'
import { ReactComponent as CurrencyIcon } from '../../assets/svg/currency-icon.svg'
import { ReactComponent as AttentionIcon } from '../../assets/svg/icon-attention.svg'
import { ReactComponent as DownIcon } from '../../assets/svg/icon-down.svg'
import { ReactComponent as LedgerIcon } from '../../assets/svg/ledger.svg'

export {
  atomIcon,
  bnbIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  lunaIcon,
  terraIcon,
  runeIcon,
  ustIcon,
  bnbRuneIcon,
  xRuneIcon,
  tgtIcon,
  CurrencyIcon,
  DownIcon,
  LedgerIcon,
  AttentionIcon
}
