// 主机信息类型
export interface HostInfo {
  platform?: 'pc' | 'android' | 'dev' | 'unknown';
  ip: string;
  lanIp?: string;
  port: number;
  name: string;
  hostName?: string;
  localUrl?: string;
  joinUrl?: string;
  wsUrl?: string;
  qrText?: string;
  gameMode: string;
  playerCount: number;
  maxPlayers?: number;
  startedAt?: number;
}

// 检测是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 局域网发现服务
export class LANDiscovery {
  private static readonly BROADCAST_PORT = 41234;
  private static readonly BROADCAST_INTERVAL = 2000;
  private static readonly BROADCAST_MESSAGE = 'LIARS_BAR_HOST_DISCOVERY';
  private static server: any = null;
  private static broadcastInterval: NodeJS.Timeout | null = null;

  // 广播主机存在
  static broadcastPresence(port: number, hostName: string = 'Liar\'s Bar Host'): void {
    if (isBrowser) {
      console.warn('LAN discovery not supported in browser');
      return;
    }
    
    try {
      const dgram = require('dgram');
      const server = dgram.createSocket('udp4');
      
      server.bind(() => {
        server.setBroadcast(true);
      });

      this.broadcastInterval = setInterval(() => {
        const message = JSON.stringify({
          type: this.BROADCAST_MESSAGE,
          port,
          name: hostName,
          timestamp: Date.now()
        });

        server.send(
          message,
          0,
          message.length,
          this.BROADCAST_PORT,
          '255.255.255.255',
          (err: any) => {
            if (err) {
              console.error('Broadcast error:', err);
            }
          }
        );
      }, this.BROADCAST_INTERVAL);

      this.server = server;
    } catch (error) {
      console.error('Failed to start broadcast:', error);
    }
  }

  // 监听局域网内的主机广播
  static listenForHosts(callback: (hostInfo: HostInfo) => void): void {
    if (isBrowser) {
      console.warn('LAN discovery not supported in browser');
      return;
    }
    
    try {
      const dgram = require('dgram');
      const server = dgram.createSocket('udp4');

      server.on('error', (err: any) => {
        console.error('UDP server error:', err);
        server.close();
      });

      server.on('message', (msg: Buffer, rinfo: any) => {
        try {
          const message = JSON.parse(msg.toString());
          if (message.type === this.BROADCAST_MESSAGE) {
            const hostInfo: HostInfo = {
              ip: rinfo.address,
              port: message.port,
              name: message.name || 'Unknown Host',
              gameMode: 'liarsBar', // 默认游戏模式
              playerCount: 0 // 默认玩家数量
            };
            callback(hostInfo);
          }
        } catch {
          // 忽略无效消息
        }
      });

      server.bind(this.BROADCAST_PORT, () => {
        console.log('Listening for host broadcasts on port', this.BROADCAST_PORT);
      });

      this.server = server;
    } catch (error) {
      console.error('Failed to start listener:', error);
    }
  }

  // 停止广播
  static stopBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  // 停止监听
  static stopListening(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
