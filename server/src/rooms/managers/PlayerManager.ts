import { Client } from "colyseus";
import { Player } from "../schema/GameState";
import { GameRoom } from "../GameRoom";
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_COLORS } from "../constants";

export class PlayerManager {
  private room: GameRoom;

  constructor(room: GameRoom) {
    this.room = room;
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!", "Nickname:", options?.nickname);

    const player = new Player();
    player.nickname = options?.nickname || "Unknown";
    player.x = Math.random() * MAP_WIDTH;
    player.y = Math.random() * MAP_HEIGHT;
    player.targetX = player.x;
    player.targetY = player.y;
    player.hp = 100;
    player.maxHp = 100;

    player.color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

    this.room.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented?: boolean) {
    console.log(client.sessionId, "left!");
    this.room.state.players.delete(client.sessionId);
  }

  handleMove(client: Client, message: { x: number, y: number }) {
    const player = this.room.state.players.get(client.sessionId);
    if (player) {
      player.targetX = message.x;
      player.targetY = message.y;
    }
  }

  handleUpgrade(client: Client, message: { stat: string }) {
    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.levelUpsPending <= 0) return;

    this.applyUpgrade(player, message.stat);
    player.levelUpsPending--;
  }

  applyUpgrade(player: Player, stat: string) {
    if (stat === "damage") {
      player.damage += 5;
    } else if (stat === "attackSpeed") {
      player.attackSpeed = Math.max(100, player.attackSpeed - 100);
    } else if (stat === "range") {
      player.range += 500;
    } else if (stat === "speed") {
      player.speed += 20;
    } else if (stat === "maxHp") {
      player.maxHp += 20;
      player.hp += 20;
    } else if (stat === "magnetRadius") {
      player.magnetRadius += 30;
    } else if (stat === "shotgunLevel") {
      player.shotgunLevel += 1;
    } else if (stat === "bulletSize") {
      player.bulletSize += 0.3;
    }
  }

  update(dtSeconds: number) {
    this.room.state.players.forEach((player: Player) => {
      // -- 이동 로직 --
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        const vx = (dx / distance) * player.speed;
        const vy = (dy / distance) * player.speed;
        player.x += vx * dtSeconds;
        player.y += vy * dtSeconds;
      }

      // -- 맵 바운더리 검사 --
      player.x = Math.max(0, Math.min(player.x, MAP_WIDTH));
      player.y = Math.max(0, Math.min(player.y, MAP_HEIGHT));
    });
  }
}
