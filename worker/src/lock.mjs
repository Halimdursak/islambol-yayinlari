/** Görevleri sırayla çalıştırır; biri hata verse bile sıradakini bozmaz. */
export function createLock() {
  let tail = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => {});
    return run;
  };
}

/** En çok `limit` görev aynı anda çalışır; ilk hatada reddeder (başlamış görevler bitmeye devam eder). */
export async function mapLimit(items, limit, task) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await task(queue.shift());
  });
  await Promise.all(workers);
}
