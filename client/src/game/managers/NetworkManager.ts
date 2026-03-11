import * as Colyseus from 'colyseus.js';
import { getStateCallbacks } from 'colyseus.js';
import Phaser from 'phaser';
import { EntityManager } from './EntityManager';
import type { PlayerStats, StatLevels } from '../../types';

export class NetworkManager {
  private scene: Phaser.Scene;
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;
  private entityManager: EntityManager;

  private myPlayerStats: PlayerStats = {
    level: 1, xp: 0, xpMax: 100,
    damage: 10, attackSpeed: 1000, range: 1000,
    hp: 100, maxHp: 100,
    levelUpsPending: 0,
    magnetRadius: 0, shotgunLevel: 0, bulletSize: 1,
    accuracy: 0, bulletSpeed: 400, speed: 200
  };

  private myStatLevels: StatLevels = {
    damage: 0, attackSpeed: 0, range: 0, speed: 0,
    maxHp: 0, magnetRadius: 0, shotgunLevel: 0, bulletSize: 0,
    accuracy: 0, bulletSpeed: 0
  };

  private latestChoices: string[] = [];
  private sendTimer: number = 0;

  constructor(scene: Phaser.Scene, entityManager: EntityManager) {
    this.scene = scene;
    this.entityManager = entityManager;
  }

  async connectToServer(nickname: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const endpoint = `${protocol}//${window.location.host}`;
    this.client = new Colyseus.Client(endpoint);
    try {
      this.room = await this.client.joinOrCreate("game_room", { nickname });
      console.log("Joined successfully", this.room.sessionId);
      this.entityManager.setMySessionId(this.room.sessionId);

      this.setupRoomHandlers();
    } catch (e) {
      console.error("JOIN ERROR", e);
    }
  }

  private setupRoomHandlers() {
    if (!this.room) return;
    const $ = getStateCallbacks(this.room);

    // --- 플레이어 ---
    $(this.room.state).players.onAdd((player: any, sessionId: string) => {
      const isMe = (sessionId === this.room.sessionId);
      this.entityManager.addPlayer(sessionId, player, isMe);

      if (isMe) {
        this.syncPlayerStats(player);
        this.scene.events.emit('onPlayerStatusUpdate', this.myPlayerStats);

        $(player).onChange(() => {
          this.entityManager.updatePlayerTarget(sessionId, player.x, player.y);
          this.entityManager.setMySpeed(player.speed);

          const prevPending = this.myPlayerStats.levelUpsPending;
          this.syncPlayerStats(player);
          this.scene.events.emit('onPlayerStatusUpdate', this.myPlayerStats);

          if (player.levelUpsPending > 0 && player.levelUpsPending > prevPending) {
            if (this.latestChoices.length > 0) {
              this.scene.events.emit('onLevelUp', {
                pending: player.levelUpsPending,
                choices: this.latestChoices,
                stats: this.myPlayerStats
              });
            }
          } else if (player.levelUpsPending === 0 && prevPending > 0) {
            this.latestChoices = [];
            this.scene.events.emit('onLevelUp', { pending: 0, choices: [] });
          }
        });

        this.room.onMessage("onLevelUpChoices", (message: { choices: string[] }) => {
          this.latestChoices = message.choices;
          if (this.myPlayerStats.levelUpsPending > 0) {
            this.scene.events.emit('onLevelUp', {
              pending: this.myPlayerStats.levelUpsPending,
              choices: this.latestChoices,
              stats: this.myPlayerStats
            });
          }
        });

        this.room.onMessage("onPlayerDeath", () => {
          // 사망 시 GameScene 쪽에 이를 알리는 커스텀 이벤트 발송
          this.scene.events.emit('onPlayerDeath');
        });

      } else {
        $(player).onChange(() => {
          this.entityManager.updatePlayerTarget(sessionId, player.x, player.y);
        });
      }
    });

    $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      this.entityManager.removePlayer(sessionId);
    });

    // --- 구슬(Orbs) ---
    $(this.room.state).orbs.onAdd((orb: any, orbId: string) => {
      this.entityManager.addOrb(orbId, orb);
    });
    $(this.room.state).orbs.onRemove((_orb: any, orbId: string) => {
      this.entityManager.removeOrb(orbId);
    });

    // --- 총알(Bullets) ---
    $(this.room.state).bullets.onAdd((bullet: any, bulletId: string) => {
      this.entityManager.addBullet(bulletId, bullet);
      $(bullet).onChange(() => {
        this.entityManager.updateBulletTarget(bulletId, bullet.x, bullet.y);
      });
    });
    $(this.room.state).bullets.onRemove((_bullet: any, bulletId: string) => {
      this.entityManager.removeBullet(bulletId);
    });

    // --- 리더보드 타이머 --
    this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const players: any[] = [];
        this.room.state.players.forEach((p: any, id: string) => {
          players.push({
            sessionId: id,
            nickname: p.nickname || "Unknown",
            level: p.level,
            xp: p.xp
          });
        });
        players.sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          return b.xp - a.xp;
        });
        this.scene.events.emit('onLeaderboardUpdate', players.slice(0, 10));
      }
    });
  }

  private syncPlayerStats(player: any) {
    this.myPlayerStats = {
      level: player.level, xp: player.xp, xpMax: player.xpMax,
      damage: player.damage, attackSpeed: player.attackSpeed,
      range: player.range, hp: player.hp, maxHp: player.maxHp,
      levelUpsPending: player.levelUpsPending,
      magnetRadius: player.magnetRadius, shotgunLevel: player.shotgunLevel, bulletSize: player.bulletSize,
      accuracy: player.accuracy, bulletSpeed: player.bulletSpeed, speed: player.speed
    };
  }

  /**
   * 클라이언트의 입력값(터치 패드나 마우스)을 50ms마다 서버로 송신합니다.
   */
  sendMoveIfReady(delta: number, isMobile: boolean, joystickActive: boolean, joystickVector: { x: number, y: number }, pointerWorld: { x: number, y: number } | null) {
    if (!this.room) return;
    this.sendTimer += delta;
    if (this.sendTimer >= 50) {
      this.sendTimer = 0;
      if (isMobile) {
        if (joystickActive) {
          const mySprite = this.entityManager.getMySprite();
          if (mySprite) {
            const farX = mySprite.x + joystickVector.x * 500;
            const farY = mySprite.y + joystickVector.y * 500;
            this.room.send("move", { x: farX, y: farY });
          }
        }
      } else {
        if (pointerWorld && (pointerWorld.x !== 0 || pointerWorld.y !== 0)) {
          this.room.send("move", { x: pointerWorld.x, y: pointerWorld.y });
        }
      }
    }
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
    }
  }

  upgradeLevel(stat: string) {
    if (this.room) {
      this.room.send("upgradeLevel", { stat });
      if (stat in this.myStatLevels) {
        this.myStatLevels[stat as keyof StatLevels]++;
        this.scene.events.emit('onStatUpdate', { ...this.myStatLevels });
      }
    }
  }

  getStatLevels(): StatLevels {
    return { ...this.myStatLevels };
  }
}
