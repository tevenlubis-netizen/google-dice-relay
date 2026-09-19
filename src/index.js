import { DurableObject } from "cloudflare:workers";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint sederhana untuk mengecek apakah server hidup
    if (url.pathname === "/") {
      return new Response(
        "Google Dice Relay Cloudflare is running.",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain"
          }
        }
      );
    }

    // WebSocket harus menggunakan Upgrade
    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");

      if (upgradeHeader !== "websocket") {
        return new Response(
          "WebSocket connection required.",
          { status: 426 }
        );
      }

      // Room digunakan agar HP 1 dan HP 2
      // berada pada ruang komunikasi yang sama.
      const room =
        url.searchParams.get("room") || "google-dice";

      const id = env.RELAY_ROOM.idFromName(room);
      const stub = env.RELAY_ROOM.get(id);

      return stub.fetch(request);
    }

    return new Response("Not Found", {
      status: 404
    });
  }
};


export class RelayRoom extends DurableObject {

  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {

    const upgradeHeader =
      request.headers.get("Upgrade");

    if (upgradeHeader !== "websocket") {
      return new Response(
        "WebSocket connection required.",
        { status: 426 }
      );
    }

    const webSocketPair = new WebSocketPair();

    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // Terima WebSocket menggunakan
    // Durable Object WebSocket Hibernation.
    this.ctx.acceptWebSocket(server);

    server.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to Google Dice Relay"
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(webSocket, message) {

    let data;

    try {
      data = JSON.parse(message);
    } catch (error) {

      data = {
        type: "raw",
        data: String(message)
      };
    }

    // Tambahkan timestamp server
    if (typeof data === "object" && data !== null) {
      data.relayTimestamp = Date.now();
    }

    const output = JSON.stringify(data);

    // Kirim ke semua perangkat lain
    // yang berada di room yang sama.
    const sockets = this.ctx.getWebSockets();

    for (const socket of sockets) {

      if (socket === webSocket) {
        continue;
      }

      try {
        socket.send(output);
      } catch (error) {
        // Abaikan socket yang sudah tertutup.
      }
    }
  }

  async webSocketClose(webSocket, code, reason) {
    try {
      webSocket.close(code, reason);
    } catch (error) {
      // Socket sudah tertutup.
    }
  }

  async webSocketError(webSocket, error) {
    try {
      webSocket.close(1011, "WebSocket error");
    } catch (closeError) {
      // Socket sudah tertutup.
    }
  }
}
