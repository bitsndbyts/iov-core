// libsodium.js API: https://gist.github.com/webmaster128/b2dbe6d54d36dd168c9fabf441b9b09c

// use require instead of import because of this bug
// https://github.com/jedisct1/libsodium.js/issues/148
import sodium = require("libsodium-wrappers");

import shajs from 'sha.js';

interface Keypair {
  readonly pubkey: Uint8Array,
  readonly privkey: Uint8Array,
}

export class Ed25519 {
  public static async generateKeypair(): Promise<Keypair> {
    await sodium.ready;
    const keypair = sodium.crypto_sign_keypair();
    return {
      pubkey: keypair.publicKey,
      privkey: keypair.privateKey
    }
  }

  public static async createSignature(message: Uint8Array, privkey: Uint8Array): Promise<Uint8Array> {
    await sodium.ready;
    return sodium.crypto_sign_detached(message, privkey);
  }

  public static async verifySignature(signature: Uint8Array, message: Uint8Array, pubkey: Uint8Array): Promise<boolean> {
    await sodium.ready;
    return sodium.crypto_sign_verify_detached(signature, message, pubkey);
  }
}

export class Sha256 {
  // async interface to support implementations that rely on WebAssemby compilation later on
  public static digest(data: Uint8Array): Promise<Uint8Array> {
    const hasher = shajs('sha256');
    hasher.update(data);
    return Promise.resolve(hasher.digest());
  }
}
