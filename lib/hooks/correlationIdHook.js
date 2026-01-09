import { v4 as uuidv4 } from "uuid";

let correlationId = undefined;

export const correlationIdHook = async (options) => {
  if (!correlationId) {
    correlationId = uuidv4();
  }

  options.headers["x-correlation-id"] = correlationId;
};
