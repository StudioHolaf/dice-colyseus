
export class LobbyClient {

    public clientID:any;
    public clientName:string;
    public clientPlayerID:number;
    public status:string;
    public isHost:boolean;

    constructor (clientID: any, clientName: string, clientPlayerID: number, status: string, isHost: boolean) {
	 this.clientID = clientID;
	 this.clientName = clientName;
	 this.clientPlayerID = clientPlayerID;
	 this.status = status;
	 this.isHost = isHost;
	}
}
