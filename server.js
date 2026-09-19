const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

/*
 * HTTP server
 * Dibutuhkan oleh Render.
 */
const httpServer = http.createServer((req, res) => {

    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end(
        "Google Dice Relay Server is running."
    );
});


/*
 * WebSocket server
 */
const wss = new WebSocket.Server({
    server: httpServer
});


/*
 * ROOM
 *
 * Contoh:
 *
 * ROOM 123456
 *
 * HP 1 masuk room 123456
 * HP 2 masuk room 123456
 *
 * Data dari satu HP dikirim
 * ke HP lain dalam room yang sama.
 */
const rooms = new Map();


function send(socket, data) {

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(data)
        );
    }
}


wss.on("connection", (socket) => {

    let room = null;

    console.log(
        "Client connected"
    );


    socket.on("message", (raw) => {

        try {

            const message =
                JSON.parse(
                    raw.toString()
                );


            /*
             * JOIN ROOM
             */

            if (
                message.type === "join"
            ) {

                room =
                    String(
                        message.room
                    );


                if (
                    !rooms.has(room)
                ) {

                    rooms.set(
                        room,
                        new Set()
                    );
                }


                rooms
                    .get(room)
                    .add(socket);


                send(socket, {

                    type: "joined",

                    room

                });


                console.log(
                    `Client joined room: ${room}`
                );


                return;
            }


            /*
             * DATA RELAY
             */

            if (
                message.type === "data" &&
                room
            ) {

                const clients =
                    rooms.get(room);


                if (!clients) {
                    return;
                }


                for (
                    const client
                    of clients
                ) {

                    /*
                     * Jangan kirim balik
                     * ke pengirim.
                     */

                    if (
                        client === socket
                    ) {
                        continue;
                    }


                    send(
                        client,
                        message
                    );
                }


                console.log(
                    `Data relayed in room ${room}`
                );


                return;
            }


        } catch (error) {

            console.error(
                "Message error:",
                error.message
            );

        }

    });


    socket.on("close", () => {

        console.log(
            "Client disconnected"
        );


        if (!room) {
            return;
        }


        const clients =
            rooms.get(room);


        if (!clients) {
            return;
        }


        clients.delete(
            socket
        );


        if (
            clients.size === 0
        ) {

            rooms.delete(
                room
            );

        }

    });

});


/*
 * Jalankan server
 */

httpServer.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Google Dice Relay running on port ${PORT}`
        );

    }
);
