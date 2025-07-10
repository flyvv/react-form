import {
  _getGlobalState,
  computed,
  createAtom,
  makeObservable,
  onBecomeObserved,
  onBecomeUnobserved,
  Reaction,
  runInAction,
} from 'mobx';

export class AsyncValue<T> {
  private _disposers: Array<() => void>;
  private _error: any;
  private _reaction: Reaction | null;
  private _status: string;
  private _current: T | null;
  private _cancelLastGetter: (() => void) | null;
  private _atom: any;
  private _refreshAtom: any;
  private fetcher: () => Promise<T>;
  private options: Record<string, unknown>;
  public name: string;

  static _globalCount = 0;
  static SKIP = 'AsyncValue@SKIP';
  static StillLoading = class StillLoading extends Error {};

  constructor(
    fetcher: () => Promise<T>,
    initValue: T | null,
    options: Record<string, unknown> = {},
  ) {
    this._disposers = [];
    this._error = null;
    this._reaction = null;
    this._status = 'loading';
    this._current = initValue;
    this._cancelLastGetter = null;
    this.fetcher = fetcher;
    this.options = options;

    // 确保 options.name 是一个字符串类型，默认值也是字符串类型
    this.name =
      typeof options.name === 'string'
        ? options.name
        : `AsyncValue_${AsyncValue._globalCount++}`;

    this._atom = createAtom(`${this.name}#state`);
    this._refreshAtom = createAtom(`${this.name}#refresh`);

    makeObservable(
      this,
      {
        status: computed,
        error: computed,
        _inner_current: computed({ name: `${this.name}.inner_current` }),
        isLoading: computed,
        isError: computed,
        isReady: computed,
      },
      { name: this.name },
    );

    this._disposers.push(this._stop);
    this._disposers.push(onBecomeObserved(this._atom, this._start));
    this._disposers.push(
      onBecomeUnobserved(this._atom, () => {
        if (!this.options.keepAlive) {
          this._stop();
        }
      }),
    );
    this._disposers.push(() => {
      this._status = 'ready';
      this._current = null;
      this._error = null;
    });
  }

  get _mobxGlobal() {
    return _getGlobalState();
  }

  _start = () => {
    if (this._reaction) {
      return;
    }
    this._reaction = new Reaction(`${this.name}#reaction`, () => {
      if (this._status !== 'loading') {
        this._status = 'loading';
        this._atom.reportChanged();
      }
      if (this._reaction) {
        this._reaction.track(() => {
          let cancelled = false;
          this._cancelLastGetter = () => {
            cancelled = true;
          };
          const prevInXFormAsyncValueFetcher =
            this._mobxGlobal.inXFormAsyncValueFetcher ?? false;
          this._mobxGlobal.inXFormAsyncValueFetcher = true;
          this._refreshAtom.reportObserved();

          let promise;
          try {
            promise = this.fetcher();
          } catch (err) {
            promise = Promise.reject(err);
          }

          Promise.resolve(promise)
            .then((newValue) => {
              if (cancelled) {
                return;
              }
              runInAction(() => {
                this._status = 'ready';
                if (newValue !== AsyncValue.SKIP) {
                  this._current = newValue;
                }
                this._error = null;
                this._atom.reportChanged();
              });
            })
            .catch((err) => {
              if (!(err instanceof AsyncValue.StillLoading)) {
                runInAction(() => {
                  this._status = 'error';
                  this._error = err;
                  this._atom.reportChanged();
                });
                throw err;
              }
            });

          this._mobxGlobal.inXFormAsyncValueFetcher =
            prevInXFormAsyncValueFetcher;
        });
      }
    });
    this._reaction.schedule_();
  };

  _stop = () => {
    this._status = 'loading';
    if (this._reaction) {
      this._reaction.dispose();
      this._reaction = null;
    }
  };

  refresh() {
    this._refreshAtom.reportChanged();
  }

  dispose() {
    for (const fn of this._disposers) {
      fn();
    }
  }

  get status() {
    this._atom.reportObserved();
    return this._status;
  }

  get _inner_current(): T | null {
    this._atom.reportObserved();
    return this._current;
  }

  get current(): T | null {
    if (this._mobxGlobal.inXFormAsyncValueFetcher) {
      this._atom.reportObserved();
      if (this._status === 'loading') {
        throw new AsyncValue.StillLoading();
      } else if (this._status === 'error') {
        throw this._error;
      } else {
        return this._current;
      }
    }
    return this._inner_current;
  }

  get error() {
    this._atom.reportObserved();
    return this._error;
  }

  get isLoading() {
    return this.status === 'loading';
  }

  get isReady() {
    return this.status === 'ready';
  }

  get isError() {
    return this.status === 'error';
  }
}
