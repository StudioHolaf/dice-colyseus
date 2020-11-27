import {Room, Client, generateId} from "colyseus";
import {LobbyClient} from "../diceofolympus/LobbyClient";
//import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
//import { verifyToken, User, IUser } from "@colyseus/social";

const errorLog = require('../utils/logger').errorlog;
const successlog = require('../utils/logger').successlog;
const connexion = require('../utils/database-stats').connexion;

export class DemoRoom extends Room {

    nbTirage: number;
    serverTirageData: any;

    nbQueueReady: number;
    serverQueueData: any;

    maxClients: number;

    nbIDs: number; // le nombre de joueur (2)
    serverIDsData: any;
    spectatorIDs: any;
    playerIDConcede: any;
    metaData: any
    resendDataTry: number;
    game_id: any;
    someoneConcede: string;


    LobbyClients: any
    isgameStarted: boolean

    onCreate(options: any) {
        console.log("DemoRoom created!", options);

        this.nbTirage = 0;
        this.serverTirageData = {};
        this.nbQueueReady = 0;
        this.serverQueueData = {};
        this.maxClients = 3;
        this.serverIDsData = {};
        this.spectatorIDs = {};
        this.nbIDs = 0;
        this.playerIDConcede = 0;
        this.setPatchRate(1000 / 20);
        this.setSimulationInterval((dt) => this.update(dt));
        this.resendDataTry = 0;
        //console.log("options.creator : "+options.creator);
        //this.setMetadata({creator:options.creator});
        this.setMetadata({test: "test"});
        this.game_id = this.roomId;
        this.someoneConcede = "false";
        this.LobbyClients = [];
        this.isgameStarted = false;
    }


    findOpponentID(idJ1: any) {
        var oponnentID: string = "";
        this.clients.forEach(function (client) {
            if (client.id != idJ1)
                oponnentID = client.id;
        });
        return oponnentID;
    }

    getPlayerIDInLobbyByClientID(clientId: string) {
        var tmp = 0;
        this.LobbyClients.forEach(function (item) {
            if (item.clientID == clientId)
                tmp = item.clientPlayerID;
        });
        console.log("getPlayerIDInLobbyByClientID :", tmp);
        return tmp;
    }

    isCurrentClienHost(clientId: string) {
        var tmp = false;
        this.LobbyClients.forEach(function (item) {
            if (item.isHost == true && item.clientID == clientId)
                tmp = true;
        });
        console.log("isCurrentClienHost :", tmp);
        return tmp;
    }

    isCurrentClientSpectator(clientId: string) {
        var tmp = false;
        this.LobbyClients.forEach(function (item) {
            if (item.role == "Spectator" && item.clientID == clientId)
                tmp = true;
        });
        console.log("isCurrentClientSpectator :", tmp);
        return tmp;
    }

    getPlayerIdFromSessionID(sessionId: string) {
        if (this.serverIDsData["C1"] == sessionId)
            return this.serverIDsData["playerIDC1"];
        if (this.serverIDsData["C2"] == sessionId)
            return this.serverIDsData["playerIDC2"]
        else return -1;
    }

    getOpponentPlayerIdFromSessionID(sessionId: string) {
        if (this.serverIDsData["C2"] == sessionId)
            return this.serverIDsData["playerIDC1"];
        if (this.serverIDsData["C1"] == sessionId)
            return this.serverIDsData["playerIDC2"]
        else return -1;
    }

    isClientChallenger(sessionId: string) {
        var isChall = false;
        if (this.serverIDsData["C1"] == sessionId)
            isChall = true;
        if (this.serverIDsData["C2"] == sessionId)
            isChall = true;

        return isChall
    }

    sendErrorMessage(client: any, error_type: string, error_datas: any) {
        this.send(client, {
            type: "DemoRoom - serverError",
            error_type: error_type,
            error_datas: error_datas
        });
    }

    /*requestJoin(options:any) {
     console.log("request join!", options);
     return true;
     }*/

    requestJoin(options, isNewRoom: boolean) {
        return (options.create)
            ? (options.create && isNewRoom)
            : this.clients.length > 0;
    }


    onJoin(client: Client, options: any, user: any) {
        console.log("client joined!", client.sessionId);
        //this.broadcastLobbyDatasToAllPlayers();
    }

    async onLeave(client: Client, consented: boolean) {

        try {
            if (consented && this.isgameStarted == true) {
                throw new Error("consented leave!");
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.getPlayerIdFromSessionID(client.id),
                });
                this.playerIDConcede = {};
            }
            if (this.isgameStarted == false) {
                throw new Error("Leave Lobby");
                this.removeClientFromLobbyClientsBySessionID(client.id);
            }

            console.log("let's wait for reconnection!")
            const newClient = await this.allowReconnection(client, 0); //a changer pour permettre un timming de reco
            console.log("reconnected!", newClient.sessionId);

        } catch (e) {
            console.log("disconnected!", client.sessionId);
            //déconnection involontaire - On concede pour le moment
            if (this.isgameStarted == false && this.isCurrentClienHost(client.id)) {
                console.log("Host quitted the Lobby");
                this.kickAllFromLobby();
            }
            if (this.isgameStarted == false) {
                this.removeClientFromLobbyClientsBySessionID(client.id);
            }
            if (consented && this.isgameStarted == true) {
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.getPlayerIdFromSessionID(client.id),
                });
                this.playerIDConcede = {};
            }
        }
    }


    onMessage(client: Client, data: any) {
        console.log(data, "received from", client.sessionId);
        console.log(data.type, " is type");

        successlog.info("roomId : " + this.roomId, data, "received from", client.sessionId);

        if (data.type === "chat") {
            console.log("Chat : " + data.message);
            this.broadcast({type: "chat", message: "this is a chat message from server"});
        }

        if (data.type === "sendPlayerIdToServer") {

            if (data.PlayerID != null && data.PlayerID != 0) {

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
                    this.serverIDsData["deckIDC1"] = data.deckID;
                    console.log("C1 : " + this.serverIDsData["C1"]);
                } else if (this.nbIDs == 2) {
                    console.log("There is two Challenger");
                    this.serverIDsData["C2"] = client.id;
                    this.serverIDsData["playerIDC2"] = data.PlayerID;
                    this.serverIDsData["clientC2"] = client;
                    this.serverIDsData["deckIDC2"] = data.deckID;

                    console.log("C2 : " + this.serverIDsData["C2"]);

                    //console.log("Server nbIDs : %o",this.serverIDsData);

                    //var encoded_rolls = JSON.stringify(this.serverTirageData);

                    this.broadcast({
                        type: "playerIDFromServer",
                        C1: this.serverIDsData["C1"],
                        C2: this.serverIDsData["C2"],
                        playerIDC1: this.serverIDsData["playerIDC1"],
                        playerIDC2: this.serverIDsData["playerIDC2"],
                        deckIDC1: this.serverIDsData["deckIDC1"],
                        deckIDC2: this.serverIDsData["deckIDC2"]
                    });
                    this.nbIDs = 0;
                    var date = new Date();
                    var formatted_date = new Intl.DateTimeFormat('fr-FR').format(date);
                    try {
                        this.recordGameCreation(this.game_id, this.serverIDsData["playerIDC1"], this.serverIDsData["playerIDC2"], 0, 0, formatted_date);
                    } catch (e) {

                    }
                    //this.serverIDsData = {};
                }
            } else {
                this.resendDataTry++;
                if (this.resendDataTry <= 5) {
                    var error_datas = {};
                    error_datas["data_name"] = "playerID";
                    error_datas["reason"] = "void";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                } else {
                    console.log("No playerID - Disconnecting player");
                }

            }
        }
        if (data.type === "iConcedeTheGame") {
            if (this.isClientChallenger(client.id)) {

                this.playerIDConcede = data.PlayerID;
                this.someoneConcede = "true";
                console.log("id concede : " + this.playerIDConcede);
                this.broadcast({
                    type: "idConcedeFromServ",
                    playerIDConcede: this.playerIDConcede,
                });
                console.log("gonna call : updateGameEnd");
                //this.updateGameEnd(this.getOpponentPlayerIdFromSessionID(client.id), 0,0,10,'true');
                this.playerIDConcede = {};
            }
        }
        if (data.type === "askServerForTirage") {


            if (this.isClientChallenger(client.id)) {

                //console.log("askServerForTirage : " + data.message);
                //console.log("askServerForTirage dicesPossibilitiesJsoned : " + data.dicesPossibilitiesJsoned); // GOOD
                var dicesStates = [];

                try {
                    dicesStates = JSON.parse(data.states);
                } catch (e) {

                    dicesStates = [];
                    this.resendDataTry++;
                    console.log("PARSE ERROR - dicesStates not valid JSON resendDataTry = " + this.resendDataTry);
                }

                if (dicesStates.length <= 0 && this.resendDataTry > 5) {
                    console.log("Default tirage");
                    queue = [0, 0, 0, 0, 0];
                } else if (dicesStates.length <= 0) {
                    var error_datas = {};
                    error_datas["data_name"] = "dicesStates";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                //var dicesStates = JSON.parse(data.states);
                if (dicesStates.length > 0) {

                    this.resendDataTry = 0;

                    var arrayOfPossibilities = []; // est-ce que c'est une bonne idée de reset ici ?
                    arrayOfPossibilities = JSON.parse(data.dicesPossibilitiesJsoned);    
                    
                    /* OLD VERSION
                    var rnd1 = Math.floor(Math.random() * 6) + 1;
                    var rnd2 = Math.floor(Math.random() * 6) + 1;
                    var rnd3 = Math.floor(Math.random() * 6) + 1;
                    var rnd4 = Math.floor(Math.random() * 6) + 1;
                    var rnd5 = Math.floor(Math.random() * 6) + 1;
                    */

                    console.log("SIZE OF possibilities : "+arrayOfPossibilities[0].length + " - " + arrayOfPossibilities[1].length + " - " + arrayOfPossibilities[2].length + " - " + arrayOfPossibilities[3].length + " - " + arrayOfPossibilities[4].length);


                    var rnd1PosInArray = Math.floor(Math.random() * Math.floor(arrayOfPossibilities[0].length));
                    var rnd2PosInArray = Math.floor(Math.random() * Math.floor(arrayOfPossibilities[1].length));
                    var rnd3PosInArray = Math.floor(Math.random() * Math.floor(arrayOfPossibilities[2].length));
                    var rnd4PosInArray = Math.floor(Math.random() * Math.floor(arrayOfPossibilities[3].length));
                    var rnd5PosInArray = Math.floor(Math.random() * Math.floor(arrayOfPossibilities[4].length));

                    console.log("TIRAGES : "+rnd1PosInArray + " - " + rnd2PosInArray + " - " + rnd3PosInArray + " - " + rnd4PosInArray + " - " + rnd5PosInArray);


                    if (dicesStates[0] == 0 || arrayOfPossibilities[0].length <= 0)
                        arrayOfPossibilities[0][rnd1PosInArray] = 0;
                    if (dicesStates[1] == 0 || arrayOfPossibilities[1].length <= 0)
                        arrayOfPossibilities[1][rnd2PosInArray] = 0;
                    if (dicesStates[2] == 0 || arrayOfPossibilities[2].length <= 0)
                        arrayOfPossibilities[2][rnd3PosInArray] = 0;
                    if (dicesStates[3] == 0 || arrayOfPossibilities[3].length <= 0)
                        arrayOfPossibilities[3][rnd4PosInArray] = 0;
                    if (dicesStates[4] == 0 || arrayOfPossibilities[4].length <= 0)
                        arrayOfPossibilities[4][rnd5PosInArray] = 0;
                    


                    if (this.serverTirageData["idT1"] != client.id) //petit bout de code pour savoir si c'est le premier ou 2eme qui demande un tirage
                        this.nbTirage += 1;

                    if (this.nbTirage == 1) {
                        console.log("Player pos 1 ask for roll");
                        this.serverTirageData["idT1"] = client.id;
                        this.serverTirageData["tirageT1"] = [arrayOfPossibilities[0][rnd1PosInArray], arrayOfPossibilities[1][rnd2PosInArray], arrayOfPossibilities[2][rnd3PosInArray], arrayOfPossibilities[3][rnd4PosInArray], arrayOfPossibilities[4][rnd5PosInArray]];
                    } else if (this.nbTirage == 2) {
                        console.log("Player pos 2 ask for roll");
                        this.serverTirageData["idT2"] = client.id;
                        this.serverTirageData["tirageT2"] = [arrayOfPossibilities[0][rnd1PosInArray], arrayOfPossibilities[1][rnd2PosInArray], arrayOfPossibilities[2][rnd3PosInArray], arrayOfPossibilities[3][rnd4PosInArray], arrayOfPossibilities[4][rnd5PosInArray]];

                        console.log("Server tirage : %o", this.serverTirageData);
                        console.log("Server tirage T1 : %o", this.serverTirageData["tirageT1"]);


                        try {
                            this.recordTirage(this.game_id, JSON.stringify(this.serverTirageData["tirageT1"]), this.serverTirageData["tirageT1"][0], JSON.stringify(this.serverTirageData["tirageT2"]), this.serverTirageData["tirageT2"][0]);
                        } catch (e) {

                        }
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

            if (this.isClientChallenger(client.id)) {

                var senderPlayerId = client.id; // get sender's playerID
                var queueJson = data.queue;

                var queue = [];

                try {
                    queue = JSON.parse(queueJson);
                } catch (e) {

                    queue = [];
                    this.resendDataTry++;
                    console.log("PARSE ERROR - Queue not valid JSON resendDataTry = " + this.resendDataTry);
                }

                if (queue.length <= 0 && this.resendDataTry > 5) {
                    console.log("Default queue");
                    queue = [1, 2, 3, 4, 5];
                } else if (queue.length <= 0) {
                    var error_datas = {};
                    error_datas["data_name"] = "queue";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                console.log("Queue = %o", queue);
                if (queue.length > 0) {

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

                        try {
                            this.recordSpellOrder(this.game_id, JSON.stringify(this.serverQueueData["QueueT1"]), JSON.stringify(this.serverQueueData["QueueT2"]));
                        } catch (e) {

                        }
                        this.nbQueueReady = 0;
                        this.serverQueueData = {};
                    }
                }

            }

        }
        if (data.type === "sendTargets") {
            if (this.isClientChallenger(client.id)) {
                console.log("inside sendTargets");
                console.log("target : " + data.targets);

                var targets = null;

                try {
                    targets = JSON.parse(data.targets);
                } catch (e) {
                    this.resendDataTry++;
                    console.log("PARSE ERROR - Target not valid JSON resendDataTry = " + this.resendDataTry);
                }
                var launched = "none";
                if (targets.launching != null && targets.launching == true)
                    launched = "true";
                else if (targets.launching != null && targets.launching == false)
                {
                    launched = "false";
                    
                }
                var faceUsageID = Date.now();

                try {
                    this.recordFaceUsage(data.facId, this.getPlayerIdFromSessionID(client.id), this.game_id, 0, launched, faceUsageID);
                } catch (e) {

                }

                if (targets == null && this.resendDataTry > 5) {
                    console.log("Default Target");

                    try {
                        this.recordTarget(this.game_id, faceUsageID, this.getPlayerIdFromSessionID(client.id), "default", -1, -1);
                    } catch (e) {

                    }
                    data.targets = '{"launching":false,"targets":[]}';
                } else if (targets == null) {
                    var error_datas = {};
                    error_datas["data_name"] = "targets";
                    error_datas["reason"] = "ParseError";
                    this.sendErrorMessage(client, "DataSentError", JSON.stringify(error_datas));
                }

                if (targets != null) {
                    for (var i = 0; i < targets.targets.length; i++) {
                        try {
                            this.recordTarget(this.game_id, faceUsageID, this.getPlayerIdFromSessionID(client.id), targets.targets[i]._type, targets.targets[i]._playerPosition, targets.targets[i]._itemPosition);
                        } catch (e) {

                        }
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
        if (data.type === "readyBtnClicked") {
            if (this.isClientChallenger(client.id)) {
                console.log("inside readyBtnClicked");
                this.broadcast({type: "readyBtnClicked", idSender: this.getPlayerIdFromSessionID(client.id)}, {except: client});
            }
        }
        if (data.type === "readyQueueBtnClicked") {
            if (this.isClientChallenger(client.id)) {
                console.log("inside readyQueueBtnClicked");
                this.broadcast({type: "readyQueueBtnClicked", idSender: this.getPlayerIdFromSessionID(client.id)}, {except: client});
            }
        }
        if (data.type === "sendLastHoveredItem") {
            if (this.isClientChallenger(client.id)) {
                this.broadcast({
                    type: "lastHoveredItemFromServer",
                    idSender: this.getPlayerIdFromSessionID(client.id),
                    item: data.item,
                }, {except: client});
            }
        }
        if (data.type == "registerAsSpectator") {
            this.spectatorIDs[client.id] = client;
            this.send(client, {
                type: "registeredAsSpectator",
                C1: this.serverIDsData["C1"],
                C2: this.serverIDsData["C2"],
                playerIDC1: this.serverIDsData["playerIDC1"],
                playerIDC2: this.serverIDsData["playerIDC2"],
                deckIDC1: this.serverIDsData["deckIDC1"],
                deckIDC2: this.serverIDsData["deckIDC2"],
                idSender: this.getPlayerIdFromSessionID(client.id)
            });
        }
        // NOT USED
        if (data.type == "askGameStateDatas") {
            console.log("inside askGameStateDatas");
            this.send(this.serverIDsData["clientC1"], {
                type: "GameStateDatasAsked",
                askedBy: client.id
            });
        }
        // NOT USED
        if (data.type == "sendGameStateDatasTo") {
            console.log("inside sendGameStateDatasTo");
            console.log("GameStateDatas : " + data.GameStateDatas);
            this.send(this.spectatorIDs[data.SpectatorId], {
                type: "gameStateFromServer",
                GameState: data.GameStateDatas,
                idSender: this.getPlayerIdFromSessionID(client.id)
            });
        }
        if (data.type == "sendInitTourEvent") {
            console.log("inside sendInitTourEvent");
            this.broadcast({
                type: "initTourEvent"
            });
        }
        if (data.type == "AskForContemplationEvent") {
            console.log("inside AskForContemplationEvent");
            this.broadcast({
                type: "contemplationEvent",
            }, {except: client});
        }
        if (data.type == "sendSwapDiceEvent") {
            console.log("inside sendSwapDiceEvent");
            this.broadcast({
                idSender: this.getPlayerIdFromSessionID(client.id),
                type: "swapDiceEvent"
            });
        }
        if (data.type == "sendRerollCardClicked") {
            console.log("inside sendRerollCardClicked");
            this.broadcast({
                idSender: this.getPlayerIdFromSessionID(client.id),
                type: "sendRerollCardClicked"
            });
        }
        if (data.type == "sendManaCardClicked") {
            console.log("inside sendManaCardClicked");
            this.broadcast({
                idSender: this.getPlayerIdFromSessionID(client.id),
                type: "sendManaCardClicked"
            });
        }
        if (data.type == "sendIdOfGods") {
            console.log("inside sendIdOfGods");
            this.updateGameCreationWithGods(data.godPlayer1, data.godPlayer2);
        }
        if (data.type == "SendReadyStatus") {
            console.log("inside SendReadyStatus");

            var allPlayersReady = true;
            this.LobbyClients.forEach(function (item) {
                if (item.clientPlayerID == data.PlayerID) {
                    item.status = "Ready";
                }
                if (item.status != "Ready") {
                    allPlayersReady = false;
                }
            })

            if (allPlayersReady) {
                this.broadcast({
                    type: "allPlayersReadyFromServer"
                });
            }
        }
        if (data.type == "infoAboutEndGame") {
            console.log("inside infoAboutEndGame");
            if (this.someoneConcede == "true")
                this.updateGameEnd(data.winner_player_id, data.end_hp_player1, data.end_hp_player2, data.totalTour, "true");
            else
                this.updateGameEnd(data.winner_player_id, data.end_hp_player1, data.end_hp_player2, data.totalTour, "false");
        }
        if (data.type == "hostingRoom") {
            console.log("inside hostingRoom");
            this.addANewPlayerInLobbyClientsList(data.hostOfTheRoom, client.id);
            this.broadcastLobbyDatasToAllPlayers();
        }
        if (data.type == "someoneJoinTheRoom") {
            console.log("inside someoneJoinTheRoom");
            this.addANewPlayerInLobbyClientsList(data.someoneJoinTheRoom, client.id);
            this.broadcastLobbyDatasToAllPlayers()
        }
        if (data.type == "someoneChangeHisRole") {
            console.log("inside someoneChangeHisRole - data.PlayerID : "+data.playerID +" - data.role :"+data.role + " client.id : "+client.id);
            this.changeRoleOfThePlayer(data.playerID, data.role, client.id);
        }
        if (data.type == "kickPlayerFromLobby") {
            console.log("inside kickPlayerFromLobby");
            this.kickPlayerFromLobby(data.kickedClientID, client.id);
        }
        if (data.type == "hostStartLobby") {
            console.log("inside hostStartLobby");
            this.hostStartLobby();
        }
        if (data.type == "sendDecisionOfEqualityOfVelocity") {
            console.log("inside sendDecisionOfEqualityOfVelocity");
            //console.log("decision : "+data.decision);
            this.broadcast({
                    type: "sendDecisionOfEqualityOfVelocityFromServer",
                    decision: data.decision,
                }, {except: client});
            this.send(client,
                {
                    type: "PlayerDecisionOfEqualityOfVelocityAuthorization",
                    idSender: this.getPlayerIdFromSessionID(client.id),
                    decision: data.decision,
                    //targets: data.targets,
                }
            )
        }
    }




    /* */

    /* LOBBY FUNCTIONS */

    broadcastLobbyDatasToAllPlayers() {
        console.log("broadcastLobbyDatasToAllPlayers : %o", JSON.stringify(this.LobbyClients));
        this.broadcast({
            LobbyClients: JSON.stringify(this.LobbyClients),
            RoomID: this.game_id,
            type: "broadcastLobbyDatasToAllPlayers"
        });
    }

    changeRoleOfThePlayer(playerID: any, role: string, clientID: string) {
        var fromAdmin = this.isCurrentClienHost(clientID);

        console.log("inside changeRoleOfThePlayer - playerID : "+playerID, " - clientID : "+clientID);
        if (playerID == this.getPlayerIDInLobbyByClientID(clientID) || fromAdmin) {
            this.LobbyClients.forEach(function (item) {
                if (item.clientPlayerID == playerID) {
                    item.role = role;
                    console.log("Changing role of : "+playerID+" to "+role);
                }
            });
            this.broadcastLobbyDatasToAllPlayers();
        }
    }

    addANewPlayerInLobbyClientsList(player: any, clientID: any) {
        let tmp = new LobbyClient(clientID, player._clientName, player._clientPlayerID, player._status, player._role, player._isHost);
        this.LobbyClients.push(tmp);
    }

    removeClientFromLobbyClientsBySessionID(clientID: string) {
        this.LobbyClients.forEach(function (item, index, object) {
            if (item.clientID == clientID) {
                object.splice(index, 1);
            }
        });
        this.broadcastLobbyDatasToAllPlayers();
    }

    hostStartLobby()
    {
        this.isgameStarted = true;
        this.broadcast({
            LobbyClients: JSON.stringify(this.LobbyClients),
            RoomID: this.game_id,
            type: "SendLobbyGameStart"
        });
    }

    kickAllFromLobby()
    {
        console.log("kickAllFromLobby");
        if(this.isgameStarted == false)
        {
            this.broadcast({
                RoomID: this.game_id,
                type: "SendHostLeaveLobby",
            });
        }
        var room = this;
        setTimeout(function()
        {
            room.disconnect();
        },5000);
    }

    kickPlayerFromLobby(kickedClientID: string, clientID: string) {
        var fromAdmin = this.isCurrentClienHost(clientID);

        if (fromAdmin) {
            this.removeClientFromLobbyClientsBySessionID(kickedClientID);
        }
        this.broadcastLobbyDatasToAllPlayers()
    }

    update(dt?: number) {
        // console.log("num clients:", Object.keys(this.clients).length);
    }

    onDispose() {
        console.log("disposing DemoRoom...");
        this.kickAllFromLobby();
    }


    /* SQL FUNCTIONS */

    recordFaceUsage(face_id: number, player_id: number, game_id: any, tour_number: number, launched: string, date: number) {
        var retured = 0;
        const face = {face_id: face_id, player_id: player_id, game_id: game_id, tour_number: tour_number, launched: launched, date: date};
        connexion.query('INSERT INTO stats_face_usage SET ?', face, (err, res) => {
            if (err) {
                throw err;
            }
            retured = res.insertId;
        });
        return retured;
    }

    recordGameCreation(game_id: number, player_1_id: number, player_2_id: number, god_player_1: number, god_player_2: number, date: any) {

        const game = {game_id: game_id, player_1_id: player_1_id, player_2_id: player_2_id, god_player_1: god_player_1, god_player_2: god_player_2, date: date};
        connexion.query('INSERT INTO stats_game SET ?', game, (err, res) => {
            if (err) throw err;

        });
    }

    recordTarget(game_id: number, launch_id: number, player_launcher_id: number, target_type: string, target_player_pos: number, target_item_pos: number) {
        const target = {
            game_id: game_id,
            launch_id: launch_id,
            player_launcher_id: player_launcher_id,
            target_type: target_type,
            target_player_pos: target_player_pos,
            target_item_pos: target_item_pos
        };
        connexion.query('INSERT INTO stats_target SET ?', target, (err, res) => {
            if (err) throw err;

        });
    }

    recordTirage(game_id: number, tirage_player_1: any, mana_player_1: number, tirage_player_2: any, mana_player_2: number) {
        const tirage = {game_id: game_id, tirage_player_1: tirage_player_1, mana_player_1: mana_player_1, tirage_player_2: tirage_player_2, mana_player_2: mana_player_2};
        connexion.query('INSERT INTO stats_tirage SET ?', tirage, (err, res) => {
            if (err) throw err;

        });
    }

    recordSpellOrder(game_id: number, order_player_1: any, order_player_2: any) {
        const order = {game_id: game_id, order_player_1: order_player_1, order_player_2: order_player_2};
        connexion.query('INSERT INTO stats_spell_order SET ?', order, (err, res) => {
            if (err) throw err;

        });
    }

    updateGameCreationWithGods(god_player_1: number, god_player_2: number) {
        connexion.query("UPDATE stats_game SET god_player_1 = ?, god_player_2 = ? WHERE game_id = ?",
            [god_player_1, god_player_2, this.game_id], (err, res) => {
                if (err) {
                    console.log("err : %o ", err);
                    throw err;
                }
                console.log(`Changed ${res.changedRows} row(s)`);
            });
    }


    updateGameEnd(winner_player_id: any, end_hp_player_1: number, end_hp_player_2: number, total_tour: number, conceded: any) {

        connexion.query("UPDATE stats_game SET winner_player_id = ?, end_hp_player_1 = ?, end_hp_player_2 = ?, total_tour = ?, conceded = ? WHERE game_id = ?",
            [winner_player_id, end_hp_player_1, end_hp_player_2, total_tour, conceded, this.game_id], (err, res) => {
                if (err) {
                    console.log("err : %o ", err);
                    throw err;
                }
                console.log(`Changed ${res.changedRows} row(s)`);
            });
    }
}
