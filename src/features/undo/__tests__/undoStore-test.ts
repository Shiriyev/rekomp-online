import { showUndo, useUndoStore } from '../undoStore';

const store = () => useUndoStore.getState();

beforeEach(() => store().dismiss());

describe('undo store', () => {
  it('runs the undo on «Отменить» and never the expiry', () => {
    const run = jest.fn();
    const onExpire = jest.fn();
    showUndo('Удалено', run, onExpire);
    store().undo();
    store().dismiss(); // the snackbar also reports a dismiss after its action
    expect(run).toHaveBeenCalledTimes(1);
    expect(onExpire).not.toHaveBeenCalled();
    expect(store().current).toBeNull();
  });

  it('expires once when the snackbar closes without undo', () => {
    const run = jest.fn();
    const onExpire = jest.fn();
    showUndo('Удалено', run, onExpire);
    store().dismiss();
    store().dismiss();
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  it('expires the previous action when a new one replaces it', () => {
    const first = jest.fn();
    showUndo('Первое', jest.fn(), first);
    showUndo('Второе', jest.fn());
    expect(first).toHaveBeenCalledTimes(1);
    expect(store().current?.message).toBe('Второе');
  });

  it('keeps going when an expiry throws', () => {
    showUndo(
      'Сломано',
      undefined,
      jest.fn(() => {
        throw new Error('boom');
      }),
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => store().dismiss()).not.toThrow();
    warn.mockRestore();
  });
});
