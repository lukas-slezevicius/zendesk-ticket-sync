// Stand-in for our real job library (the real implementation lives in a
// shared package). Treat it as given and correct. Its contract:
//
//   - every(name, intervalMinutes, handler) runs the handler on a fixed
//     interval, starting at process boot.
//   - Ticks are fire-and-forget: the library does NOT wait for the previous
//     tick to finish, so a slow handler can overlap the next tick.
//   - If a handler throws, the error is logged and that tick is dropped —
//     there are no retries.
//   - Nothing is persisted: a restart simply starts the interval again.
//   - We run a single instance of this service.
export function every(
  name: string,
  intervalMinutes: number,
  handler: () => Promise<void>,
): void {
  // real implementation in the shared jobs package
}
