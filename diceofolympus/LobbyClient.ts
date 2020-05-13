
export class LobbyClient {

    public clientID:any;
    public clientName:any;
    public clientPlayerID:any;
    public status:any;
    public isHost:boolean;

    constructor (clientID: any, clientName: any, clientPlayerID: any, status: any, isHost: boolean) {
	 this.clientID = clientID;
	 this.clientName = clientName;
	 this.clientPlayerID = clientPlayerID;
	 this.status = status;
	 this.isHost = isHost;
	}
}
