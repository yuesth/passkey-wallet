import { createKey, getKeys } from "@near-js/biometric-ed25519";
import {
  Horizon,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Operation,
} from "@stellar/stellar-sdk";
import axios from "axios";
// @ts-ignore
import seed from "random-bytes-seed";

export type TNetworkEnv = "mainnet" | "testnet";

export interface WalletStellarProps {
  env: TNetworkEnv;
  parentSecretKey: string;
  defaultPhrase?: string;
  startingBalance?: number;
}

class WalletStellar {
  private env: TNetworkEnv;
  private parentSecretKey: string;
  private phrase: string;
  private startingBalance: string;
  keyPair?: Keypair;
  finalPublicKey: string = "";

  constructor(
    env: TNetworkEnv,
    parentSecretKey: string,
    defaultPhrase: string = "stellar_phrase",
    startingBalance: number = 5,
  ) {
    this.env = env;
    this.parentSecretKey = parentSecretKey;
    this.phrase = defaultPhrase;
    this.startingBalance = `${startingBalance}`;
  }

  async getPassKeyKeypair(phrase: string = this.phrase) {
    const keys = await getKeys(phrase);
    return [keys[0], keys[1]];
  }

  async createPassKeyKeypair(phrase: string = this.phrase) {
    const key = await createKey(phrase);
    return key;
  }

  async checkOnStellarLedger(publicKey: string) {
    try {
      const res = await axios.get(
        this.env === "testnet"
          ? `https://horizon-testnet.stellar.org/accounts/${publicKey}`
          : "",
      );
      return res.data;
    } catch (error) {
      return "noExist";
    }
  }

  parseToStellar(passkeyPublicKey: string = this.phrase) {
    const randomBytes = seed(passkeyPublicKey);
    const keypair = Keypair.fromRawEd25519Seed(Buffer.from(randomBytes(32)));
    this.keyPair = keypair;
    const pubKey = keypair.publicKey();
    return { keypair, publicKey: pubKey };
  }

  createAccountStellarLedger = async (childPubKey: string) => {
    const SECRET_PARENT_ACCOUNT = this.parentSecretKey;
    const PUB_PARENT_ACCOUNT = Keypair.fromSecret(
      SECRET_PARENT_ACCOUNT,
    ).publicKey();
    const parentKeyPair = Keypair.fromSecret(SECRET_PARENT_ACCOUNT);
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    let parentAccount = await server.loadAccount(PUB_PARENT_ACCOUNT);
    let createAccountTx = new TransactionBuilder(parentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    });
    const builtCreateAccountTx = await createAccountTx
      .addOperation(
        Operation.createAccount({
          destination: childPubKey,
          startingBalance: this.startingBalance,
        }),
      )
      .setTimeout(180)
      .build();
    await builtCreateAccountTx.sign(parentKeyPair);
    let txResponse = await server.submitTransaction(builtCreateAccountTx);
    return txResponse;
  };

  async faucetFriendbot(pubKey: string) {
    try {
      const response = await axios.get(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(pubKey)}`,
      );
      console.log("SUCCESS! You have a new account :)\n", response.data);
    } catch (e) {
      console.error("ERROR!", e);
    }
  }

  async createFromExistingPasskey({
    phrase,
    onAfterRetrieved,
    useFriendbot = false,
  }: {
    phrase?: string;
    onAfterRetrieved?: (keyPair: Keypair, publicKey: string) => Promise<void>;
    useFriendbot?: boolean;
  }) {
    const passKeyKaypairs = await this.getPassKeyKeypair(phrase);
    const stellarRes = passKeyKaypairs.map((key) =>
      this.parseToStellar(key.getPublicKey().toString()),
    );
    const ledgerStellarRes = await Promise.all(
      stellarRes.map((_key) => this.checkOnStellarLedger(_key.publicKey)),
    );
    //check if all of stellar publicKey doesn't exist on ledger, it will create passkey publicKey and set the final keypair
    if (ledgerStellarRes.every((key) => key === "noExist")) {
      const createdKeypair = await this.createPassKeyKeypair();
      const createdPubKey = createdKeypair.getPublicKey().toString();
      const stellarRes = this.parseToStellar(createdPubKey);
      useFriendbot
        ? await this.faucetFriendbot(stellarRes.publicKey)
        : await this.createAccountStellarLedger(stellarRes.publicKey);
      this.finalPublicKey = stellarRes.publicKey;
      await onAfterRetrieved?.(stellarRes.keypair, stellarRes.publicKey);
    }
    //otherwise, it used from existed public key on stellar ledger
    else {
      const existedRes = ledgerStellarRes.filter((key) => key !== "noExist")[0];
      const stellarPubKey = existedRes.account_id;
      const _keypair = stellarRes.filter(
        (res) => res.publicKey === existedRes.account_id,
      )[0];
      this.keyPair = _keypair?.keypair;
      this.finalPublicKey = stellarPubKey;
      await onAfterRetrieved?.(_keypair?.keypair as Keypair, stellarPubKey);
    }
  }

  async createFromCreatingPasskey({
    phrase,
    onAfterCreated,
    useFriendbot = false,
  }: {
    phrase?: string;
    onAfterCreated?: (keyPair: Keypair, publicKey: string) => Promise<void>;
    useFriendbot?: boolean;
  }) {
    const createdKeypair = await this.createPassKeyKeypair(phrase);
    const createdPublicKey = createdKeypair.getPublicKey().toString();
    const { publicKey, keypair } = this.parseToStellar(createdPublicKey);
    useFriendbot
      ? await this.faucetFriendbot(publicKey)
      : await this.createAccountStellarLedger(publicKey);
    this.keyPair = keypair;
    this.finalPublicKey = publicKey;
    await onAfterCreated?.(keypair, publicKey);
  }
}

export default WalletStellar;
