/**
 * @template T
 * @returns {{ promise: Promise<T>, resolve: (val: T) => void, reject(reason: any) => void }}
 */
export function createPromiseWithResolvers() {
  const value = {};

  value.promise = new Promise((resolve, reject) => {
    value.resolve = resolve;
    value.reject = reject;
  });

  return value;
}
