import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('EventsGateway');

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('EventsGateway Initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers['authorization']?.split(' ')[1];
      if (token) {
        const payload = this.jwtService.verify(token);
        client.data.user = payload;
        // Automatically join the user to their own private room
        const userId = payload.sub || payload.id;
        client.join(`user_${userId}`);
        this.logger.log(`Client connected and joined user_${userId}: ${client.id}`);
      } else {
        // Optionally allow unauthenticated connections, but log them
        this.logger.log(`Unauthenticated client connected: ${client.id}`);
      }
    } catch (err) {
      this.logger.warn(`Client connection auth failed: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinServiceRoom')
  handleJoinServiceRoom(@MessageBody('serviceId') serviceId: string, @ConnectedSocket() client: Socket) {
    const room = `service_${serviceId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joinedRoom', data: room };
  }

  @SubscribeMessage('leaveServiceRoom')
  handleLeaveServiceRoom(@MessageBody('serviceId') serviceId: string, @ConnectedSocket() client: Socket) {
    const room = `service_${serviceId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'leftRoom', data: room };
  }

  // --- Broadcast Methods for Services to Call ---

  broadcastToUser(userId: string, event: string, data: any) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  broadcastToService(serviceId: string, event: string, data: any) {
    this.server.to(`service_${serviceId}`).emit(event, data);
  }
}
