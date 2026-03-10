import { GameRoom } from "../GameRoom";
import { Bullet, Player } from "../schema/GameState";

export class BulletManager {
  private room: GameRoom;
  private bulletIdCounter: number = 0;

  constructor(room: GameRoom) {
    this.room = room;
  }

  updatePlayerFiring(deltaTime: number) {
    this.room.state.players.forEach((player: Player, sessionId: string) => {
      if (player.levelUpsPending <= 0) {
        player.fireTimer += deltaTime;
        if (player.fireTimer >= player.attackSpeed) {
          player.fireTimer -= player.attackSpeed;

          const bulletDx = player.targetX - player.x;
          const bulletDy = player.targetY - player.y;
          const bulletDist = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);

          const bulletCounts = player.shotgunLevel === 0 ? 1 : 1 + (player.shotgunLevel * 2);
          const spreadAngle = 0.2; 

          const baseAngle = Math.atan2(bulletDy, bulletDx);
          const startAngle = baseAngle - spreadAngle * (bulletCounts - 1) / 2;

          for (let i = 0; i < bulletCounts; i++) {
            const angle = startAngle + spreadAngle * i;

            const bullet = new Bullet();
            bullet.x = player.x;
            bullet.y = player.y;
            bullet.ownerId = sessionId;
            bullet.damage = player.damage;
            bullet.maxLifeTime = player.range;
            bullet.scale = player.bulletSize || 1;
            bullet.color = player.color;

            bullet.velocityX = Math.cos(angle) * 400;
            bullet.velocityY = Math.sin(angle) * 400;

            this.bulletIdCounter++;
            this.room.state.bullets.set(this.bulletIdCounter.toString(), bullet);
          }
        }
      }
    });
  }

  update(dtSeconds: number, deltaTime: number) {
    const bulletsToDelete: string[] = [];
    this.room.state.bullets.forEach((bullet: Bullet, bulletId: string) => {
      bullet.x += bullet.velocityX * dtSeconds;
      bullet.y += bullet.velocityY * dtSeconds;
      bullet.lifeTime += deltaTime;

      if (bullet.lifeTime >= bullet.maxLifeTime) {
        bulletsToDelete.push(bulletId);
      }
    });

    bulletsToDelete.forEach(bulletId => {
      this.room.state.bullets.delete(bulletId);
    });
  }
}
