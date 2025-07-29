import { WalletClient, Utils, Transaction, PushDrop, SecurityLevels, WalletProtocol, TopicBroadcaster } from '@bsv/sdk'
import { config } from '../config/appConfig'

/**
 * Token Definition
 * 
 * We will output push drop tokens which encode two things:
 * 
 * assetID amount
 * 
 * eg.
 * "7f7d0e6ecd6325b3e7fe61e2a3ddf0c7cbdc4d56a09d2c9a06694c113da2856b.0" "1000"
 * 
 * followed by a 2DROP and the locking conditions are P2PK
 * 
 * The assetID will be "mint" if we have no existing assetID, 
 * the resulting tx outpoint defines the value used in subsequent transfers.
 * 
 *  
 */

export async function mintToken() {

  // Connect to user's wallet 
  const wallet = new WalletClient('auto', 'localhost')
  const { basket, tokenProtocol } = config

  const pushdrop = new PushDrop(wallet)

  //unlock fields
  const protocolID: WalletProtocol = [SecurityLevels.Silent, tokenProtocol]
  const keyID: string = 'mint_albatross' // the public key will be the same every time we mint, so we can tell the overlay to accept mints only from us.
  const counterparty = 'self'
  const satoshis = 1

  const writer = new Utils.Writer()
  writer.writeVarIntNum(1000)
  const amountOfTokenUnits = writer.toArray()
  const method = Utils.toArray('mint', 'utf8')

  // data which will go into the token
  const fields = [method, amountOfTokenUnits]

  console.log({ fields, protocolID, keyID, counterparty })

  const lockingScript = await pushdrop.lock(fields, protocolID, keyID, counterparty)

  // The data will we need to unlock this later using pushdrop.unlockI()
  const customInstructions = JSON.stringify({
    protocolID,
    keyID,
    counterparty
  })

  // Create Action will use the signature we created above to spend the token.
  const result = await wallet.createAction({
    description: 'create some token',
    outputs: [{
        satoshis,
        lockingScript: lockingScript.toHex(),
        outputDescription: 'minted token',
        tags: ['token', 'mint'],
        customInstructions,
        basket
    }]
  })

  
  // Send the tx to your overlay.
  try {
      // Lookup a service which accepts this type of token
      const overlay = new TopicBroadcaster(['tm_my-specific-token-overlay'])
      const tx = Transaction.fromBEEF(result.tx!, result.txid!)
      const overlayResponse = await tx.broadcast(overlay)
      console.info('Overlay response:', overlayResponse)
  } catch (e) {
    console.info('Failed to send tx to overlay (tm_my-specific-token-overlay) probably does not exist yet:', e)
  }

  return `https://whatsonchain.com/tx/${result.txid}`
}

mintToken().then(console.log)