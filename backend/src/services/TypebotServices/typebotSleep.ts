export async function typebotSleep(ms: number): Promise<void> {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) {
    return;
  }
  await new Promise<void>(resolve => {
    setTimeout(resolve, n);
  });
}
