import { WalletClient, Utils, PushDrop, LockingScript } from '@bsv/sdk'
import { config } from '../config/appConfig'

const { basket } = config

export async function balance() {

  // Connect to user's wallet 
  const wallet = new WalletClient('auto', 'localhost')
  
  // 5. Confirm wallet sees the token
  const list = await wallet.listOutputs({ basket, include: 'locking scripts' })
  console.log(`Wallet outputs in basket "${basket}":`, list.outputs.length)

  let total = 0

  for (const output of list.outputs) {
    const { fields } = PushDrop.decode(LockingScript.fromHex(output.lockingScript!))
    const reader = new Utils.Reader(fields[1])
    const amount = reader.readVarIntNum()
    const assetId = Utils.toUTF8(fields[0])
    console.log('assetID:', assetId, 'amount:', amount)
    total += amount
  }

  return `Total balance: ${total}`
}

balance().then(console.log)