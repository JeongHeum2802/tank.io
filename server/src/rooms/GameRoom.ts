import { Room, Client } from "colyseus";
import { GameState } from "./schema/GameState";

import { PlayerManager } from "./managers/PlayerManager";
import { BotManager } from "./managers/BotManager";
import { OrbManager } from "./managers/OrbManager";
import { BulletManager } from "./managers/BulletManager";
import { CollisionManager } from "./managers/CollisionManager";

export class GameRoom extends Room<GameState> {
  playerManager!: PlayerManager;
  botManager!: BotManager;
  orbManager!: OrbManager;
  bulletManager!: BulletManager;
  collisionManager!: CollisionManager;

  onCreate() {
    this.setState(new GameState());

    this.playerManager = new PlayerManager(this);
    this.botManager = new BotManager(this);
    this.orbManager = new OrbManager(this);
    this.bulletManager = new BulletManager(this);
    this.collisionManager = new CollisionManager(this);

    // Initial setup
    this.orbManager.spawnInitialOrbs();
    this.orbManager.startSpawnTimer();
    this.botManager.startSpawnTimer();

    // Messages
    this.onMessage("move", (client, message: { x: number, y: number }) => {
      this.playerManager.handleMove(client, message);
    });

    this.onMessage("upgradeLevel", (client, message: { stat: string }) => {
      this.playerManager.handleUpgrade(client, message);
    });

    // Game Loop (approx 60 FPS / 16ms)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 60);
  }

  onJoin(client: Client, options: any) {
    this.playerManager.onJoin(client, options);
  }

  onLeave(client: Client, consented?: boolean) {
    this.playerManager.onLeave(client, consented);
  }

  update(deltaTime: number) {
    const dtSeconds = deltaTime / 1000;

    // 1. Update player positions
    this.playerManager.update(dtSeconds);

    // 2. Bot AI updates
    this.botManager.update();

    // 3. Firing guns
    this.bulletManager.updatePlayerFiring(deltaTime);

    // 4. Bullet movement
    this.bulletManager.update(dtSeconds, deltaTime);

    // 5. Collisions & Pickups
    this.collisionManager.checkOrbPickups();
    this.collisionManager.checkBulletHits();
  }

  generateId() {
    return Math.random().toString(36).substring(2, 9);
  }
}
