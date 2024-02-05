import { createKey, getKeys } from "@near-js/biometric-ed25519";
import { Horizon, Keypair, TransactionBuilder, BASE_FEE, Networks, Operation } from "@stellar/stellar-sdk";
import axios from "axios";
// @ts-ignore
import seed from "random-bytes-seed"

export type TNetworkEnv = 'mainnet' | 'testnet'

export interface WalletStellarProps {
  env: TNetworkEnv
  parentSecretKey: string
  phrase?: string
  startingBalance?: number
}

class WalletStellar {
  private env: TNetworkEnv
  private parentSecretKey: string
  private phrase: string
  private startingBalance: string
  keyPair?: Keypair
  finalPublicKey: string = ''

  constructor(env: TNetworkEnv, parentSecretKey: string, phrase: string = 'stellar_phrase', startingBalance: number = 5) {
		this.env = env
		this.parentSecretKey = parentSecretKey
    this.phrase = phrase
    this.startingBalance = `${startingBalance}`
	}

  async getPassKeyKeypair(){
    const keys = await getKeys(this.phrase)
    return [keys[0], keys[1]]
  }

  async createPassKeyKeypair(){
    const key = await createKey(this.phrase)
    return key
  }

  async checkOnStellarLedger(publicKey:string){
    try{
      const res = await axios.get(this.env === 'testnet' ? `https://horizon-testnet.stellar.org/accounts/${publicKey}` : '')
      return res.data
    }catch(error){
      return 'noExist'
    }
  }

  parseToStellar(passkeyPublicKey: string = this.phrase){
    const randomBytes = seed(passkeyPublicKey);
    const keypair = Keypair.fromRawEd25519Seed(Buffer.from(randomBytes(32)));
    this.keyPair = keypair
    const pubKey = keypair.publicKey()
    return {keypair, publicKey: pubKey}  
  }

  createAccountStellarLedger = async(childPubKey: string)=>{
    const SECRET_PARENT_ACCOUNT = this.parentSecretKey
    const PUB_PARENT_ACCOUNT = Keypair.fromSecret(SECRET_PARENT_ACCOUNT).publicKey()
    const parentKeyPair = Keypair.fromSecret(SECRET_PARENT_ACCOUNT)
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    let parentAccount = await server.loadAccount(PUB_PARENT_ACCOUNT)
    let createAccountTx = new TransactionBuilder(parentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
    const builtCreateAccountTx = await createAccountTx
    .addOperation(
      Operation.createAccount({
        destination: childPubKey,
        startingBalance: this.startingBalance,
      }),
    )
    .setTimeout(180)
    .build()
    await builtCreateAccountTx.sign(parentKeyPair)
    let txResponse = await server
    .submitTransaction(builtCreateAccountTx)
    return txResponse
  }

  async createFromExistingPasskey({onAfterRetrieved}:{onAfterRetrieved: (keyPair: Keypair, publicKey: string)=> Promise<void>}){
    const passKeyKaypairs = await this.getPassKeyKeypair()
    const stellarRes = passKeyKaypairs.map(key => this.parseToStellar(key.getPublicKey().toString()))
    const ledgerStellarRes = await Promise.all(stellarRes.map(_key => this.checkOnStellarLedger(_key.publicKey)))
    //check if all of stellar publicKey doesn't exist on ledger, it will create passkey publicKey and set the final keypair
    if(ledgerStellarRes.every(key => key === 'noExist')){
      const createdKeypair = await this.createPassKeyKeypair()
      const createdPubKey = createdKeypair.getPublicKey().toString()
      const stellarRes = this.parseToStellar(createdPubKey)
      await this.createAccountStellarLedger(stellarRes.publicKey)
      this.finalPublicKey = stellarRes.publicKey
    }
    //otherwise, it used from existed public key on stellar ledger
    else{
      const existedRes = ledgerStellarRes.filter(key => key !== 'noExist')[0]
      const stellarPubKey = existedRes.account_id
      const _keypair = Keypair.fromPublicKey(existedRes.account_id)
      this.keyPair = _keypair
      this.finalPublicKey = stellarPubKey
      await onAfterRetrieved(_keypair, stellarPubKey)
    }
  }
  
  async createFromCreatingPasskey({onAfterCreated}:{onAfterCreated: (keyPair: Keypair, publicKey: string)=> Promise<void>}){
    const createdKeypair = await this.createPassKeyKeypair()
    const createdPublicKey = createdKeypair.getPublicKey().toString()
    const {publicKey, keypair} = this.parseToStellar(createdPublicKey)
    this.keyPair = keypair
    this.finalPublicKey = publicKey
    await onAfterCreated(keypair, publicKey)
  }

}

export default WalletStellar