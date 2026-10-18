import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serial-queue.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('createSerialQueue', () => {
  it('runs tasks with the same key one after another, also after a failure', async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const task = (name: string, fail = false) => async () => {
      order.push(`${name}:start`);
      await tick();
      order.push(`${name}:end`);
      if (fail) {
        throw new Error(name);
      }
      return name;
    };
    const results = await Promise.allSettled([queue('m1', task('a')), queue('m1', task('b', true)), queue('m1', task('c'))]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('does not block other keys', async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    let release = () => {};
    const blocked = queue('m1', () => new Promise<void>((resolve) => (release = resolve)).then(() => void order.push('m1')));
    await queue('m2', async () => void order.push('m2'));
    release();
    await blocked;
    expect(order).toEqual(['m2', 'm1']);
  });
});
