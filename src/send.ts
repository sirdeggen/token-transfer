import { WalletClient, Utils, Script, PushDrop, SecurityLevels, WalletProtocol, Transaction, TopicBroadcaster } from '@bsv/sdk'
import { MessageBoxClient } from '@bsv/message-box-client'
import { config } from '../config/appConfig'


export async function spendToken(recipient : string, tokensToSend : number) {

  // Connect to user's wallet 
  const wallet = new WalletClient('auto', 'localhost')
  const { basket, tokenProtocol } = config
  const { publicKey: senderIdentity } = await wallet.getPublicKey({
    identityKey: true,
  })

  // List the spendable tokens within this user's basket
  const list = await wallet.listOutputs({
      basket,
      include: 'entire transactions',
      includeCustomInstructions: true
  })
  if (!list.BEEF) throw new Error('BEEF data is undefined. Cannot create source transaction.')

  // this is the outpoint we will spend in this new transaction
  const [txid, vout] = list.outputs[0].outpoint.split('.')
  const sourceTransaction = Transaction.fromBEEF(list.BEEF, txid)
  const { fields } = PushDrop.decode(sourceTransaction.outputs[vout].lockingScript)

  // This is a script template which can be used to generate locking and unlocking scripts of this type.
  const pushdrop = new PushDrop(wallet)

  // define the input
  const customInstructions = JSON.parse(list.outputs[0].customInstructions!)
  const { 
    protocolID, 
    keyID, 
    counterparty,
  } = customInstructions
  const unlockingTemplate = pushdrop.unlock(protocolID, keyID, counterparty, 'all', false, 1)
  const unlockingScriptLength = await unlockingTemplate.estimateLength()


  // define the output to send to the recipient
  const newKeyID = new Date().toISOString()
  const paymentCustomInstructions = JSON.stringify({
    keyID: newKeyID,
    protocolID,
    counterparty: senderIdentity
  })

  // define the change we'll send back to ourselves
  const changeCustomInstructions = JSON.stringify({
    keyID: newKeyID,
    protocolID,
    counterparty: 'self'
  })

  // calculate change
  const reader = new Utils.Reader(fields[1])
  const amountOfTokensIn = reader.readVarIntNum()
  const changeTokens = amountOfTokensIn - tokensToSend

  // create new fields
  let assetId: string
  const field0 = Utils.toUTF8(fields[0])
  if (field0 === 'mint') {
    // if we're spending a token we just minted, then the assetId is the mint outpoint
    assetId = list.outputs[0].outpoint
  } else {
    // otherwise it's the first data push (still refers to a prior mint outpoint)
    assetId = field0
  }

  // we write the amount of tokens for sending and change as VarInts
  const w = new Utils.Writer()
  w.writeVarIntNum(tokensToSend)
  const paymentAmount = w.toArray()
  const w2 = new Utils.Writer()
  w2.writeVarIntNum(changeTokens)
  const changeAmount = w2.toArray()

  const paymentFields = [Utils.toArray(assetId, 'utf8'), paymentAmount]
  const paymentLockingScript = await pushdrop.lock(paymentFields, protocolID, newKeyID, recipient)
  
  const changeFields = [Utils.toArray(assetId, 'utf8'), changeAmount]
  const changeLockingScript = await pushdrop.lock(changeFields, protocolID, newKeyID, 'self')


  // We ask for a transaction to be created by Wallet Storage which spends the original token,
  // and outputs the payment and change to the recipient and ourselves respectively.
  const result = await wallet.createAction({
    description: 'send some token to someone else, keep the change',
    inputBEEF: list.BEEF,
    inputs: [{
      outpoint: list.outputs[0].outpoint,
      unlockingScriptLength,
      inputDescription: 'spend existing token'
    }],
    outputs: [{
      satoshis: 1,
      lockingScript: paymentLockingScript.toHex(),
      outputDescription: 'transfered token',
      tags: ['file', 'token'],
      customInstructions: paymentCustomInstructions
    },
    {
      satoshis: 1,
      lockingScript: changeLockingScript.toHex(),
      outputDescription: 'token change',
      tags: ['file', 'token'],
      customInstructions: changeCustomInstructions
    }],
    options: {
      noSend: true, // return a signableTransaction, don't try to broadcast yet.
      randomizeOutputs: false,
    }
  })

  console.log(result?.signableTransaction?.reference) // use this to abortAction if necessary.

  console.log(result)

  const tx = Transaction.fromBEEF(result.signableTransaction!.tx!)

  let ourInputIndex = 0
  tx.inputs.map((input, vin) => {
    if (input.sourceTXID === txid && input.sourceOutputIndex === Number(vout)) {
      ourInputIndex = vin
    }
  })
  tx.inputs[ourInputIndex].unlockingScriptTemplate = unlockingTemplate

  await tx.sign()

  const spent = await wallet.signAction({
    reference: result.signableTransaction!.reference!,
    spends: {
      [ourInputIndex]: {
        unlockingScript: tx.inputs[ourInputIndex].unlockingScript?.toHex()!,
      }
    },
  })

  console.log('✅ Token sent in tx:', spent.txid)

  const txSent = Transaction.fromBEEF(spent.tx!, spent.txid!)
  const broadcast = await txSent.broadcast()
  console.log(txSent.toHex())

  // Lookup a service which accepts this type of token
  
  // Send the tx to that overlay.

  //Send to MessageBox
  const mb = new MessageBoxClient({
    walletClient: wallet,
    host: 'https://message-box-us-1.bsvb.tech'
  })

  const notify = await mb.sendMessage({
    recipient,
    messageBox: 'token_inbox',
    body: JSON.stringify({
      tx: spent.tx,
      outputIndex: 0,
      txid: spent.txid,
      customInstructions: paymentCustomInstructions,
    })
  }, 'https://message-box-us-1.bsvb.tech')
  
  console.log('📬 MessageBox delivery status:', notify.status)
  console.log('Key ID: ', keyID)

  return spent
}

// Default '02ec9b58db65002d0971c3abe2eef3403d23602d8de2af51445d84e1b64c11a646'
// Goose profile: '028656505ffad07975a839a4cdf13c71318e5e7dd0e98db485137f249d9afddeff'
// set the below to your recipient's public key, say your own alt profile on Metanet Mobile or whatever.

// Get recipient public key and amount from command line arguments
const recipientPubKey = process.argv[2]
const amountStr = process.argv[3]

if (!recipientPubKey || !amountStr) {
  console.error('❌ Error: Please provide both recipient public key and amount as arguments')
  console.log('Usage: npx tsx src/send.ts <recipient_public_key> <amount>')
  console.log('Example: npx tsx src/send.ts 028656505ffad07975a839a4cdf13c71318e5e7dd0e98db485137f249d9afddeff 123')
  process.exit(1)
}

// Validate public key format (should be 66 characters hex string starting with 02 or 03)
if (!/^0[23][0-9a-fA-F]{64}$/.test(recipientPubKey)) {
  console.error('❌ Error: Invalid public key format')
  console.log('Public key should be a 66-character hex string starting with 02 or 03')
  process.exit(1)
}

// Validate and parse amount
const amount = parseInt(amountStr, 10)
if (isNaN(amount) || amount <= 0) {
  console.error('❌ Error: Invalid amount. Please provide a positive integer')
  console.log('Example: npx tsx src/send.ts 028656505ffad07975a839a4cdf13c71318e5e7dd0e98db485137f249d9afddeff 123')
  process.exit(1)
}

console.log(`🎯 Sending ${amount} tokens to: ${recipientPubKey}`)
spendToken(recipientPubKey, amount).then(console.log)