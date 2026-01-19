import { schedule } from "node-cron";
import { Observable } from "rxjs";

export function cronTimer(expr) {
  return new Observable((subscriber) => {
    const task = schedule(expr, () => {
      subscriber.next(new Date());
    });

    subscriber.next(new Date());
    task.start();

    return () => task.destroy();
  });
}
