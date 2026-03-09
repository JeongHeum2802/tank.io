import { Room, Client } from "colyseus";
import { GameState, Player, Orb, Bullet } from "./schema/GameState";

const MAP_WIDTH = 4000;
const MAP_HEIGHT = 4000;

export class GameRoom extends Room<GameState> {

  // 총알에 부여할 고유 식별자 카운터
  private bulletIdCounter: number = 0;

  onCreate() {
    this.setState(new GameState());

    // 게임 루프 등록 (약 60 FPS / 16ms)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 60);

    // 구슬 먼저 생성
    for (let i = 0; i < 100; i++) {
      this.spawnOrb();
    }

    // 주기적 구슬 생성 (유저 수에 비례하여 생성, 유저가 없으면 생성 안함)
    this.clock.setInterval(() => {
      const playerCount = this.state.players.size;
      if (playerCount === 0) return; // 사람이 없으면 구슬 조각 안 뽑음

      // 1명당 2초에 5개씩 생성. (ex: 2명이면 10개, 3명이면 15개)
      const spawnCount = playerCount * 5;

      // 구슬 갯수가 너무 많아지는 것 방지 (서버 부하 제한: 맵에 구슬 500개까지만)
      if (this.state.orbs.size < 500) {
        for (let i = 0; i < spawnCount; i++) {
          this.spawnOrb();
        }
      }
    }, 2000);

    // 이동 패킷 수신
    this.onMessage("move", (client, message: { x: number, y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.targetX = message.x;
        player.targetY = message.y;
      }
    });

    // 레벨업 스탯 강화 패킷 수신
    this.onMessage("upgradeLevel", (client, message: { stat: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.levelUpsPending <= 0) return;

      if (message.stat === "damage") {
        player.damage += 5;
      } else if (message.stat === "attackSpeed") {
        player.attackSpeed = Math.max(100, player.attackSpeed - 100);
      } else if (message.stat === "range") {
        player.range += 500;
      }

      player.levelUpsPending--;
    });
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

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented?: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  spawnOrb() {
    const orb = new Orb();
    orb.x = Math.random() * MAP_WIDTH;
    orb.y = Math.random() * MAP_HEIGHT;

    // 3종류 구슬: 소형(50%), 중형(30%), 대형(20%)
    const rand = Math.random();
    if (rand < 0.50) {
      orb.orbType = 0; // 소형
      orb.xpValue = 5;
    } else if (rand < 0.80) {
      orb.orbType = 1; // 중형
      orb.xpValue = 15;
    } else {
      orb.orbType = 2; // 대형
      orb.xpValue = 50;
    }

    this.state.orbs.set(this.generateId(), orb);
  }

  generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  // 서버 사이드 업데이트 로직 (이동, 총알 발사, 충돌 처리)
  update(deltaTime: number) {
    const dtSeconds = deltaTime / 1000; // ms to seconds

    // 1. 플레이어 이동 및 총알 발사 처리
    this.state.players.forEach((player: Player, sessionId: string) => {
      // -- 이동 로직 --
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        // 방향 벡터 이동
        const vx = (dx / distance) * player.speed;
        const vy = (dy / distance) * player.speed;
        player.x += vx * dtSeconds;
        player.y += vy * dtSeconds;
      }

      // -- 맵 바운더리 검사 --
      player.x = Math.max(0, Math.min(player.x, MAP_WIDTH));
      player.y = Math.max(0, Math.min(player.y, MAP_HEIGHT));

      // -- 총알 발사 로직 --
      // 레벨업 대기 중일 때는 발사하지 않음
      if (player.levelUpsPending <= 0) {
        player.fireTimer += deltaTime;
        if (player.fireTimer >= player.attackSpeed) {
          player.fireTimer -= player.attackSpeed;

          // 타겟 방향으로 발사 (정지 시에도 마지막 타겟 방향 사용)
          const bulletDx = player.targetX - player.x;
          const bulletDy = player.targetY - player.y;
          const bulletDist = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);

          // 타겟이 너무 가까우면 발사하지 않음 (자기 위에 쏘는 것 방지)
          if (bulletDist > 5) {
            const bullet = new Bullet();
            bullet.x = player.x;
            bullet.y = player.y;
            bullet.ownerId = sessionId;
            bullet.damage = player.damage;
            bullet.maxLifeTime = player.range;

            // 타겟 방향으로 총알 속도 벡터 설정 (속도 400)
            bullet.velocityX = (bulletDx / bulletDist) * 400;
            bullet.velocityY = (bulletDy / bulletDist) * 400;

            this.bulletIdCounter++;
            this.state.bullets.set(this.bulletIdCounter.toString(), bullet);
          }
        }
      }

      // -- 구슬 획득 검사 --
      // 반지름 20(player) + 8(orb) = 28. 거리 제곱 비교로 최적화
      const collectDistSq = 28 * 28;
      const orbsToDelete: string[] = [];

      this.state.orbs.forEach((orb: Orb, orbId: string) => {
        const ox = orb.x - player.x;
        const oy = orb.y - player.y;
        if ((ox * ox + oy * oy) <= collectDistSq) {
          orbsToDelete.push(orbId);

          // 경험치 획득 처리 (구슬 종류에 따른 경험치)
          player.xp += orb.xpValue;
          while (player.xp >= player.xpMax) {
            player.xp -= player.xpMax;
            player.level += 1;
            player.xpMax = Math.floor(player.xpMax * 1.1);
            player.levelUpsPending++;

            // 레벨업 시 체력 완전 회복
            player.maxHp += 10; // 레벨당 최대 체력 20 증가
            player.hp = player.maxHp;
          }
        }
      });

      // 획득한 구슬 삭제
      orbsToDelete.forEach(orbId => {
        this.state.orbs.delete(orbId);
      });
    });

    // 2. 총알 이동 및 수명 처리
    const bulletsToDelete: string[] = [];
    this.state.bullets.forEach((bullet: Bullet, bulletId: string) => {
      bullet.x += bullet.velocityX * dtSeconds;
      bullet.y += bullet.velocityY * dtSeconds;
      bullet.lifeTime += deltaTime;

      if (bullet.lifeTime >= bullet.maxLifeTime) {
        bulletsToDelete.push(bulletId);
      }
    });

    bulletsToDelete.forEach(bulletId => {
      this.state.bullets.delete(bulletId);
    });

    // 3. 총알-플레이어 충돌 감지 (다른 플레이어의 총알에 맞으면 데미지)
    const bulletsToRemove: string[] = [];
    this.state.bullets.forEach((bullet: Bullet, bulletId: string) => {
      this.state.players.forEach((player: Player, sessionId: string) => {
        // 자기 총알은 무시
        if (bullet.ownerId === sessionId) return;

        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const hitDistSq = 25 * 25; // 플레이어 반지름(20) + 총알 반지름(5)
        if ((dx * dx + dy * dy) <= hitDistSq) {
          // 피격!
          player.hp -= bullet.damage;
          bulletsToRemove.push(bulletId);

          // 사망 처리
          if (player.hp <= 0) {
            // 리스폰: 랜덤 위치, 체력 회복, XP 초기화
            player.x = Math.random() * MAP_WIDTH;
            player.y = Math.random() * MAP_HEIGHT;
            player.targetX = player.x;
            player.targetY = player.y;
            player.level = 1;
            player.hp = player.maxHp;
            player.xp = 0;
            player.xpMax = 100;
            player.levelUpsPending = 0;
            player.damage = 10;
            player.attackSpeed = 1000;
            player.range = 1000;
          }
        }
      });
    });

    bulletsToRemove.forEach(bulletId => {
      this.state.bullets.delete(bulletId);
    });
  }
}
