import {Room, Client, generateId} from "colyseus";
//import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
//import { verifyToken, User, IUser } from "@colyseus/social";

export class DemoRoom extends Room {

    nbTirage:number;
    serverTirageData:any;

    nbQueueReady:number;
    serverQueueData:any;

    maxClients: number;

    onInit(options:any) {
        console.log("DemoRoom created!", options);

        this.nbTirage = 0;
        this.serverTirageData = {};
        this.nbQueueReady = 0;
        this.serverQueueData = {};
        this.maxClients = 2;
        this.setPatchRate(1000 / 20);
        this.setSimulationInterval((dt) => this.update(dt));
    }

    /*requestJoin(options:any) {
        console.log("request join!", options);
        return true;
    }*/

    requestJoin (options, isNewRoom: boolean) {
        return (options.create)
            ? (options.create && isNewRoom)
            : this.clients.length > 0;
    }

    onJoin(client:Client, options:any, user:IUser) {
        console.log("client joined!", client.sessionId);
    }

    async onLeave(client:Client, consented:boolean) {

        try {
            if (consented) {
                throw new Error("consented leave!");
            }

            console.log("let's wait for reconnection!")
            const newClient = await this.allowReconnection(client, 10);
            console.log("reconnected!", newClient.sessionId);

        } catch (e) {
            console.log("disconnected!", client.sessionId);
        }
    }

    onMessage(client:Client, data:any) {
        console.log(data, "received from", client.sessionId);
        console.log(data.type, " is type");

        if (data.type === "chat") {
            console.log("Chat : " + data.message);
            this.broadcast({type: "chat", message: "this is a chat message from server"});
        }

        if (data.type === "askServerForTirage") {
            console.log("askServerForTirage : " + data.message);

            var dicesStates = JSON.parse(data.states);

            var rnd1 = Math.floor(Math.random() * 6) + 1;
            var rnd2 = Math.floor(Math.random() * 6) + 1;
            var rnd3 = Math.floor(Math.random() * 6) + 1;
            var rnd4 = Math.floor(Math.random() * 6) + 1;
            var rnd5 = Math.floor(Math.random() * 6) + 1;

            if (dicesStates[0] == 0)
                rnd1 = 0;
            if (dicesStates[1] == 0)
                rnd2 = 0;
            if (dicesStates[2] == 0)
                rnd3 = 0;
            if (dicesStates[3] == 0)
                rnd4 = 0;
            if (dicesStates[4] == 0)
                rnd5 = 0;


            if (this.serverTirageData["idT1"] != client.id) //petit bout de code pour savoir si c'est le premier ou 2eme qui demande un tirage
                this.nbTirage += 1;

            if (this.nbTirage == 1) {
                console.log("Player pos 1 ask for roll");
                this.serverTirageData["idT1"] = client.id;
                this.serverTirageData["tirageT1"] = [rnd1, rnd2, rnd3, rnd4, rnd5];
            }
            else if (this.nbTirage == 2) {
                console.log("Player pos 2 ask for roll");
                this.serverTirageData["idT2"] = client.id;
                this.serverTirageData["tirageT2"] = [rnd1, rnd2, rnd3, rnd4, rnd5];

                console.log("Server tirage : %o",this.serverTirageData);

                //var encoded_rolls = JSON.stringify(this.serverTirageData);

                this.broadcast({
                    type: "drawsFromServer",
                    idT1: this.serverTirageData["idT1"],
                    idT2: this.serverTirageData["idT2"],
                    tirageT1: this.serverTirageData["tirageT1"],
                    tirageT2: this.serverTirageData["tirageT2"]
                });

                this.nbTirage = 0;
                this.serverTirageData = {};
            }
        }
        if (data.type === "askQueueExchange") {

            var senderPlayerId = client.id; // get sender's playerID
            var queueJson = data.queue;

            var queue = JSON.parse(queueJson);

            if(this.serverQueueData["idT1"] != senderPlayerId)
                this.nbQueueReady += 1;

            if(this.nbQueueReady == 1)
            {
                console.log("Player pos 1 validate for queue");
                this.serverQueueData["idT1"] = senderPlayerId;
                this.serverQueueData["QueueT1"] = queue;
            }
            else if (this.nbQueueReady == 2)
            {
                console.log("Player pos 2 validate for queue");
                this.serverQueueData["idT2"] = senderPlayerId;
                this.serverQueueData["QueueT2"] = queue;

                //var encoded_queues = JSON.stringify(serverQueueData);

                this.broadcast({
                    type: "queuesFromServer",
                    idT1: this.serverQueueData["idT1"],
                    idT2: this.serverQueueData["idT2"],
                    QueueT1: this.serverQueueData["QueueT1"],
                    QueueT2: this.serverQueueData["QueueT2"]
                });

                this.nbQueueReady = 0;
                this.serverQueueData = {};
            }

        }
        if(data.type === "sendTargets")
        {
            this.broadcast({
                type: "targetsFromServer",
                idSender:client.sessionId,
                targets: data.targets,
            }, { except: client });
        }
    }

    update(dt?:number) {
        // console.log("num clients:", Object.keys(this.clients).length);
    }

    onDispose() {
        console.log("disposing DemoRoom...");
    }

}
