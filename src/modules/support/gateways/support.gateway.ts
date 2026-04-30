import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'support',
})
@Injectable()
export class SupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to support: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from support: ${client.id}`);
  }

  @SubscribeMessage('joinTicket')
  async handleJoinTicket(client: Socket, ticketId: string) {
    await client.join(ticketId);
    this.logger.log(`Client ${client.id} joined ticket room ${ticketId}`);
    return { event: 'joined', data: ticketId };
  }

  @SubscribeMessage('leaveTicket')
  async handleLeaveTicket(client: Socket, ticketId: string) {
    await client.leave(ticketId);
    this.logger.log(`Client ${client.id} left ticket room ${ticketId}`);
    return { event: 'left', data: ticketId };
  }

  broadcastNewMessage(ticketId: string, messageData: any) {
    this.server.to(ticketId).emit('newMessage', messageData);
  }
}
