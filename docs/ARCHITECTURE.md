# Architecture

This is a fundamental question of how we want to organize the apps
that needs to be clarified to proceed on the design of the key management.

## Stream State Changes to UI (listener)

Simplest is a bunch of functions that do stuff (add accounts, save
accounts, unlock accounts, sign transactions). As many may involve
I/O (reading from disk, talking with ledger), they must all be async
functions (return Promises).

Now many of these functions can update state somehow, and those
changes must be represented properly in a UI (which probably uses
some sort of redux store). All kinds of Promises resolving to
various state changes seems like a recipe for errors, so
we think to just emit events on state change. The UI can then
take the stream of change events emitted from `watchState`
and feed that into a dispatcher, same way UI actions feed into the
dispatcher.

## Handling Errors

So, we just call a method and go on, content that the UI will update
once the new accounts are created, or other action happens.
However, what happens if there is an error? How do we communicate this?

Maybe we don't just fire and forget, but rather get a promise back
from calling the method. We can `.catch()` any errors that are
returned and in this case dispatch another (UI) event to report the
failure.

But if we only return a Promise here in order to emit a failure event,
why can't the KeyController just emit those failure events directly.
We are guaranteed to eventually get an event describing the 
desired state change or a failure event.

## Unifying actions

At this point, all methods that modify state should have the
form `(a: A, b: B, ...) => void`. Hmm... we could combine
those arguments into `(action: Action) => void`, which looks
very much like a redux dispatcher.

Then we could conceive of just unifying the API to look like:

```typescript
interface KeyController {
  dispatch: (action: Action) => void;

  // just call a remote dispatcher with each result
  listen: (uiDispatcher: (event: Event) => void);

  // or the more general presentation, reactive streams
  // kc.listen().map(uiDispatcher) would be the same as above
  listen: () => Stream<Event>;
}
```

Huh, now we conceive of multiple parts that each accept a stream
of inputs into their own dispatch method, and export a stream
of outputs to any listener, and we can connect two pieces
to close the loop. We have multiple state stores, but they are
all coupled with reactive streams so changes propogate everywhere.

Awesome, so much symmetry!

## Performing Calculations

Not so fast.... sometime we actually do care about the results
and want to use them in a workflow, not just send them to any
listener. What about signing a transaction?

When I sign a transaction, I may want to do something like:

```typescript
const nonce = await node.getNonce(account);
const signableBytes = codec.signableBytes(tx, nonce, chainID);
const sig = await keyControl.signTransaction(user, account, signableBytes)
const signedTx = {...tx, sigs: [...tx.sigs, sig]}
const postable = codec.postableBytes(signedTx);
const result = await node.sendTx(postable);
return txSuccessEvent(result.txId);
```

I want to use the KeyController to perform a calculation
and then feed the results into the next step of a longer
workflow. How do I represent this?

This is an open question and I would love an alternative response.
What is below is rough ideas of what could be done....

## Two types of flow

We have one workflow that modifies the state of the system
(currently activated account, creating new keys, granting
permission to websites). These state changes can be represented
by serializable actions that can be reduced into a given state,
like the whole flux/redux idea.

There is another workflow that uses the current state of the
system to perform actions (sign transactions, sign messages,
submit transactions to the blockchain). These ones can
use standard promise chaining (or async/await) to perform
sequential computation.

Thus any method may be a "state-changing action" and collapsed
into the `dispatch` / `listen` methods, or a "workflow computation"
and return a Promise calculated on 

## Higher-order coupling

But wait... if we see the UI component and the KeyController as
independent state machines that we can couple with change events,
isn't the blockchain just another such state machine? Transactions
are just another name for actions. They are dispatched to
the blockchain by posting the signed bytes, and they will either
produce a change of state, or return an error, just like above.

We clearly cannot sync the entire state of the blockchain locally,
but we could query some subset of the state (my account, my nonce,
my previous transaction) and even subscribe to changes there to 
get an event stream and just reduce those events into our local
image of the portion blockchain state that interests us.

Maybe we could conceive of the blockchain as a `dispatch`/`listen`-er
(what is the name here? an actor?). We no longer await on data or
results... we have the local copy of the nonce always available.
And we just get events on the state of the posted transaction.

The only `await` left in this whole workflow is the signing of
the transaction to deal with the latency of a hardware wallet.
I'm not sure we could abstract that any further.... 

## Other thoughts

Hmmm... maybe `redux-promises` or `redux-saga` would have some useful
inspiration on how to combine these async workflows with actions
and dispatchers....

## A semi-concrete use case

Let's make a harder example, where maybe the actor model or 
reactive streams start to make sense.

We connect to 3 different blockchains, I have a wallet UI (in chrome 
extension), and a webapp connected. I have two accounts currently
unlocked. One is a software key to use for atomic swaps, and the
other is a ledger that manages long-term storage.

Wallet UI unlocks both account and queries balances.
See a good deal in the webapp, and initiate an atomic swap.
This goes to be signed by the software key and a confirmation
is presented in the wallet UI. After confirm, the offer signed 
and posted to the blockchain, and my desired trade rate is stored
in my swap-bot (in the wallet UI).

While I am waiting for the counter-party to respond, I deside to move
1000 IOV off the ledger to my day-trader account. I initiate a transaction
to send this from the wallet UI and a transaction is sent to the ledger.
In the meantime, web4 receives a notification from the second chain in
the swap that an escrow is proposed. The counter is compared to the original
agreement, and as it matches, the trusted swap-bot creates a claim tx
and initiates it for signing (this may happen automatically or pop
up something on the UI). I click "okay" on the ledger app to finalize the
send transaction. Both transactions head to the chain, swaps and sends
are being resolved, and all account balances get updated.

This is a lot of data moving around at once. How do we model such a case
without going crazy?

This may seem a bit far-fetched, but once we provide this web4 API, and
some nice tools, we can allow all kinds of actions, like receiving state
channel payments and auto-claiming part every eg. 50 IOV tokens. Or
passing along multi-sig transactions to the next signatory on the message
after signing.

We should be able to handle information streams and automate many of the
responses by simple bots (IFTTT style). Hopefully this gives a bit of 
inspiration of where to head with the architecture. I'm still not
sure what the proper architecture is to fulfill these use cases, but
I think simple promise chains won't work so well.