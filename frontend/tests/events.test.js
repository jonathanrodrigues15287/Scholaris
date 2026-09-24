const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function createEvents() {
  const browserEvents = [];
  const window = {
    dispatchEvent(event) {
      browserEvents.push(event);
    }
  };
  const context = {
    window,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    console
  };
  vm.runInNewContext(
    fs.readFileSync('frontend/js/core/events.js', 'utf8'),
    context,
    { filename: 'frontend/js/core/events.js' }
  );
  return { events: context.window.Scholaris.events, browserEvents };
}

test('emits internal and browser events with the same detail', () => {
  const { events, browserEvents } = createEvents();
  const details = [];
  events.on('data-updated', detail => details.push(detail));

  const detail = { type: 'assignment' };
  events.emit('data-updated', detail);

  assert.deepEqual(details, [detail]);
  assert.equal(browserEvents.length, 1);
  assert.equal(browserEvents[0].type, 'scholaris:data-updated');
  assert.deepEqual(browserEvents[0].detail, detail);
});

test('unsubscribe stops internal event handling without affecting browser dispatch', () => {
  const { events, browserEvents } = createEvents();
  let calls = 0;
  const unsubscribe = events.on('sync-completed', () => { calls += 1; });

  unsubscribe();
  events.emit('sync-completed', { pending: 0 });

  assert.equal(calls, 0);
  assert.equal(browserEvents[0].type, 'scholaris:sync-completed');
});
