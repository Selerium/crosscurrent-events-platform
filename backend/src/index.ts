import http from "http";
import app from "./app.ts";
import { attachWatchServer } from "./ws/watchServer.ts";

const server = http.createServer(app);
attachWatchServer(server);

server.listen(3000, "0.0.0.0", () => {
  console.log('Express backend running on port :3000');
});
