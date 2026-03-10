import { GameRoom } from "../GameRoom";
import { Orb } from "../schema/GameState";
import { MAP_WIDTH, MAP_HEIGHT } from "../constants";

export class OrbManager {
  private room: GameRoom;

  constructor(room: GameRoom) {
    this.room = room;
  }

  startSpawnTimer() {
    this.room.clock.setInterval(() => {
      const playerCount = this.room.state.players.size;
      if (playerCount === 0) return;

      const spawnCount = playerCount * 5;

      if (this.room.state.orbs.size < 500) {
        for (let i = 0; i < spawnCount; i++) {
          this.spawnOrb();
        }
      }
    }, 2000);
  }

  spawnInitialOrbs() {
    for (let i = 0; i < 100; i++) {
      this.spawnOrb();
    }
  }

  spawnOrb() {
    const orb = new Orb();
    orb.x = Math.random() * MAP_WIDTH;
    orb.y = Math.random() * MAP_HEIGHT;

    const rand = Math.random();
    if (rand < 0.50) {
      orb.orbType = 0;
      orb.xpValue = 5;
    } else if (rand < 0.80) {
      orb.orbType = 1;
      orb.xpValue = 15;
    } else {
      orb.orbType = 2;
      orb.xpValue = 50;
    }

    this.room.state.orbs.set(this.room.generateId(), orb);
  }
}
