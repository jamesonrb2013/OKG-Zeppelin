import { SimpleError } from "../SimpleError.js";
import { dataSource } from "./dataSource.js";

let connectionPromise: Promise<void>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function connect() {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      let lastError: unknown;

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`[DB] Connection attempt ${attempt}/5`);

          const initializedDataSource = await dataSource.initialize();

          const tzResult = await initializedDataSource.query(
            "SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP) AS tz",
          );

          if (tzResult[0].tz !== "00:00:00") {
            throw new SimpleError(
              `Database timezone must be UTC (detected ${tzResult[0].tz})`,
            );
          }

          console.log("[DB] Connected successfully");
          return;
        } catch (error) {
          lastError = error;

          console.error(
            `[DB] Connection attempt ${attempt}/5 failed:`,
            error,
          );

          if (dataSource.isInitialized) {
            try {
              await dataSource.destroy();
            } catch {
              // Ignore cleanup errors before retrying.
            }
          }

          if (attempt < 5) {
            await sleep(5000);
          }
        }
      }

      throw lastError;
    })();
  }

  return connectionPromise;
}

export function disconnect() {
  if (connectionPromise) {
    connectionPromise.then(() => {
      if (dataSource.isInitialized) {
        return dataSource.destroy();
      }
    });
  }
}
