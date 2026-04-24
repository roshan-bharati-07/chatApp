import { createClient } from "redis";


  const pubClient = createClient({ url: "redis://127.0.0.1:6379" });
  const subClient = pubClient.duplicate();
  const messageRedisClient = pubClient.duplicate();

  export {
    pubClient,
    subClient,
    messageRedisClient
  }