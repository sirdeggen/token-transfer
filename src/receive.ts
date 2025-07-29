import { WalletClient, Utils, Script, PushDrop, SecurityLevels, WalletProtocol, Transaction, TopicBroadcaster } from '@bsv/sdk'
import { MessageBoxClient } from '@bsv/message-box-client'
import { config } from '../config/appConfig';

const basket = config.basket 

;(async () => {
  // 1. Connect to local wallet
  const wallet = new WalletClient('auto', 'localhost')

  // 2. Connect to MessageBox
  const mb = new MessageBoxClient({
    walletClient: wallet,
    host: 'https://message-box-us-1.bsvb.tech'
  })

  // 3. Fetch latest message
  const mbList = await mb.listMessages({
    messageBox: 'token_inbox',
    host: 'https://message-box-us-1.bsvb.tech'
  })

  if (!mbList.length) {
    console.error('❌ No messages found')
    process.exit(1)
  }

  const msg = mbList[0]
  const parsedBody = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body
  const {tx, txid, outputIndex, customInstructions } = parsedBody

  console.log('[1] Got token transfer message:', { txid, outputIndex, customInstructions })
  console.log('[debug] raw MessageBox body:', msg.body)


    // 4. Internalize token into basket
    const internalizeResult = await wallet.internalizeAction({
      tx,
      description: 'Received file token',
      labels: ['received', 'file', 'token'],
      outputs: [{
        outputIndex,
        protocol: 'basket insertion',
        insertionRemittance: {
          basket,  // ✅ Must match basket in send.ts
          customInstructions
        }
      }]
    })

  console.log('[2] Internalized token.', internalizeResult)

  await mb.acknowledgeMessage({ messageIds: [msg.messageId] })

})()