import {Room, Client, generateId} from "colyseus";
//import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
//import { verifyToken, User, IUser } from "@colyseus/social";

const errorLog = require('../utils/logger').errorlog;
const successlog = require('../utils/logger').successlog;

export class DemoRoom extends Room {

    nbTirage:number;
    serverTirageData:any;

    nbQueueReady:number;
    serverQueueData:any;

    maxClients: number;

    nbIDs:number; // le nombre de joueur (2)
    serverIDsData:any;

    playerIDConcede:any;
    metaData:any

    onCreate(options:any) {
        console.log("DemoRoom created!", options);

        this.nbTirage = 0;
        this.serverTirageData = {};
        this.nbQueueReady = 0;
        this.serverQueueData = {};
        this.maxClients = 2;
        this.serverIDsData = {};
        this.nbIDs = 0;
        this.playerIDConcede = 0;
        this.setPatchRate(1000 / 20);
        this.setSimulationInterval((dt) => this.update(dt));
        //this.setMetadata({"test":string}); //gros beug quand on le récupère, dommage car on pourrait mettre l'id de l'host
        //dedans et le display pour afficher l'host de la game, archi stylé. askip faut caster le truc à un moment, ????
    }

    findOpponentID(idJ1:any)
    {
      var oponnentID:string = "";
      this.clients.forEach(function (client) {
        if (client.id != idJ1)
          oponnentID = client.id;
        });
      return oponnentID;
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

    onJoin(client:Client, options:any, user:any) {
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

        successlog.info("roomId : " + this.roomId , data, "received from", client.sessionId);

        if (data.type === "chat") {
            console.log("Chat : " + data.message);
            this.broadcast({type: "chat", message: "this is a chat message from server"});
        }

        if (data.type === "sendPlayerIdToServer") {

            if (this.serverIDsData["C1"] != client.id) //C1 = Challenger One ------ petit bout de code pour savoir si c'est le premier ou 2eme qui demande un tirage
            {
                this.nbIDs += 1;
                console.log("+1 Challenger");
            }
            console.log("AFTER nbIDs : "+ this.nbIDs);

            if (this.nbIDs == 1) {
                console.log("There is one Challenger");
                this.serverIDsData["C1"] = client.id;
                this.serverIDsData["playerIDC1"] = data.PlayerID;
                console.log("C1 : "+ this.serverIDsData["C1"]);
            }
            else if (this.nbIDs == 2) {
                console.log("There is two Challenger");
                this.serverIDsData["C2"] = client.id;
                this.serverIDsData["playerIDC2"] = data.PlayerID;
                console.log("C2 : "+ this.serverIDsData["C2"]);

                console.log("Server nbIDs : %o",this.serverIDsData);

                //var encoded_rolls = JSON.stringify(this.serverTirageData);

                this.broadcast({
                    type: "playerIDFromServer",
                    C1: this.serverIDsData["C1"],
                    C2: this.serverIDsData["C2"],
                    playerIDC1: this.serverIDsData["playerIDC1"],
                    playerIDC2: this.serverIDsData["playerIDC2"]
                });
                this.nbIDs = 0;
                this.serverIDsData = {};
            }
        }
        if (data.type === "iConcedeTheGame") {
              this.playerIDConcede = data.PlayerID;
              console.log("id concede : "+ this.playerIDConcede);
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.playerIDConcede,
                });
                this.playerIDConcede = {};
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
                console.log("queue : %o", this.serverQueueData["QueueT1"]);
                console.log("queue : %o", this.serverQueueData["QueueT2"]);

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
        if (data.type === "sendTargets")
        {
            console.log("inside sendTargets");
            console.log("target : "+ data.targets);
            this.broadcast({
                type: "targetsFromServer",
                idSender:client.id,
                targets: data.targets,
            }, { except: client });
        }
        if (data.type === "readyBtnClicked")
        {
          console.log("inside readyBtnClicked");
              this.broadcast({type: "readyBtnClicked", idSender:client.id}, {except:client});
        }
        if (data.type === "readyQueueBtnClicked")
        {
          console.log("inside readyQueueBtnClicked");
              this.broadcast({type: "readyQueueBtnClicked", idSender:client.id}, {except:client});
        }
        if (data.type === "readyQueueBtnClicked")
        {
            console.log("inside readyQueueBtnClicked");
            this.broadcast({type: "readyQueueBtnClicked", idSender:client.id}, {except:client});
        }
        if (data.type === "sendLastHoveredItem")
        {
            console.log("inside sendLastHoveredItem");
            console.log("LastHoveredItem : "+ data.item);
            this.broadcast({
                type: "lastHoveredItemFromServer",
                idSender:client.id,
                item: data.item,
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
