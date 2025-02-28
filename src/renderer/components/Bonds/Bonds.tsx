import React, { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { AddressValidation } from '../../services/clients'
import { NodeInfos, NodeInfosRD } from '../../services/thorchain/types'
import { WalletAddressInfo } from '../../views/wallet/BondsView'
import { ErrorView } from '../shared/error'
import { ReloadButton } from '../uielements/button'
import * as Styled from './Bonds.styles'
import { BondsTable } from './table'

type Props = {
  nodes: NodeInfosRD
  removeNode: (node: Address) => void
  goToNode: (node: Address) => void
  goToAction: (action: string, node: string, bond: BaseAmount) => void
  network: Network
  addNode: (node: Address, network: Network) => void
  addressValidationThor: AddressValidation
  addressValidationMaya: AddressValidation
  reloadNodeInfos: FP.Lazy<void>
  className?: string
  walletAddresses: Record<'THOR' | 'MAYA', WalletAddressInfo[]>
}

export const Bonds: React.FC<Props> = ({
  addressValidationThor,
  addressValidationMaya,
  nodes: nodesRD,
  removeNode,
  goToNode,
  goToAction,
  network,
  addNode,
  reloadNodeInfos,
  walletAddresses,
  className
}) => {
  const intl = useIntl()
  const [form] = Form.useForm()
  const prevNodes = useRef<O.Option<NodeInfos>>(O.none)

  const nodes: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesRD]
  )

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      const loweredCaseValue = value.toLowerCase()
      const validAddress = loweredCaseValue.startsWith('t')
        ? addressValidationThor(loweredCaseValue)
        : addressValidationMaya(loweredCaseValue)
      if (!validAddress) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }

      if (nodes.findIndex(({ address }) => address.toLowerCase() === loweredCaseValue) > -1) {
        return Promise.reject(intl.formatMessage({ id: 'bonds.validations.nodeAlreadyAdded' }))
      }
    },
    [addressValidationMaya, addressValidationThor, intl, nodes]
  )

  const onSubmit = useCallback(
    ({ address }: { address: string }) => {
      addNode(address, network)
      form.resetFields()
    },
    [addNode, form, network]
  )

  const renderTable = useCallback(
    (nodes: NodeInfos, loading = false) => (
      <BondsTable
        className="border-b-1 mb-[25px] border-solid border-gray1 dark:border-gray1d"
        nodes={nodes}
        removeNode={removeNode}
        goToNode={goToNode}
        goToAction={goToAction}
        network={network}
        walletAddresses={walletAddresses}
        loading={loading}
      />
    ),
    [goToAction, goToNode, network, removeNode, walletAddresses]
  )

  const renderNodeInfos = useMemo(() => {
    const emptyList: NodeInfos = []
    return FP.pipe(
      nodesRD,
      RD.fold(
        () => renderTable(emptyList),
        () => {
          const data = FP.pipe(
            prevNodes.current,
            O.getOrElse(() => emptyList)
          )
          return renderTable(data, true)
        },
        (error) => (
          <ErrorView
            title={intl.formatMessage({ id: 'bonds.nodes.error' })}
            subTitle={(error.message || error.toString()).toUpperCase()}
            extra={<ReloadButton onClick={reloadNodeInfos} label={intl.formatMessage({ id: 'common.reload' })} />}
          />
        ),
        (nodes) => {
          prevNodes.current = O.some(nodes)
          return renderTable(nodes)
        }
      )
    )
  }, [intl, nodesRD, reloadNodeInfos, renderTable])

  const disableForm = useMemo(() => RD.isPending(nodesRD) || RD.isFailure(nodesRD), [nodesRD])

  return (
    <Styled.Container className={className}>
      {renderNodeInfos}
      <Styled.Form onFinish={onSubmit} form={form} disabled={disableForm}>
        <Styled.InputContainer>
          <Styled.InputLabel>{intl.formatMessage({ id: 'bonds.node.enterMessage' })}</Styled.InputLabel>
          <Form.Item name={'address'} rules={[{ required: true, validator: addressValidator }]}>
            <Styled.Input type={'text'} disabled={disableForm} />
          </Form.Item>
        </Styled.InputContainer>
        <Styled.SubmitButton htmlType={'submit'} disabled={disableForm}>
          <Styled.AddIcon /> {intl.formatMessage({ id: 'bonds.node.add' })}
        </Styled.SubmitButton>
      </Styled.Form>
    </Styled.Container>
  )
}
