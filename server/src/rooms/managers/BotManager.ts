import { GameRoom } from "../GameRoom";
import { Player, Orb } from "../schema/GameState";
import { MAP_WIDTH, MAP_HEIGHT, BOT_NAMES, PLAYER_COLORS, STATS_POOL } from "../constants";

export class BotManager {
  private room: GameRoom;

  constructor(room: GameRoom) {
    this.room = room;
  }

  startSpawnTimer() {
    this.room.clock.setInterval(() => {
      const MAX_TOTAL_ENTITIES = 8;
      const currentTotal = this.room.state.players.size;

      if (currentTotal < MAX_TOTAL_ENTITIES) {
        this.spawnBot();
      }
    }, 5000);
  }

  spawnBot() {
    const botId = `bot_${this.room.generateId()}`;
    const bot = new Player();

    bot.nickname = "AI " + BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    bot.isBot = true;
    bot.x = Math.random() * MAP_WIDTH;
    bot.y = Math.random() * MAP_HEIGHT;
    bot.targetX = bot.x;
    bot.targetY = bot.y;
    bot.hp = 100;
    bot.maxHp = 100;

    bot.color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

    this.room.state.players.set(botId, bot);
    console.log("Spawned Bot:", bot.nickname, botId);
  }

  update() {
    this.room.state.players.forEach((player: Player, sessionId: string) => {
      if (!player.isBot) return;

      // 1. 이동 대상 탐색 (구슬 우선, 없으면 방황)
      const distToTarget = Math.sqrt(Math.pow(player.targetX - player.x, 2) + Math.pow(player.targetY - player.y, 2));

      if (distToTarget < 50 || Math.random() < 0.01) {
        let nearestOrb: Orb | null = null;
        let minDist = 600;

        this.room.state.orbs.forEach((orb: Orb) => {
          const d = Math.sqrt(Math.pow(orb.x - player.x, 2) + Math.pow(orb.y - player.y, 2));
          if (d < minDist) {
            minDist = d;
            nearestOrb = orb;
          }
        });

        if (nearestOrb) {
          player.targetX = (nearestOrb as Orb).x;
          player.targetY = (nearestOrb as Orb).y;
        } else {
          if (distToTarget < 50) {
            player.targetX = Math.random() * MAP_WIDTH;
            player.targetY = Math.random() * MAP_HEIGHT;
          }
        }
      }

      // 2. 조준 대상 탐색 (이동과는 독립적으로 수행)
      let nearestEnemy: Player | null = null;
      let minPlayerDist = 600;

      this.room.state.players.forEach((p, sid) => {
        if (sid === sessionId) return;
        const d = Math.sqrt(Math.pow(p.x - player.x, 2) + Math.pow(p.y - player.y, 2));
        if (d < minPlayerDist) {
          minPlayerDist = d;
          nearestEnemy = p;
        }
      });

      if (nearestEnemy && Math.random() < 0.2) {
        const enemy = nearestEnemy as Player;
        const errorX = (Math.random() - 0.5) * 120;
        const errorY = (Math.random() - 0.5) * 120;

        player.targetX = enemy.x + errorX;
        player.targetY = enemy.y + errorY;
      }

      // 3. 자동 레벨업
      if (player.levelUpsPending > 0) {
        const randomStat = STATS_POOL[Math.floor(Math.random() * STATS_POOL.length)];
        this.room.playerManager.applyUpgrade(player, randomStat);
        player.levelUpsPending--;
      }
    });
  }
}
