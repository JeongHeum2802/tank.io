import Phaser from 'phaser';

import { MAP_WIDTH, MAP_HEIGHT } from '../utils/constants';
import type { StatLevels } from '../types';

import { AssetManager } from './managers/AssetManager';
import { InputController } from './managers/InputController';
import { EntityManager } from './managers/EntityManager';
import { NetworkManager } from './managers/NetworkManager';

/**
 * GameScene 클래스
 * 기능별로 분리된 Manager 클래스들을 조립(Assemble)하고 프레임워크 생명주기를 관리하는 메인 씬입니다.
 */
export class GameScene extends Phaser.Scene {
  private network!: NetworkManager;
  private inputCtrl!: InputController;
  private entityMgr!: EntityManager;
  
  private myNickname: string = "Unknown";

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { nickname: string }) {
    this.myNickname = data.nickname || "Unknown";
  }

  preload() {
    // 모든 텍스처 사전 생성
    AssetManager.preload(this);
  }

  async create() {
    // 1. 매니저 인스턴스 초기화
    this.inputCtrl = new InputController(this);
    this.entityMgr = new EntityManager(this, MAP_WIDTH, MAP_HEIGHT);
    this.network = new NetworkManager(this, this.entityMgr);

    // 2. 맵 및 카메라 설정
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (this.inputCtrl.getIsMobile()) {
      this.cameras.main.setZoom(0.7);
    }

    // 3. 맵 배경(격자무늬) 생성
    this.add.tileSprite(
      MAP_WIDTH / 2,   // 맵 중심에 배치
      MAP_HEIGHT / 2,
      MAP_WIDTH,
      MAP_HEIGHT,
      'gridTile'
    ).setDepth(-1);

    // 4. 리사이즈 이벤트 등록
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras.main) return;
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });

    // 5. 서버 접속 시도
    this.time.delayedCall(100, () => {
      this.network.connectToServer(this.myNickname);
    });

    // 6. 사망 이벤트 핸들링 (React 단에 알리기 위해 이벤트 전파만 수행)
    this.events.on('onPlayerDeath', () => {
      if (this.network) {
        this.network.disconnect();
      }
      this.events.emit('onGameOver');
    });
  }

  update(_time: number, delta: number) {
    if (!this.network || !this.inputCtrl || !this.entityMgr) return;

    const dt = delta / 1000;
    const isMobile = this.inputCtrl.getIsMobile();
    const joystickActive = this.inputCtrl.getJoystickActive();
    const joyVector = this.inputCtrl.getJoystickVector();
    const ptrWorld = this.inputCtrl.getPointerWorldPosition();

    // 1. 유저 입력값을 바탕으로 이동 상태를 서버에 전송 (내부적으로 쿨타임 처리)
    this.network.sendMoveIfReady(delta, isMobile, joystickActive, joyVector, ptrWorld);

    // 2. 렌더링된 모든 객체(Player, Orb, Bullet)의 보간(Lerp/Dead Reckoning) 계산 및 적용
    this.entityMgr.update(dt, isMobile, joystickActive, joyVector, ptrWorld);
  }

  /**
   * React UI(업그레이드 모달)에서 유저가 스탯을 선택했을 때 호출
   */
  applyStat(stat: string) {
    if (this.network) {
      this.network.upgradeLevel(stat);
    }
  }

  /**
   * 현재 유저의 스탯 업그레이드 단계를 반환 (React 초기 로드 컴포넌트용)
   */
  getStatLevels(): StatLevels {
    if (this.network) {
      return this.network.getStatLevels();
    }
    return {
      damage: 0, attackSpeed: 0, range: 0, speed: 0,
      maxHp: 0, magnetRadius: 0, shotgunLevel: 0, bulletSize: 0
    };
  }
}
