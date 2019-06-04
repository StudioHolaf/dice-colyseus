import { Room, Client, generateId } from "colyseus";
//import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
//import { verifyToken, User, IUser } from "@colyseus/social";

export class DemoRoom extends Room {

  onInit (options: any) {
    console.log("DemoRoom created!", options);
    
    this.setPatchRate(1000 / 20);
    this.setSimulationInterval((dt) => this.update(dt));
  }

  requestJoin (options: any) {
    console.log("request join!", options);
    return true;
  }

  onJoin (client: Client, options: any, user: IUser) {
    console.log("client joined!", client.sessionId);
  }

  async onLeave (client: Client, consented: boolean) {
    
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

  onMessage (client: Client, data: any) {
    console.log(data, "received from", client.sessionId);
    console.log(data.type, " is type");

    if (data.type === "chat") {
      console.log("Chat : "+data.message);
      this.broadcast({ type: "chat", message: "this is a chat message from server" });
    }

  }

  update (dt?: number) {
    // console.log("num clients:", Object.keys(this.clients).length);
  }

  onDispose () {
    console.log("disposing DemoRoom...");
  }

}
