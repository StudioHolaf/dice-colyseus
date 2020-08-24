
export class LobbyClient {

    public clientID:string;
    public clientName:string;
    public clientPlayerID:number;
    public status:string;
    public role:string;
    public isHost:boolean;

    constructor (clientID: string, clientName: string, clientPlayerID: number, status: string, role: string, isHost: boolean) {
	 this.clientID = clientID;
	 this.clientName = clientName;
	 this.clientPlayerID = clientPlayerID;
	 this.status = status; //ai-je terminé le chargement de la scène.
	 this.role = role; // obs ou player
	 this.isHost = isHost;
	}
}
