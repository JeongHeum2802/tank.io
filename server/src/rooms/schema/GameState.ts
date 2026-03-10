import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") nickname: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") targetX: number = 0;
  @type("number") targetY: number = 0;
  @type("number") speed: number = 200;

  @type("number") level: number = 1;
  @type("number") xp: number = 0;
  @type("number") xpMax: number = 100;

  @type("number") damage: number = 10;
  @type("number") attackSpeed: number = 1000;
  @type("number") range: number = 1000;

  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;

  // 신규 추가된 확장 스탯
  @type("number") magnetRadius: number = 0; // 자석 사거리 (기본 0)
  @type("number") shotgunLevel: number = 0; // 다중 발사 레벨 (0=단발, 1=3발 부채꼴, 2=5발 등)
  @type("number") bulletSize: number = 1;   // 총알 크기 스케일 (기본 1)
  @type("number") accuracy: number = 0;     // 집탄률 (높을수록 다중 발사 각도가 좁아짐)
  @type("number") bulletSpeed: number = 400; // 총알 발사 속도

  @type("boolean") isBot: boolean = false;   // AI 봇 여부 판별
  @type("number") color: number = 0xffffff;  // 플레이어 고유 색상 (Hex)

  // 내부 서버 로직용 (levelUpsPending은 클라이언트에도 동기화 필요)
  fireTimer: number = 0;
  @type("number") levelUpsPending: number = 0;
}

export class Orb extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") orbType: number = 0; // 0=소형, 1=중형, 2=대형
  @type("number") xpValue: number = 5; // 경험치량
}

export class Bullet extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;

  // 탄환 수명(ms) 추적용 (Range)
  lifeTime: number = 0;
  maxLifeTime: number = 1000;

  @type("string") ownerId: string = "";
  damage: number = 10;
  @type("number") scale: number = 1; // 총알의 시각적/물리적 크기 배율
  @type("number") color: number = 0xffffff; // 총알 색상 (발사 주체와 동일)
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Orb }) orbs = new MapSchema<Orb>();
  @type({ map: Bullet }) bullets = new MapSchema<Bullet>();
}
