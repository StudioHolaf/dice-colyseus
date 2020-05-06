
export class LobbyClient {

    clientID:number;
    clientName:any;
    clientPlayerID:any;
    status:any;
    isHost:boolean;


    constructor (number: clientID, any: clientName, any:clientPlayerID, any:status, boolean:isHost) {
	 this.clientID = clientID;
	 this.clientName = clientName;
	 this.clientPlayerID = clientPlayerID;
	 this.status = status;
	 this.isHost = isHost;
	}
}
