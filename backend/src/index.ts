import app from './app';
import {
  startReminderQueue,
  stopReminderQueue,
  startBillingQueue,
  stopBillingQueue,
  startPlatformBillingQueue,
  stopPlatformBillingQueue,
} from './queue';

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
  // Fire-and-forget: never block boot on Redis being down - the queue module
  // handles unavailability gracefully and the API keeps working regardless.
  void startReminderQueue();
  void startBillingQueue();
  void startPlatformBillingQueue();
});

// Graceful shutdown so in-flight reminder jobs finish before exit.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void (async () => {
      await stopReminderQueue();
      await stopBillingQueue();
      await stopPlatformBillingQueue();
      process.exit(0);
    })();
  });
}
