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
      } else if (message.stat === "speed") {
        player.speed += 20;
      } else if (message.stat === "maxHp") {
        player.maxHp += 20;
        player.hp += 20;
      } else if (message.stat === "magnetRadius") {
        player.magnetRadius += 30; // 자석 반경 30씩 증가
      } else if (message.stat === "shotgunLevel") {
        player.shotgunLevel += 1;
      } else if (message.stat === "bulletSize") {
        player.bulletSize += 0.5; // 투사체 크기 증가 팩터
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

          // 타겟 방향으로 속도 벡터 설정
          const velX = (bulletDx / bulletDist) * 400;
          const velY = (bulletDy / bulletDist) * 400;

          // 다중 발사(shotgunLevel) 로직: 0이면 단발, 1 이상이면 여러 방 퍼져서(Spread) 나간다.
          const bulletCounts = player.shotgunLevel === 0 ? 1 : 1 + (player.shotgunLevel * 2); 
          const spreadAngle = 0.2; // 부채꼴 퍼짐 방사각 (Radian)

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

            // bulletSize를 속성으로 추가 (GameState.ts의 Bullet 클래스 scale 변수에 반영됨)
            bullet.scale = player.bulletSize || 1;
            
            bullet.velocityX = Math.cos(angle) * 400;
            bullet.velocityY = Math.sin(angle) * 400;

            this.bulletIdCounter++;
            this.state.bullets.set(this.bulletIdCounter.toString(), bullet);
          }
        }
      }

      // -- 구슬 획득 검사 (자석 범위 적용) --
      // 기본 반지름 20(player) + 8(orb) = 28 에 더하여 자석 스탯(magnetRadius)을 더해준다.
      const collectDistSq = (28 + player.magnetRadius) * (28 + player.magnetRadius);
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

            // 레벨업 시 서버에서 무작위 선택지 3개를 선정해서 이 플레이어에게 보냅니다.
            const statsPool = ['damage', 'attackSpeed', 'range', 'speed', 'maxHp', 'magnetRadius', 'shotgunLevel', 'bulletSize'];
            
            // 셔플 알고리즘 (Fisher-Yates)
            for (let i = statsPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [statsPool[i], statsPool[j]] = [statsPool[j], statsPool[i]];
            }
            const choices = statsPool.slice(0, 3);
            
            // 해당 플레이어의 클라이언트 소켓에게만 전송
            const clientTarget = this.clients.find(c => c.sessionId === sessionId);
            if (clientTarget) {
               clientTarget.send("onLevelUpChoices", { choices });
            }
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
        
        // 플레이어 반지름(20) + 총알 기본 반지름(5) * 스케일값
        const bulletRadius = 5 * bullet.scale;
        const hitDistSq = (20 + bulletRadius) * (20 + bulletRadius);

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
