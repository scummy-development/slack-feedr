/**
 * @template T
 * @returns {{ promise: Promise<T>, resolve: (val: T) => void, reject(reason: any) => void }}
 */
export function createPromiseWithResolvers() {
  const ret = {};

  ret.promise = new Promise((resolve, reject) => {
    ret.resolve = resolve;
    ret.reject = reject;
  });

  return ret;
}
