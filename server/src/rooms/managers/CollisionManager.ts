import { GameRoom } from "../GameRoom";
import { Player, Orb, Bullet } from "../schema/GameState";
import { STATS_POOL, MAP_WIDTH, MAP_HEIGHT } from "../constants";

export class CollisionManager {
  private room: GameRoom;

  constructor(room: GameRoom) {
    this.room = room;
  }

  checkOrbPickups() {
    this.room.state.players.forEach((player: Player, sessionId: string) => {
      const collectDistSq = (28 + player.magnetRadius) * (28 + player.magnetRadius);
      const orbsToDelete: string[] = [];

      this.room.state.orbs.forEach((orb: Orb, orbId: string) => {
        const ox = orb.x - player.x;
        const oy = orb.y - player.y;
        if ((ox * ox + oy * oy) <= collectDistSq) {
          orbsToDelete.push(orbId);

          player.xp += orb.xpValue;
          while (player.xp >= player.xpMax) {
            player.xp -= player.xpMax;
            player.level += 1;
            player.xpMax = Math.floor(player.xpMax * 1.1);
            player.levelUpsPending++;

            player.maxHp += 10;
            player.hp = player.maxHp;

            const statsPool = [...STATS_POOL];
            for (let i = statsPool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [statsPool[i], statsPool[j]] = [statsPool[j], statsPool[i]];
            }
            const choices = statsPool.slice(0, 3);

            const clientTarget = this.room.clients.find(c => c.sessionId === sessionId);
            if (clientTarget) {
              clientTarget.send("onLevelUpChoices", { choices });
            }
          }
        }
      });

      orbsToDelete.forEach(orbId => {
        this.room.state.orbs.delete(orbId);
      });
    });
  }

  checkBulletHits() {
    const bulletsToRemove: string[] = [];
    this.room.state.bullets.forEach((bullet: Bullet, bulletId: string) => {
      this.room.state.players.forEach((player: Player, sessionId: string) => {
        if (bullet.ownerId === sessionId) return;

        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;

        const bulletRadius = 5 * bullet.scale;
        const hitDistSq = (20 + bulletRadius) * (20 + bulletRadius);

        if ((dx * dx + dy * dy) <= hitDistSq) {
          player.hp -= bullet.damage;
          bulletsToRemove.push(bulletId);

          if (player.hp <= 0) {
            player.x = Math.random() * MAP_WIDTH;
            player.y = Math.random() * MAP_HEIGHT;
            player.targetX = player.x;
            player.targetY = player.y;
            player.level = 1;
            player.maxHp = 100;
            player.hp = player.maxHp;
            player.xp = 0;
            player.xpMax = 100;
            player.levelUpsPending = 0;
            player.damage = 10;
            player.attackSpeed = 1000;
            player.range = 1000;
            player.speed = 200;
            player.magnetRadius = 0;
            player.shotgunLevel = 0;
            player.bulletSize = 1;

            const clientTarget = this.room.clients.find(c => c.sessionId === sessionId);
            if (clientTarget) {
              clientTarget.send("onPlayerDeath");
            }
          }
        }
      });
    });

    bulletsToRemove.forEach(bulletId => {
      this.room.state.bullets.delete(bulletId);
    });
  }
}
