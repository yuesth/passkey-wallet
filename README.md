# Passkey Wallet API

Passkey wallet is API for signing a new wallet key using [https://github.com/near/near-api-js/tree/master/packages/biometric-ed25519](near-js/biometric-ed25519).
Here is some available chain that we've integrated:
  1. Stellar - https://github.com/yuesth/passkey-wallet/tree/main/apps/stellar

In the further, we will integrate more chains.

## Getting Started
The package is using monorepo pattern to provide more chains. The easiest way to implement this package is installing sub-packages for specific usage, instead of installing whole package.
### 1. Install the package from NPM registry and use your own package manager.
#### Yarn
```
yarn add @yuesth/passkey-wallet-stellar
```

#### Npm
```
npm install @yuesth/passkey-wallet-stellar
```

### 2. Create instance
You have to create an instance from the package.
```jsx
import PasskeyWallet from '@yuesth/passkey-wallet-stellar'
...

//the private key must be provided in order to create new wallet on stellar ledger
const instance = new PasskeyWallet('testnet', <YOUR_PARENT_PRIVATE_KEY>, <RANDOM_PHRASE>, 5)
```

### 3. Create key
After you create an instance, you are able to call `createFromCreatingPasskey()` method to use simplest key creation from biometric passkey.
```jsx
...
const onClickButton = async () => {
//the private key must be provided in order to create new wallet on stellar ledger
const instance = new PasskeyWallet('testnet', <YOUR_PARENT_PRIVATE_KEY>, <RANDOM_PHRASE>, 5)
await wallet.createFromCreatingPasskey()
}

return(
  <button onClick={onClickButton}>Create a key</button>
)
```

or if you are confident that you already have created a key, then you can call the `createFromExistingPasskey()` method.
```jsx
...
const onClickButton = async () => {
//the private key must be provided in order to create new wallet on stellar ledger
const instance = new PasskeyWallet('testnet', <YOUR_PARENT_PRIVATE_KEY>, <RANDOM_PHRASE>, 5)
await wallet.createFromExistingPasskey()
}

return(
  <button onClick={onClickButton}>Get a key</button>
)
```

## API
1. `finalPublicKey` --> to retrieve the public key after creating or getting the key.
2. `keyPair` --> retrieve keyPair creating or getting the key.
3. `createAccountStellarLedger(childPubKey: string)` --> method for upload the new key to stellar ledger
