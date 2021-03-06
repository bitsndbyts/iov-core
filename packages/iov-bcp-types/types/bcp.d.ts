import { Stream } from "xstream";
import { ChainId, PostableBytes, PublicKeyBundle, TxId } from "@iov/base-types";
import { ValueAndUpdates } from "@iov/stream";
import { Address, SignedTransaction, TxCodec } from "./signables";
import { Amount, Nonce, TokenTicker, UnsignedTransaction } from "./transactions";
export interface BcpQueryEnvelope<T> {
    readonly metadata: BcpQueryMetadata;
    readonly data: ReadonlyArray<T>;
}
export declare function dummyEnvelope<T>(data: ReadonlyArray<T>): BcpQueryEnvelope<T>;
export interface BcpQueryMetadata {
    readonly offset: number;
    readonly limit: number;
}
export interface BcpCoin extends BcpTicker, Amount {
}
export interface BcpAccount {
    readonly address: Address;
    readonly name?: string;
    readonly balance: ReadonlyArray<BcpCoin>;
}
export interface BcpTicker {
    readonly tokenTicker: TokenTicker;
    /**
     * A name to be displayed to the user which allows differentiation
     * of multiple tokens that use the same ticker.
     *
     * For example "Holo (HOT)" and "Hydro Protocol (HOT)" get the token
     * names and "Holo" and "Hydro Protocol".
     */
    readonly tokenName: string;
}
export declare enum BcpTransactionState {
    /** accepted by a blockchain node and in mempool */
    Pending = 0,
    /** successfully written in a block, but cannot yet guarantee it won't be reverted */
    InBlock = 1
}
/** Information attached to a signature about its state in a block */
export declare type BcpBlockInfo = {
    readonly state: BcpTransactionState.Pending;
} | {
    readonly state: BcpTransactionState.InBlock;
    /** block height, if the transaction is included in a block */
    readonly height: number;
    /** depth of the transaction's block, starting at 1 as soon as transaction is in a block */
    readonly confirmations: number;
};
export interface BcpTransactionResponse {
    /** @deprecated use blockInfo instead */
    readonly metadata: {
        readonly height?: number;
    };
    /** Information about the block the transaction is in */
    readonly blockInfo: ValueAndUpdates<BcpBlockInfo>;
    readonly data: {
        readonly message: string;
        readonly txid: TxId;
        readonly result: Uint8Array;
    };
}
export interface ConfirmedTransaction<T extends UnsignedTransaction = UnsignedTransaction> extends SignedTransaction<T> {
    readonly height: number;
    /** depth of the transaction's block, starting at 1 as soon as transaction is in a block */
    readonly confirmations: number;
    readonly txid: TxId;
    /** Data from executing tx (result, code, tags...) */
    readonly result?: Uint8Array;
    readonly log?: string;
}
export interface BcpQueryTag {
    readonly key: string;
    readonly value: string;
}
export interface BcpTxQuery {
    readonly tags: ReadonlyArray<BcpQueryTag>;
    readonly hash?: TxId;
    readonly height?: number;
    readonly minHeight?: number;
    readonly maxHeight?: number;
}
export interface BcpAddressQuery {
    readonly address: Address;
}
export interface BcpValueNameQuery {
    readonly name: string;
}
export interface BcpPubkeyQuery {
    readonly pubkey: PublicKeyBundle;
}
export declare type BcpAccountQuery = BcpAddressQuery | BcpPubkeyQuery | BcpValueNameQuery;
export declare function isAddressQuery(query: BcpAccountQuery): query is BcpAddressQuery;
export declare function isPubkeyQuery(query: BcpAccountQuery): query is BcpPubkeyQuery;
export declare function isValueNameQuery(query: BcpAccountQuery): query is BcpValueNameQuery;
export interface BcpConnection {
    readonly disconnect: () => void;
    readonly chainId: () => ChainId;
    readonly height: () => Promise<number>;
    readonly changeBlock: () => Stream<number>;
    readonly postTx: (tx: PostableBytes) => Promise<BcpTransactionResponse>;
    readonly getTicker: (ticker: TokenTicker) => Promise<BcpQueryEnvelope<BcpTicker>>;
    readonly getAllTickers: () => Promise<BcpQueryEnvelope<BcpTicker>>;
    /**
     * Get the current account information (e.g. balance)
     *
     * If an account is not found on the blockchain, an envelope with an empty data array is returned
     */
    readonly getAccount: (account: BcpAccountQuery) => Promise<BcpQueryEnvelope<BcpAccount>>;
    readonly getNonce: (query: BcpAddressQuery | BcpPubkeyQuery) => Promise<BcpQueryEnvelope<Nonce>>;
    readonly watchAccount: (account: BcpAccountQuery) => Stream<BcpAccount | undefined>;
    readonly watchNonce: (query: BcpAddressQuery | BcpPubkeyQuery) => Stream<Nonce | undefined>;
    readonly searchTx: (query: BcpTxQuery) => Promise<ReadonlyArray<ConfirmedTransaction>>;
    readonly listenTx: (tags: ReadonlyArray<BcpQueryTag>) => Stream<ConfirmedTransaction>;
    readonly liveTx: (txQuery: BcpTxQuery) => Stream<ConfirmedTransaction>;
}
export interface ChainConnector {
    readonly client: () => Promise<BcpConnection>;
    readonly codec: TxCodec;
    readonly expectedChainId?: ChainId;
}
