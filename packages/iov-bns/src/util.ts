import Long from "long";
import { As } from "type-tagger";

import { Algorithm, ChainId, PublicKeyBundle } from "@iov/base-types";
import {
  Address,
  BcpTxQuery,
  ConfirmedTransaction,
  Nonce,
  SignableBytes,
  SwapClaimTx,
  SwapCounterTx,
  SwapTimeoutTx,
  TransactionKind,
} from "@iov/bcp-types";
import { Sha256 } from "@iov/crypto";
import { Bech32, Encoding } from "@iov/encoding";
import { QueryString } from "@iov/tendermint-rpc";

/** Encodes raw bytes into a bech32 address */
export function encodeBnsAddress(bytes: Uint8Array): Address {
  return Bech32.encode("tiov", bytes) as Address;
}

/** Decodes a printable address into bech32 object */
export function decodeBnsAddress(address: Address): { readonly prefix: string; readonly data: Uint8Array } {
  return Bech32.decode(address);
}

function algoToPrefix(algo: Algorithm): Uint8Array {
  switch (algo) {
    case Algorithm.Ed25519:
      return Encoding.toAscii("sigs/ed25519/");
    case Algorithm.Secp256k1:
      return Encoding.toAscii("sigs/secp256k1/");
    default:
      throw new Error("Unsupported algorithm: " + algo);
  }
}

function keyToIdentifier(key: PublicKeyBundle): Uint8Array {
  return Uint8Array.from([...algoToPrefix(key.algo), ...key.data]);
}

export function keyToAddress(key: PublicKeyBundle): Address {
  const bytes = new Sha256(keyToIdentifier(key)).digest().slice(0, 20);
  return encodeBnsAddress(bytes);
}

export function isValidAddress(address: string): boolean {
  try {
    decodeBnsAddress(address as Address);
    return true;
  } catch {
    return false;
  }
}

const signCodev1: Uint8Array = Uint8Array.from([0, 0xca, 0xfe, 0]);

// append chainID and nonce to the raw tx bytes to prepare for signing
export const appendSignBytes = (bz: Uint8Array, chainId: ChainId, nonce: Nonce) => {
  if (chainId.length > 255) {
    throw new Error("chainId must not exceed a length of 255 characters");
  }
  return Uint8Array.from([
    ...signCodev1,
    chainId.length,
    ...Encoding.toAscii(chainId),
    ...Long.fromNumber(nonce.toNumber()).toBytesBE(),
    ...bz,
  ]) as SignableBytes;
};

// tendermint hash (will be) first 20 bytes of sha256
// probably only works after 0.21, but no need to import ripemd160 now
export const tendermintHash = (data: Uint8Array) => new Sha256(data).digest().slice(0, 20);

export const arraysEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((n: number, i: number): boolean => n === b[i]);

// we use this type to differentiate between a raw hash of the data and the id used internally in weave
export type HashId = Uint8Array & As<"hashid">;

export const hashId = Encoding.toAscii("hash/sha256/");
export const preimageIdentifier = (data: Uint8Array): HashId => hashIdentifier(new Sha256(data).digest());
export const hashIdentifier = (hash: Uint8Array): HashId => Uint8Array.from([...hashId, ...hash]) as HashId;

export const isHashIdentifier = (ident: Uint8Array): ident is HashId =>
  arraysEqual(hashId, ident.slice(0, hashId.length));
export const hashFromIdentifier = (ident: HashId): Uint8Array => ident.slice(hashId.length);

// calculate keys for query tags
export const bucketKey = (bucket: string) => Encoding.toAscii(`${bucket}:`);
export const indexKey = (bucket: string, index: string) => Encoding.toAscii(`_i.${bucket}_${index}:`);

export function isSwapOffer(tx: ConfirmedTransaction): tx is ConfirmedTransaction<SwapCounterTx> {
  return tx.transaction.kind === TransactionKind.SwapCounter;
}

export function isSwapRelease(
  tx: ConfirmedTransaction,
): tx is ConfirmedTransaction<SwapClaimTx | SwapTimeoutTx> {
  return (
    tx.transaction.kind === TransactionKind.SwapClaim || tx.transaction.kind === TransactionKind.SwapTimeout
  );
}

export function buildTxQuery(query: BcpTxQuery): QueryString {
  const tags: ReadonlyArray<string> = query.tags.map(tag => `${tag.key}='${tag.value}'`);
  const opts: ReadonlyArray<string | false> = [
    !!query.height && `tx.height=${query.height}`,
    !!query.minHeight && `tx.height>${query.minHeight}`,
    !!query.maxHeight && `tx.height<${query.maxHeight}`,
    !!query.hash && `tx.hash='${Encoding.toHex(query.hash)}'`,
  ];
  const result: string = [...tags, ...opts.filter(x => !!x)].join(" AND ");
  return result as QueryString;
}
