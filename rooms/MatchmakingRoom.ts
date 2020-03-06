import {Room, Client, generateId} from "colyseus";
//import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
//import { verifyToken, User, IUser } from "@colyseus/social";

const errorLog = require('../utils/logger').errorlog;
const successlog = require('../utils/logger').successlog;
const connexion = require('../utils/database-stats').connexion;

export class MatchmakingRoom extends Room {

    nbTirage:number;
    serverTirageData:any;

    nbQueueReady:number;
    serverQueueData:any;

    maxClients: number;

    nbIDs:number; // le nombre de joueur (2)
    serverIDsData:any;
    spectatorIDs: any;

    playerIDConcede:any;
    metaData:any

    resendDataTry:number;

    game_id:any;

    onCreate(options:any) {
        console.log("MatchmakingRoom created!", options);

        this.nbTirage = 0;
        this.serverTirageData = {};
        this.nbQueueReady = 0;
        this.serverQueueData = {};
        this.maxClients = 2;
        this.serverIDsData = {};
        this.spectatorIDs = {};
        this.nbIDs = 0;
        this.playerIDConcede = 0;
        this.setPatchRate(1000 / 20);
        this.setSimulationInterval((dt) => this.update(dt));
        this.resendDataTry = 0;
        //console.log("options.creator : "+options.creator);
        //this.setMetadata({creator:options.creator});
        this.setMetadata({test:"test"});
        this.game_id = this.roomId;
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

    getPlayerIdFromSessionID(sessionId:string)
    {
        if(this.serverIDsData["C1"] == sessionId)
            return this.serverIDsData["playerIDC1"];
        if(this.serverIDsData["C2"] == sessionId)
            return this.serverIDsData["playerIDC2"]
        else return -1;
    }

    getOpponentPlayerIdFromSessionID(sessionId:string)
    {
        if(this.serverIDsData["C2"] == sessionId)
            return this.serverIDsData["playerIDC1"];
        if(this.serverIDsData["C1"] == sessionId)
            return this.serverIDsData["playerIDC2"]
        else return -1;
    }

    isClientChallenger(sessionId:string)
    {
        var isChall = false;
        if(this.serverIDsData["C1"] == sessionId)
            isChall = true;
        if(this.serverIDsData["C2"] == sessionId)
            isChall = true;

        return isChall
    }

    sendErrorMessage(client:any, error_type:string, error_datas:any)
    {
        this.send(client,{
            type: "MatchmakingRoom - serverError",
            error_type:error_type,
            error_datas:error_datas
        });
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
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.getPlayerIdFromSessionID(client.id),
                });
                this.playerIDConcede = {};
            }

            console.log("let's wait for reconnection!")
            const newClient = await this.allowReconnection(client, 30);
            console.log("reconnected!", newClient.sessionId);

        } catch (e) {
            console.log("disconnected!", client.sessionId);
            this.broadcast({
                type: "idConcedeFromServ",
                playerIDConcede: this.getPlayerIdFromSessionID(client.id),
            });
            this.playerIDConcede = {};

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

            if(data.PlayerID != null && data.PlayerID != 0) {

                this.resendDataTry = 0;

                if (this.serverIDsData["C1"] != client.id) //C1 = Challenger One ------ petit bout de code pour savoir si c'est le premier ou 2eme qui demande un tirage
                {
                    this.nbIDs += 1;
                    console.log("+1 Challenger");
                }
                console.log("AFTER nbIDs : " + this.nbIDs);

                if (this.nbIDs == 1) {
                    console.log("There is one Challenger");
                    this.serverIDsData["C1"] = client.id;
                    this.serverIDsData["playerIDC1"] = data.PlayerID;
                    this.serverIDsData["clientC1"] = client;
                    console.log("C1 : " + this.serverIDsData["C1"]);
                } else if (this.nbIDs == 2) {
                    console.log("There is two Challenger");
                    this.serverIDsData["C2"] = client.id;
                    this.serverIDsData["playerIDC2"] = data.PlayerID;
                    this.serverIDsData["clientC2"] = client;
                    console.log("C2 : " + this.serverIDsData["C2"]);

                    //console.log("Server nbIDs : %o",this.serverIDsData);

                    //var encoded_rolls = JSON.stringify(this.serverTirageData);

                    this.broadcast({
                        type: "playerIDFromServer",
                        C1: this.serverIDsData["C1"],
                        C2: this.serverIDsData["C2"],
                        playerIDC1: this.serverIDsData["playerIDC1"],
                        playerIDC2: this.serverIDsData["playerIDC2"]
                    });
                    this.nbIDs = 0;
                    var date = new Date();
                    var formatted_date = new Intl.DateTimeFormat('fr-FR').format(date);
                    this.recordGameCreation(this.game_id, this.serverIDsData["playerIDC1"], this.serverIDsData["playerIDC2"], 0, 0,formatted_date);
                    //this.serverIDsData = {};
                }
            }
            else
            {
                this.resendDataTry++;
                if(this.resendDataTry <= 5)
                {
                    var error_datas = {};
                    error_datas["data_name"] = "playerID";
                    error_datas["reason"] = "void";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }
                else
                {
                    console.log("No playerID - Disconnecting player");
                }

            }
        }
        if (data.type === "iConcedeTheGame") {
              this.playerIDConcede = data.PlayerID;
              console.log("id concede : "+ this.playerIDConcede);
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.playerIDConcede,
                });
                console.log("gonna call : updateGameEnd");
                this.updateGameEnd(this.getOpponentPlayerIdFromSessionID(client.id), 0,0,10,'true');
                this.playerIDConcede = {};
         }
        if (data.type === "askServerForTirage") {

            if(this.isClientChallenger(client.id)) {

                console.log("askServerForTirage : " + data.message);

                var dicesStates = [];

                try {
                    dicesStates = JSON.parse(data.states);
                } catch(e) {

                    dicesStates = [];
                    this.resendDataTry++;
                    console.log("PARSE ERROR - dicesStates not valid JSON resendDataTry = "+this.resendDataTry);
                }

                if(dicesStates.length <= 0 && this.resendDataTry > 5)
                {
                    console.log("Default tirage");
                    queue = [0,0,0,0,0];
                }
                else if(dicesStates.length <= 0)
                {
                    var error_datas = {};
                    error_datas["data_name"] = "dicesStates";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                //var dicesStates = JSON.parse(data.states);
                if(dicesStates.length > 0) {

                    this.resendDataTry = 0;

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
                    } else if (this.nbTirage == 2) {
                        console.log("Player pos 2 ask for roll");
                        this.serverTirageData["idT2"] = client.id;
                        this.serverTirageData["tirageT2"] = [rnd1, rnd2, rnd3, rnd4, rnd5];

                        console.log("Server tirage : %o", this.serverTirageData);

                        //var encoded_rolls = JSON.stringify(this.serverTirageData);

                        this.broadcast({
                            type: "drawsFromServer",
                            idT1: this.serverTirageData["idT1"],
                            idT2: this.serverTirageData["idT2"],
                            tirageT1: this.serverTirageData["tirageT1"],
                            tirageT2: this.serverTirageData["tirageT2"],
                            idSender: this.getPlayerIdFromSessionID(client.id)
                        });

                        this.nbTirage = 0;
                        this.serverTirageData = {};
                    }
                }
            }
        }
        if (data.type === "askQueueExchange") {

            if(this.isClientChallenger(client.id)) {

                var senderPlayerId = client.id; // get sender's playerID
                var queueJson = data.queue;

                var queue = [];

                try {
                    queue = JSON.parse(queueJson);
                } catch(e) {

                    queue = [];
                    this.resendDataTry++;
                    console.log("PARSE ERROR - Queue not valid JSON resendDataTry = "+this.resendDataTry);
                }

                if(queue.length <= 0 && this.resendDataTry > 5)
                {
                    console.log("Default queue");
                    queue = [1,2,3,4,5];
                }
                else if(queue.length <= 0)
                {
                    var error_datas = {};
                    error_datas["data_name"] = "queue";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                console.log("Queue = %o",queue);
                if(queue.length > 0) {

                    this.resendDataTry = 0;

                    if (this.serverQueueData["idT1"] != senderPlayerId)
                        this.nbQueueReady += 1;

                    if (this.nbQueueReady == 1) {
                        console.log("Player pos 1 validate for queue");
                        this.serverQueueData["idT1"] = senderPlayerId;
                        this.serverQueueData["QueueT1"] = queue;
                    } else if (this.nbQueueReady == 2) {
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

            }

        }
        if (data.type === "sendTargets")
        {
            if(this.isClientChallenger(client.id)) {
                console.log("inside sendTargets");
                console.log("target : " + data.targets);

                var targets = null;

                try {
                    targets = JSON.parse(data.targets);
                } catch(e) {
                    this.resendDataTry++;
                    console.log("PARSE ERROR - Target not valid JSON resendDataTry = "+this.resendDataTry);
                }
                var faceUsageID = this.recordFaceUsage(data.facId, this.getPlayerIdFromSessionID(client.id), this.game_id,0, data.launching.toString());

                if(targets == null && this.resendDataTry > 5)
                {
                    console.log("Default Target");
                    this.recordTarget(this.game_id, faceUsageID, this.getPlayerIdFromSessionID(client.id), "default", -1, -1);
                    data.targets = '{"launching":false,"targets":[]}';
                }
                else if(targets == null)
                {
                    var error_datas = {};
                    error_datas["data_name"] = "targets";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                if(targets != null) {
                    for (var i = 0; i < targets.length; i++)
                    {
                        this.recordTarget(this.game_id, faceUsageID, this.getPlayerIdFromSessionID(client.id), targets[i]._type,targets[i]._playerPosition, targets[i].itemPosition);
                    }
                    this.broadcast({
                        type: "targetsFromServer",
                        idSender: this.getPlayerIdFromSessionID(client.id),
                        targets: data.targets,
                    }, {except: client});

                    this.send(client,
                        {
                            type: "PlayerLaunchAuthorization",
                            idSender: this.getPlayerIdFromSessionID(client.id),
                            targets: data.targets,
                        }
                    )
                }
            }
        }
        if (data.type === "readyBtnClicked")
        {
            if(this.isClientChallenger(client.id)) {
                console.log("inside readyBtnClicked");
                this.broadcast({type: "readyBtnClicked", idSender: this.getPlayerIdFromSessionID(client.id)}, {except: client});
            }
        }
        if (data.type === "readyQueueBtnClicked")
        {
            if(this.isClientChallenger(client.id)) {
                console.log("inside readyQueueBtnClicked");
                this.broadcast({type: "readyQueueBtnClicked", idSender: this.getPlayerIdFromSessionID(client.id)}, {except: client});
            }
        }
        if (data.type === "sendLastHoveredItem")
        {
            if(this.isClientChallenger(client.id)) {
                console.log("inside sendLastHoveredItem");
                console.log("LastHoveredItem : " + data.item);
                this.broadcast({
                    type: "lastHoveredItemFromServer",
                    idSender: this.getPlayerIdFromSessionID(client.id),
                    item: data.item,
                }, {except: client});
            }
        }
        if(data.type == "registerAsSpectator")
        {
            this.spectatorIDs[client.id] = client;
            this.send(client,{
                type: "registeredAsSpectator",
                C1: this.serverIDsData["C1"],
                C2: this.serverIDsData["C2"],
                playerIDC1: this.serverIDsData["playerIDC1"],
                playerIDC2: this.serverIDsData["playerIDC2"],
                idSender:this.getPlayerIdFromSessionID(client.id)
            });
        }
        if(data.type == "askGameStateDatas") {
            console.log("inside askGameStateDatas");
            this.send(this.serverIDsData["clientC1"], {
                type: "GameStateDatasAsked",
                askedBy: client.id
            });
        }
        if (data.type == "sendGameStateDatasTo")
        {
            console.log("inside sendGameStateDatasTo");
            console.log("GameStateDatas : "+ data.GameStateDatas);
            this.send(this.spectatorIDs[data.SpectatorId],{
                type: "gameStateFromServer",
                GameState: data.GameStateDatas,
                idSender:this.getPlayerIdFromSessionID(client.id)
            });
        }
        if(data.type == "sendInitTourEvent") {
            console.log("inside sendInitTourEvent");
            this.broadcast({
                type: "initTourEvent"
            });
        }
        if(data.type == "AskForContemplationEvent") {
            console.log("inside AskForContemplationEvent");
            this.broadcast({
                type: "contemplationEvent",
                }, {except: client});
        }
        if(data.type == "sendSwapDiceEvent") {
            console.log("inside sendSwapDiceEvent");
            this.broadcast({
                idSender: this.getPlayerIdFromSessionID(client.id),
                type: "swapDiceEvent"
            });
        }
       	 if(data.type == "sendRerollCardClicked") {
	        console.log("inside sendRerollCardClicked");
	        this.broadcast({
	            idSender: this.getPlayerIdFromSessionID(client.id),
	            type: "sendRerollCardClicked"
	        });
	    }
        if(data.type == "sendManaCardClicked") {
	        console.log("inside sendManaCardClicked");
	        this.broadcast({
	            idSender: this.getPlayerIdFromSessionID(client.id),
	            type: "sendManaCardClicked"
	        });
	    }
        if(data.type == "sendIdOfGods") {
            console.log("inside sendIdOfGods");
            /*this.broadcast({
                idSender: this.getPlayerIdFromSessionID(client.id),
                type: "sendManaCardClicked"
            });*/
            this.updateGameCreationWithGods(data.godPlayer1,data.godPlayer2);
        }
    }

    update(dt?:number) {
        // console.log("num clients:", Object.keys(this.clients).length);
    }

    onDispose() {
        console.log("disposing MatchmakingRoom...");
    }


    /* SQL FUNCTIONS */

    recordFaceUsage(face_id:number, player_id:number, game_id:any, tour_number:number, launched:string)
    {
        const face = { face_id: face_id, player_id: player_id, game_id: game_id, tour_number: tour_number, launched};
        connexion.query('INSERT INTO Face_usage SET ?', face, (err, res) => {
            if(err)
            {
                throw err;
                return 0;
            }

            console.log('Last insert ID:', res.insertId);
            return res.insertId;
        });
        return 0;
    }

    recordGameCreation(game_id:number, player_1_id:number, player_2_id:number, god_player_1:number, god_player_2:number, date:any)
    {

        const game = { game_id: game_id, player_1_id: player_1_id, player_2_id: player_2_id, god_player_1: god_player_1,  god_player_2:god_player_2, date:date};
        connexion.query('INSERT INTO Game SET ?', game, (err, res) => {
            if(err) throw err;

            console.log('Last insert ID:', res.insertId);
        });
    }

    recordTarget(game_id:number, launch_id:number, player_launcher_id:number, target_type:string, target_player_pos:number, target_item_pos:number)
    {
        const game = { game_id: game_id, launch_id: launch_id, player_launcher_id: player_launcher_id, target_type: target_type,  target_player_pos:target_player_pos,target_item_pos:target_item_pos};
        connexion.query('INSERT INTO Target SET ?', game, (err, res) => {
            if(err) throw err;

            console.log('Last insert ID:', res.insertId);
        });
    }

    updateGameCreationWithGods(god_player_1:number, god_player_2:number)
    {
        connexion.query("UPDATE Game SET god_player_1 = ?, god_player_2 = ? WHERE game_id = ?",
            [god_player_1,god_player_2, this.game_id], (err, res) => {
                if(err)
                {
                    console.log("err : %o ",err);
                    throw err;
                }
                console.log(`Changed ${res.changedRows} row(s)`);
            });
    }

    updateGameEnd(winner_player_id:any, end_hp_player_1:number, end_hp_player_2:number, total_tour:number, conceded:any)
    {

        connexion.query("UPDATE Game SET winner_player_id = ?, end_hp_player_1 = ?, end_hp_player_2 = ?, total_tour = ?, conceded = ? WHERE game_id = ?",
            [winner_player_id,end_hp_player_1,end_hp_player_2,total_tour,conceded, this.game_id], (err, res) => {
            if(err)
            {
                console.log("err : %o ",err);
                throw err;
            }
            console.log(`Changed ${res.changedRows} row(s)`);
        });
    }


}
