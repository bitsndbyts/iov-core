import { Stream } from "xstream";

import { DefaultValueProducer } from "./defaultvalueproducer";

function oneTickLater(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

describe("DefaultValueProducer", () => {
  it("can be constructed", () => {
    const producer = new DefaultValueProducer(1);
    expect(producer.value).toEqual(1);
  });

  it("can be used as a stream backend", done => {
    const producer = new DefaultValueProducer(42);
    const stream = Stream.createWithMemory(producer);
    stream.addListener({
      next: value => {
        expect(value).toEqual(42);
        done();
      },
      error: fail,
      complete: fail,
    });
  });

  it("can send updates", done => {
    const producer = new DefaultValueProducer(42);
    const stream = Stream.createWithMemory(producer);

    // tslint:disable-next-line:readonly-array
    const events: number[] = [];
    stream.addListener({
      next: value => {
        events.push(value);

        if (events.length === 4) {
          expect(events).toEqual([42, 43, 44, 45]);
          done();
        }
      },
      error: fail,
      complete: fail,
    });

    producer.update(43);
    producer.update(44);
    producer.update(45);
  });

  it("calls callbacks", async () => {
    // tslint:disable-next-line:readonly-array
    const producerActive: boolean[] = [];

    const producer = new DefaultValueProducer(42, {
      onStarted: () => producerActive.push(true),
      onStop: () => producerActive.push(false),
    });
    const stream = Stream.createWithMemory(producer);

    expect(producerActive).toEqual([]);

    const subscription1 = stream.subscribe({});
    expect(producerActive).toEqual([true]);

    const subscription2 = stream.subscribe({});
    expect(producerActive).toEqual([true]);

    subscription2.unsubscribe();
    expect(producerActive).toEqual([true]);

    subscription1.unsubscribe();
    await oneTickLater();
    expect(producerActive).toEqual([true, false]);

    const subscription3 = stream.subscribe({});
    expect(producerActive).toEqual([true, false, true]);

    subscription3.unsubscribe();
    await oneTickLater();
    expect(producerActive).toEqual([true, false, true, false]);

    const subscriptionA = stream.subscribe({});
    expect(producerActive).toEqual([true, false, true, false, true]);

    // unsubscribe and re-subscribe does not deactivate the producer (which is a xstream feature)
    subscriptionA.unsubscribe();
    const subscriptionB = stream.subscribe({});
    expect(producerActive).toEqual([true, false, true, false, true]);

    // cleanup
    subscriptionB.unsubscribe();
  });
});
