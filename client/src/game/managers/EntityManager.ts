import Phaser from 'phaser';

export class EntityManager {
  private scene: Phaser.Scene;
  
  private mySessionId: string = "";
  private mySprite?: Phaser.GameObjects.Sprite;
  private mySpeed: number = 200;

  private playerSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
  private playerNameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
  private orbSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
  private bulletSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};

  private playerTargets: { [id: string]: { x: number, y: number } } = {};
  private bulletTargets: { [id: string]: { x: number, y: number } } = {};
  private bulletVelocities: { [id: string]: { vx: number, vy: number } } = {};

  private mapWidth: number;
  private mapHeight: number;

  constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number) {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  setMySessionId(id: string) {
    this.mySessionId = id;
  }

  getMySprite() {
    return this.mySprite;
  }

  setMySpeed(speed: number) {
    this.mySpeed = speed;
  }

  addPlayer(id: string, player: any, isMe: boolean) {
    const nameText = this.scene.add.text(player.x, player.y - 30, player.nickname || "Unknown", {
      fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0.5).setDepth(20);
    this.playerNameTexts[id] = nameText;

    const sprite = this.scene.add.sprite(player.x, player.y, 'playerTexture');
    sprite.setTint(player.color);
    
    if (isMe) {
      this.mySprite = sprite;
      this.mySprite.setDepth(10);
      this.scene.cameras.main.startFollow(this.mySprite, true, 1, 1);
      this.mySpeed = player.speed;
    } else {
      this.playerSprites[id] = sprite;
    }
    
    this.playerTargets[id] = { x: player.x, y: player.y };
  }

  updatePlayerTarget(id: string, x: number, y: number) {
    if (this.playerTargets[id]) {
      this.playerTargets[id] = { x, y };
    }
  }

  removePlayer(id: string) {
    if (id === this.mySessionId && this.mySprite) {
      this.mySprite.destroy();
      this.mySprite = undefined;
    } else if (this.playerSprites[id]) {
      this.playerSprites[id].destroy();
      delete this.playerSprites[id];
    }
    
    if (this.playerNameTexts[id]) {
      this.playerNameTexts[id].destroy();
      delete this.playerNameTexts[id];
    }
    delete this.playerTargets[id];
  }

  addOrb(id: string, orb: any) {
    const orbTextures = ['orbSmall', 'orbMedium', 'orbLarge'];
    const textureName = orbTextures[orb.orbType] || 'orbSmall';
    const sprite = this.scene.add.sprite(orb.x, orb.y, textureName);
    this.orbSprites[id] = sprite;
  }

  removeOrb(id: string) {
    if (this.orbSprites[id]) {
      this.orbSprites[id].destroy();
      delete this.orbSprites[id];
    }
  }

  addBullet(id: string, bullet: any) {
    const sprite = this.scene.add.sprite(bullet.x, bullet.y, 'bulletTexture');
    sprite.setTint(bullet.color);
    sprite.setScale(bullet.scale || 1);

    this.bulletSprites[id] = sprite;
    this.bulletTargets[id] = { x: bullet.x, y: bullet.y };
    this.bulletVelocities[id] = { vx: bullet.velocityX, vy: bullet.velocityY };
  }

  updateBulletTarget(id: string, x: number, y: number) {
    if (this.bulletTargets[id]) {
      this.bulletTargets[id] = { x, y };
    }
  }

  removeBullet(id: string) {
    if (this.bulletSprites[id]) {
      this.bulletSprites[id].destroy();
      delete this.bulletSprites[id];
    }
    delete this.bulletTargets[id];
    delete this.bulletVelocities[id];
  }

  /**
   * 매 프레임마다 보간/예측 이동 연산 수행
   * @param dt 델타타임 (초)
   * @param isMobile 모바일 환경 여부
   * @param joystickActive 조이스틱 이동 여부
   * @param joystickVector 조이스틱 방향
   * @param pointerPos 마우스 포인트 위치 (PC)
   */
  update(dt: number, isMobile: boolean, joystickActive: boolean, joystickVector: {x:number, y:number}, pointerPos: {x:number, y:number} | null) {
    // 1. 내 플레이어 로컬 연산 및 타겟 보간
    if (this.mySprite && this.mySessionId) {
      if (isMobile && joystickActive) {
        const vx = joystickVector.x * this.mySpeed * dt;
        const vy = joystickVector.y * this.mySpeed * dt;
        this.mySprite.x += vx;
        this.mySprite.y += vy;
      } else if (!isMobile && pointerPos) {
        const dx = pointerPos.x - this.mySprite.x;
        const dy = pointerPos.y - this.mySprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          const vx = (dx / dist) * this.mySpeed * dt;
          const vy = (dy / dist) * this.mySpeed * dt;
          this.mySprite.x += vx;
          this.mySprite.y += vy;
        }
      }

      this.mySprite.x = Math.max(0, Math.min(this.mySprite.x, this.mapWidth));
      this.mySprite.y = Math.max(0, Math.min(this.mySprite.y, this.mapHeight));

      const serverTarget = this.playerTargets[this.mySessionId];
      if (serverTarget) {
        this.mySprite.x += (serverTarget.x - this.mySprite.x) * 0.05;
        this.mySprite.y += (serverTarget.y - this.mySprite.y) * 0.05;
      }

      const myNameText = this.playerNameTexts[this.mySessionId];
      if (myNameText) {
        myNameText.setPosition(this.mySprite.x, this.mySprite.y - 30);
      }
    }

    // 2. 다른 플레이어들 위치 타겟 보간
    for (const sessionId in this.playerSprites) {
      const sprite = this.playerSprites[sessionId];
      const target = this.playerTargets[sessionId];
      if (sprite && target) {
        sprite.x += (target.x - sprite.x) * 0.2;
        sprite.y += (target.y - sprite.y) * 0.2;

        const nameText = this.playerNameTexts[sessionId];
        if (nameText) {
          nameText.setPosition(sprite.x, sprite.y - 30);
        }
      }
    }

    // 3. 총알 추측 항법(Dead Reckoning) 타겟 보정
    for (const bulletId in this.bulletSprites) {
      const sprite = this.bulletSprites[bulletId];
      const vel = this.bulletVelocities[bulletId];
      const target = this.bulletTargets[bulletId];
      if (sprite && vel) {
        sprite.x += vel.vx * dt;
        sprite.y += vel.vy * dt;

        if (target) {
          const dx = target.x - sprite.x;
          const dy = target.y - sprite.y;
          if (dx * dx + dy * dy > 2500) {
            sprite.x = target.x;
            sprite.y = target.y;
          }
        }
      }
    }
  }
}
