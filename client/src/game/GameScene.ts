import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { getStateCallbacks } from 'colyseus.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../utils/constants';
import { isMobileDevice } from '../utils/device';
import type { PlayerStats, StatLevels } from '../types';

/**
 * GameScene 클래스
 * Phaser 프레임워크를 기반으로 실제 게임 월드를 렌더링하고 유저 입력을 처리하는 핵심 클래스입니다.
 * Colyseus 클라이언트를 이용해 서버 상태(`room.state`)와 동기화하며, 내 캐릭터의 움직임과 UI 수치(체력, 경험치 등)를 관리합니다.
 */
export class GameScene extends Phaser.Scene {
  // 서버 통신 클라이언트 및 방(Room) 객체
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;
  // 유저가 접속 시 입력한 닉네임
  private myNickname: string = "Unknown";

  // 현재 화면에 렌더링 중인 객체들을 관리하는 딕셔너리
  // Key: 서버가 부여한 고유 식별자 (sessionId 또는 entityId)
  private playerSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
  private playerNameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
  private orbSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
  private bulletSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};

  // 네트워크 보간(Interpolation)을 위한 목표 위치 데이터
  // 서버에서 보내는 좌표는 지연 시간이 있으므로, 클라이언트에서 현재 위치와 목표 위치의 사이를 부드럽게 이어줍니다(lerp).
  private playerTargets: { [id: string]: { x: number, y: number } } = {};
  private bulletTargets: { [id: string]: { x: number, y: number } } = {};

  // 총알의 속도 (클라이언트 예측 이동 목적)
  private bulletVelocities: { [id: string]: { vx: number, vy: number } } = {};
  private sendTimer: number = 0; // 서버로 데이터 전송 빈도를 조절(throttling)하는 타이머

  // 맵 배경 (월드 공간에 배치되는 격자무늬 타일)

  // --- 좌측 상단 인게임 UI (Phaser Graphics 및 Text 기반) ---
  private uiText!: Phaser.GameObjects.Text;        // 레벨, 이름, 스탯 요약 텍스트
  private xpBarBg!: Phaser.GameObjects.Graphics;     // 경험치 바의 바탕(회색) 영역
  private xpBarFill!: Phaser.GameObjects.Graphics;   // 경험치 바의 채워지는(녹색) 영역
  private hpBarBg!: Phaser.GameObjects.Graphics;     // 체력 바의 바탕(회색) 영역
  private hpBarFill!: Phaser.GameObjects.Graphics;   // 체력 바의 채워지는 영역 (녹~주~빨)

  // --- 내 플레이어 제어 변수 ---
  private mySessionId: string = "";                 // Colyseus 서버가 부여해준 내 고유 ID
  private mySprite!: Phaser.GameObjects.Sprite;     // 내 캐릭터의 실제 그래픽(스프라이트) 객체
  private myPlayerStats: PlayerStats = {
    level: 1, xp: 0, xpMax: 100,
    damage: 10, attackSpeed: 1000, range: 1000,
    hp: 100, maxHp: 100,
    levelUpsPending: 0,
    magnetRadius: 0, shotgunLevel: 0, bulletSize: 1
  };
  private mySpeed: number = 200;                    // 내 캐릭터의 현재 이동 속도
  private latestChoices: string[] = [];             // 가장 최근 서버가 보내준 레벨업 선택지 캐시

  // --- 스탯 업그레이드 횟수 추적 (StatOverlay에 표시용) ---
  private myStatLevels: StatLevels = {
    damage: 0, attackSpeed: 0, range: 0, speed: 0,
    maxHp: 0, magnetRadius: 0, shotgunLevel: 0, bulletSize: 0
  };

  // --- 모바일 가상 조이스틱을 위한 변수 ---
  private isMobile: boolean = false;                // 접속 기기 모바일 여부
  private joystickBase!: Phaser.GameObjects.Arc;    // 조이스틱의 바깥쪽 큰 원
  private joystickThumb!: Phaser.GameObjects.Arc;   // 드래그 시 움직이는 조이스틱 안쪽 작은 원
  private joystickPointerID: number = -1;           // 터치를 추적할 고유 포인터 ID
  private joystickVector = { x: 0, y: 0 };          // 조이스틱이 꺾인 현재 방향 벡터(-1.0 ~ 1.0)
  private joystickActive = false;                   // 조이스틱을 현재 잡고(터치하고) 있는지 여부

  // --- 반응형 UI 레이아웃 크기 설정값 ---
  private uiScale: number = 1;                      // 기준 화면 대비 UI 축소/확대 스케일 비율
  private barWidth: number = 250;                   // 체력, 경험치 바의 목표 가로폭

  /**
   * Phaser 씬 생성자
   * 이 씬을 참조하는 고유 키(key)인 'GameScene'으로 초기화합니다.
   */
  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * Scene.init()
   * 씬(Scene)이 시작될 때 React 부모 쪽에서 전달된 초기 데이터를 받아 처리합니다.
   */
  init(data: { nickname: string }) {
    this.myNickname = data.nickname || "Unknown";
  }

  /**
   * Scene.preload()
   * 게임에서 사용할 에셋 이미지나 오디오 등을 메모리에 불러들입니다.
   * 이 프로젝트에서는 별도의 외부 에셋로드 대신 Phaser.Graphics를 이용해 기하 도형 텍스처를 프로그램적으로 생성(GenerateTexture)합니다.
   */
  preload() {
    // 플레이어 텍스처 생성 (파란색으로 채워진 반경 20픽셀 원)
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0x3498db, 1);
    playerGfx.fillCircle(20, 20, 20);
    playerGfx.generateTexture('playerTexture', 40, 40); // 'playerTexture'라는 키값으로 텍스처 등록
    playerGfx.destroy();

    // 맵에 떨어져 있는 경험치 구슬(Orb) 텍스처 생성 - 소형(초록), 중형(파랑), 대형(금색)
    const orbSmallGfx = this.make.graphics({ x: 0, y: 0 });
    orbSmallGfx.fillStyle(0x2ecc71, 1);
    orbSmallGfx.fillCircle(6, 6, 6);
    orbSmallGfx.generateTexture('orbSmall', 12, 12);
    orbSmallGfx.destroy();

    const orbMedGfx = this.make.graphics({ x: 0, y: 0 });
    orbMedGfx.fillStyle(0x3498db, 1);
    orbMedGfx.fillCircle(10, 10, 10);
    orbMedGfx.generateTexture('orbMedium', 20, 20);
    orbMedGfx.destroy();

    const orbLargeGfx = this.make.graphics({ x: 0, y: 0 });
    orbLargeGfx.fillStyle(0xf1c40f, 1);
    orbLargeGfx.fillCircle(14, 14, 14);
    orbLargeGfx.generateTexture('orbLarge', 28, 28);
    orbLargeGfx.destroy();

    // 발사체(총알) 텍스처 생성 (노란 점)
    const bulletGfx = this.make.graphics({ x: 0, y: 0 });
    bulletGfx.fillStyle(0xf1c40f, 1);
    bulletGfx.fillCircle(5, 5, 5);
    bulletGfx.generateTexture('bulletTexture', 10, 10);
    bulletGfx.destroy();

    // 바닥에 그려질 격자 무늬(Grid) 텍스처 생성
    const gridGfx = this.make.graphics({ x: 0, y: 0 });
    gridGfx.lineStyle(1, 0x333333, 0.8);
    gridGfx.strokeRect(0, 0, 64, 64);
    gridGfx.generateTexture('gridTile', 64, 64);
    gridGfx.destroy();
  }

  /**
   * Scene.create()
   * preload된 텍스처를 이용하여 게임 초기 세팅을 진행합니다.
   * 카메라 영역 제한 적용, UI 초기 렌더, 월드(격자 타일) 생성 등을 처리하며, 서버(Colyseus) 연결을 시도합니다.
   */
  async create() {
    this.isMobile = isMobileDevice(); // 접속 기기 종류 검사
    this.updateUIScale();             // 브라우저 폭 기반 기준 스케일 계산

    // 카메라의 중심 좌표가 맵 경계선(0,0 ~ MAP_WIDTH,MAP_HEIGHT)을 벗어나지 않도록 통제
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // 모바일에서는 카메라를 축소(zoom-out)하여 더 넓은 시야를 확보합니다.
    // 0.7배 = 약 1.43배 넓은 시야. 데스크톱은 기본 1x 유지.
    if (this.isMobile) {
      this.cameras.main.setZoom(0.7);
    }

    // 격자 배경을 월드 공간(World Space)에 배치합니다.
    // setScrollFactor(0)을 사용하지 않으므로, 플레이어/구슬과 동일한 레이어에서 자연스럽게 스크롤됩니다.
    this.add.tileSprite(
      MAP_WIDTH / 2,   // 맵 중심에 배치
      MAP_HEIGHT / 2,
      MAP_WIDTH,
      MAP_HEIGHT,
      'gridTile'
    ).setDepth(-1);

    // zoom 보정값: UI는 카메라 스크롤을 따르지 않지만(setScrollFactor(0)) zoom의 영향을 받으므로
    // 1/zoom 스케일을 적용하여 시각적 크기를 동일하게 유지합니다.
    const uiZoomScale = 1 / this.cameras.main.zoom;

    // 창 크기가 변경(resize)될 때 호출되는 리스너 등록
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras.main) return;
      this.cameras.main.setSize(gameSize.width, gameSize.height);

      // 비율 계산 및 UI 요소를 리사이즈된 화면에 맞춤
      this.updateUIScale();
      this.repositionUI();
      if (this.isMobile) {
        this.repositionJoystick();
      }
    });

    // 좌상단 스탯 정보 텍스트 (Connecting... 이라는 글씨로 임시 시작점)
    // setDepth(100)로 최상위에 렌더링되게 만듭니다.
    const fontSize = Math.max(12, Math.round(16 * this.uiScale));
    // 줌 적용 시 위치가 중앙으로 쏠리므로 x, y 좌표값에도 uiZoomScale을 곱해 보정합니다.
    this.uiText = this.add.text(10 * this.uiScale * uiZoomScale, 10 * this.uiScale * uiZoomScale, 'Connecting...', {
      fontSize: `${fontSize}px`, color: '#ffffff', backgroundColor: '#000000aa',
      padding: { x: 4, y: 3 }
    }).setScrollFactor(0).setDepth(100).setScale(uiZoomScale);

    // 경험치(XP) 진행 바 배경 구성
    const barY = (10 + fontSize + 12) * this.uiScale;
    this.xpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100).setScale(uiZoomScale);
    this.xpBarBg.fillStyle(0x555555, 1);
    this.xpBarBg.fillRect(10 * this.uiScale * uiZoomScale, barY * uiZoomScale, this.barWidth, 16 * this.uiScale);

    this.xpBarFill = this.add.graphics().setScrollFactor(0).setDepth(100).setScale(uiZoomScale);
    this.updateXPBar(0, 100);

    // 체력(HP) 진행 바 설정
    const hpBarY = barY + 20 * this.uiScale;
    this.hpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100).setScale(uiZoomScale);
    this.hpBarBg.fillStyle(0x555555, 1);
    this.hpBarBg.fillRect(10 * this.uiScale * uiZoomScale, hpBarY * uiZoomScale, this.barWidth, 12 * this.uiScale);

    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(100).setScale(uiZoomScale);
    this.updateHPBar(100, 100);

    // 모바일 기기로 인식했다면 가상 조이스틱용 터치패드를 생성합니다.
    if (this.isMobile) {
      this.createJoystick();
    }

    // 렌더 컨텍스트 대기를 위해 한 프레임 지연(100ms) 후 Colyseus 서버에 웹소켓 연결 시작
    this.time.delayedCall(100, () => {
      this.connectToServer();
    });
  }

  /**
   * 화면 크기를 계산해서 폰트 사이즈와 바이드로 비율을 계산합니다.
   * 최소 800픽셀 윈도우 너비를 기준으로 1x 비율을 잡고 모바일 일 때 축소시킵니다.
   */
  private updateUIScale() {
    if (!this.cameras.main) return;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const minDim = Math.min(w, h);

    // 너무 작아지지 않게 방지 (하한 0.6x, 상한 1.2x)
    this.uiScale = Math.max(0.6, Math.min(1.2, minDim / 800));
    // 가로 바 길이 또한 화면 폭 대비로 잡아줍니다.
    this.barWidth = Math.max(120, Math.round(w * 0.28));
  }

  /**
   * UI 스케일 값이 달라졌을 때 이미 그려진 UI 스탯이나 바 길이를 조절하는 함수
   */
  private repositionUI() {
    if (!this.uiText) return;
    const fontSize = Math.max(12, Math.round(16 * this.uiScale));
    this.uiText.setFontSize(fontSize);
    this.uiText.setPosition(10 * this.uiScale, 10 * this.uiScale);

    const barY = (10 + fontSize + 12) * this.uiScale;
    this.xpBarBg.clear();
    this.xpBarBg.fillStyle(0x555555, 1);
    this.xpBarBg.fillRect(10 * this.uiScale, barY, this.barWidth, 16 * this.uiScale);

    const hpBarY = barY + 20 * this.uiScale;
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x555555, 1);
    this.hpBarBg.fillRect(10 * this.uiScale, hpBarY, this.barWidth, 12 * this.uiScale);

    this.updateXPBar(this.myPlayerStats.xp, this.myPlayerStats.xpMax);
    this.updateHPBar(this.myPlayerStats.hp, this.myPlayerStats.maxHp);
  }

  /**
   * 모바일 한정 가상 조이스틱을 좌측 하단 화면에 생성합니다.
   * Phaser Input Pointer (터치 이벤트 감지 체계)에 핸들러들을 등록합니다.
   */
  private createJoystick() {
    const cam = this.cameras.main;
    const baseRadius = Math.round(55 * this.uiScale);
    const thumbRadius = Math.round(24 * this.uiScale);

    // 화면 테두리에서 약간 떨어진 기본 위치
    const cx = baseRadius + 30;
    const cy = cam.height - baseRadius - 30;

    // 투명도 15% 바깥 조이스틱 원 영역
    this.joystickBase = this.add.circle(cx, cy, baseRadius, 0xffffff, 0.15)
      .setScrollFactor(0).setDepth(200).setStrokeStyle(2, 0xffffff, 0.4);

    // 투명도 40% 조작용 내부 스틱
    this.joystickThumb = this.add.circle(cx, cy, thumbRadius, 0xffffff, 0.4)
      .setScrollFactor(0).setDepth(201);

    this.input.addPointer(2); // 두 개의 멀티 터치 포인터를 지원

    // 모바일 스크린 '터치 시작'시 콜백
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // 포인터가 화면 좌측 절반에 있을 때만 방향 이동 조이스틱으로 간주 (우측은 사격 버튼 배치를 대비)
      if (pointer.x < cam.width * 0.5 && this.joystickPointerID === -1) {
        this.joystickPointerID = pointer.id;
        this.joystickActive = true;
        // 손가락 터치 위치로 조이스틱 베이스와 썸을 즉시 이동(스냅)시킵니다.
        this.joystickBase.setPosition(pointer.x, pointer.y);
        this.joystickThumb.setPosition(pointer.x, pointer.y);
      }
    });

    // 모바일 스크린 '터치 상태 이동(드래그)'시 콜백
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerID && this.joystickActive) {
        const baseRadius = this.joystickBase.radius;

        // 중심에서 떨어진 위치 변위
        const dx = pointer.x - this.joystickBase.x;
        const dy = pointer.y - this.joystickBase.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 손가락 위치가 원 밖으로 벗어나면 원의 경계까지만 썸이 따라가도록 합니다. (정규화 이용)
        if (dist > baseRadius) {
          this.joystickThumb.setPosition(
            this.joystickBase.x + (dx / dist) * baseRadius,
            this.joystickBase.y + (dy / dist) * baseRadius
          );
          this.joystickVector = { x: dx / dist, y: dy / dist };
        } else {
          // 원 안에 있으면 터치 위치 그대로 이동
          this.joystickThumb.setPosition(pointer.x, pointer.y);
          this.joystickVector = { x: dx / baseRadius, y: dy / baseRadius };
        }
      }
    });

    // 모바일 스크린 '손 떼기(터치 해제)' 콜백
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerID) {
        this.joystickPointerID = -1;
        this.joystickActive = false;
        this.joystickVector = { x: 0, y: 0 }; // 방향 0 고정 (정지 상태)
        // 조이스틱을 다시 좌측하단 기본값으로 리턴(숨김 역할 수행)합니다.
        this.repositionJoystick();
        this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
      }
    });
  }

  /**
   * 윈도우 크기 변동 시 모바일 조이스틱을 알맞은 스케일로 다시 우측하단으로 배치하는 유틸
   */
  private repositionJoystick() {
    if (!this.joystickBase) return;
    const cam = this.cameras.main;
    const baseRadius = Math.round(55 * this.uiScale);
    const cx = baseRadius + 30;
    const cy = cam.height - baseRadius - 30;

    this.joystickBase.setRadius(baseRadius);
    this.joystickBase.setPosition(cx, cy);
    this.joystickThumb.setRadius(Math.round(24 * this.uiScale));
    this.joystickThumb.setPosition(cx, cy);
  }

  /**
   * Colyseus Websocket 서버와 접속을 수행합니다.
   * 접속 성공 시 'game_room'에 들어가고 setupRoomHandlers를 호출해 콜백 리스너를 매핑합니다.
   */
  private async connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const endpoint = `${protocol}//${window.location.host}`; // 같은 주소를 호스팅하는 포트를 이용합니다
    this.client = new Colyseus.Client(endpoint);
    try {
      this.room = await this.client.joinOrCreate("game_room", { nickname: this.myNickname });
      console.log("Joined successfully", this.room.sessionId);
      this.mySessionId = this.room.sessionId; // 발급받은 아이디를 저장해 '나의 캐릭터 정보' 판단에 씀

      this.uiText.setText("Connected!");
      this.setupRoomHandlers(); // 네트워크 콜백 설정 시작
    } catch (e) {
      console.error("JOIN ERROR", e);
      this.uiText.setText("Failed to connect to server");
    }
  }

  /**
   * 방 접속 이후, 서버가 내려주는 스키마 업데이트 패킷을 Phaser 객체 동작에 일대일 매핑하는 단계입니다.
   * 크게 Players(플레이어 목록), Orbs(구슬 먹이), Bullets(발사체) 세 가지 동기화 담당.
   */
  setupRoomHandlers() {
    if (!this.room) return;

    // Colyseus 0.15 Schema 콜백용 프록시 (상태 필드 변경 시 트리거 지정 목적)
    const $ = getStateCallbacks(this.room);

    // --- 플레이어 스폰 (onAdd) 동기화 ---
    $(this.room.state).players.onAdd((player: any, sessionId: string) => {
      // 다른 렌더링에 덮히지 않게 Depth 20 위에 고정되는 플레이어 닉네임 텍스트 객체 생성
      const nameText = this.add.text(player.x, player.y - 30, player.nickname || "Unknown", {
        fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5, 0.5).setDepth(20);
      this.playerNameTexts[sessionId] = nameText;

      // '방금 추가된 유저가 현재 세션을 소유한 나 자신' 일 때
      if (sessionId === this.mySessionId) {
        this.mySprite = this.add.sprite(player.x, player.y, 'playerTexture');
        this.mySprite.setDepth(10);

        // 내 캐릭터 주변을 카메라가 자동으로 중앙에 오도록 고정(Follow)
        this.cameras.main.startFollow(this.mySprite, true, 1, 1);
        this.mySpeed = player.speed;

        // 기초 스탯 반영
        this.myPlayerStats = {
          level: player.level, xp: player.xp, xpMax: player.xpMax,
          damage: player.damage, attackSpeed: player.attackSpeed,
          range: player.range, hp: player.hp, maxHp: player.maxHp,
          levelUpsPending: player.levelUpsPending,
          magnetRadius: player.magnetRadius, shotgunLevel: player.shotgunLevel, bulletSize: player.bulletSize
        };
        this.updateUIText(); // 우상단 스탯 정보 UI 텍스트 그리기 갱신

        // 보간될 타겟 저장 위치 초기값
        this.playerTargets[sessionId] = { x: player.x, y: player.y };

        // [핵심] 서버에서 '내 캐릭터의 수치 정보가 변경'될 때 마다 통지
        $(player).onChange(() => {
          // 목표 위치만 타겟 딕셔너리에 갱신, 나중에 update 루프(dt)에서 lerp 함.
          this.playerTargets[sessionId] = { x: player.x, y: player.y };

          // 현재 레벨업 보류 횟수 기억
          const prevPending = this.myPlayerStats.levelUpsPending;
          this.myPlayerStats = {
            level: player.level, xp: player.xp, xpMax: player.xpMax,
            damage: player.damage, attackSpeed: player.attackSpeed,
            range: player.range, hp: player.hp, maxHp: player.maxHp,
            levelUpsPending: player.levelUpsPending,
            magnetRadius: player.magnetRadius, shotgunLevel: player.shotgunLevel, bulletSize: player.bulletSize
          };

          // 즉시 바의 색상과 퍼센트 다시 그림
          this.updateUIText();
          this.updateXPBar(player.xp, player.xpMax);
          this.updateHPBar(player.hp, player.maxHp);

          // 새로 생긴 레벨업 횟수가 존재하면 onLevelUp 이벤트를 부모 요소(React App.tsx)로 방출
          if (player.levelUpsPending > 0 && player.levelUpsPending > prevPending) {
            if (this.latestChoices.length > 0) {
              this.events.emit('onLevelUp', {
                pending: player.levelUpsPending,
                choices: this.latestChoices,
                stats: this.myPlayerStats
              });
            }
          } else if (player.levelUpsPending === 0 && prevPending > 0) {
            // 스탯을 다 써서 남은 레벨업 포인트가 사라졌을 때
            this.latestChoices = [];
            this.events.emit('onLevelUp', { pending: 0, choices: [] });
          }
        });

        // 서버가 보내주는 3가지 랜덤 선택지 패킷 수신
        this.room.onMessage("onLevelUpChoices", (message: { choices: string[] }) => {
          this.latestChoices = message.choices;
          if (this.myPlayerStats.levelUpsPending > 0) {
            this.events.emit('onLevelUp', {
              pending: this.myPlayerStats.levelUpsPending,
              choices: this.latestChoices,
              stats: this.myPlayerStats
            });
          }
        });

        // 서버에서 사망 메시지 수신: 클라이언트의 업그레이드 기록도 리셋합니다.
        this.room.onMessage("onPlayerDeath", () => {
          this.myStatLevels = {
            damage: 0, attackSpeed: 0, range: 0, speed: 0,
            maxHp: 0, magnetRadius: 0, shotgunLevel: 0, bulletSize: 0
          };
          this.events.emit('onStatUpdate', { ...this.myStatLevels });
        });
        return;
      }

      // 나와 다른 제3 플레이어가 접속했을 경우
      const sprite = this.add.sprite(player.x, player.y, 'playerTexture');
      this.playerSprites[sessionId] = sprite;
      this.playerTargets[sessionId] = { x: player.x, y: player.y };

      // 서버에서 제3자의 위치나 기타값이 변경되었을 때 콜백
      $(player).onChange(() => {
        this.playerTargets[sessionId] = { x: player.x, y: player.y };
      });
    });

    // --- 플레이어 퇴장 (onRemove) 동기화 ---
    $(this.room.state).players.onRemove((_player: any, sessionId: string) => {
      if (sessionId === this.mySessionId) {
        if (this.mySprite) this.mySprite.destroy();
      }
      if (this.playerSprites[sessionId]) {
        this.playerSprites[sessionId].destroy();
        delete this.playerSprites[sessionId];
      }
      if (this.playerNameTexts[sessionId]) {
        this.playerNameTexts[sessionId].destroy();
        delete this.playerNameTexts[sessionId];
      }
      delete this.playerTargets[sessionId];
    });

    // --- 경험치 구슬 먹이 (Orbs) 동기화 ---
    const orbTextures = ['orbSmall', 'orbMedium', 'orbLarge'];
    $(this.room.state).orbs.onAdd((orb: any, orbId: string) => {
      // 서버 스키마에 정의된 사이즈 타입(0, 1, 2)에 따라 텍스처를 입힌 후 생성
      const textureName = orbTextures[orb.orbType] || 'orbSmall';
      const sprite = this.add.sprite(orb.x, orb.y, textureName);
      this.orbSprites[orbId] = sprite;
    });

    // 유저나 총알이 치워버린 오브젝트는 씬에서 지움
    $(this.room.state).orbs.onRemove((_orb: any, orbId: string) => {
      if (this.orbSprites[orbId]) {
        this.orbSprites[orbId].destroy();
        delete this.orbSprites[orbId];
      }
    });

    // --- 투사체 총알 (Bullets) 동기화 ---
    $(this.room.state).bullets.onAdd((bullet: any, bulletId: string) => {
      const sprite = this.add.sprite(bullet.x, bullet.y, 'bulletTexture');

      // 총알 스케일 반영 (기본 1)
      const scale = bullet.scale || 1;
      sprite.setScale(scale);

      this.bulletSprites[bulletId] = sprite; // 시각적 오브젝트
      this.bulletTargets[bulletId] = { x: bullet.x, y: bullet.y }; // 보간 목표 위치
      this.bulletVelocities[bulletId] = { vx: bullet.velocityX, vy: bullet.velocityY }; // 예측(추측 항법)을 위한 속도 정보 추가

      $(bullet).onChange(() => {
        this.bulletTargets[bulletId] = { x: bullet.x, y: bullet.y };
      });
    });

    $(this.room.state).bullets.onRemove((_bullet: any, bulletId: string) => {
      if (this.bulletSprites[bulletId]) {
        this.bulletSprites[bulletId].destroy();
        delete this.bulletSprites[bulletId];
      }
      delete this.bulletTargets[bulletId];
      delete this.bulletVelocities[bulletId];
    });

    // 타임 루프: 서버 데이터들을 매 1000ms 마다 수거 분석해서 React 로 전송합니다
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const players: any[] = [];
        // 등록된 플레이어 맵을 리스트로 변경해 순차 조회
        this.room.state.players.forEach((p: any, id: string) => {
          players.push({
            sessionId: id,
            nickname: p.nickname || "Unknown",
            level: p.level,
            xp: p.xp
          });
        });

        // 레벨 내림차순(높은순) 정렬하되, 레벨이 같을 때는 XP 양 기준으로 정렬 처리
        players.sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          return b.xp - a.xp;
        });

        // 리더보드용 상위 10명을 뽑아서 부모 컴포넌트 React 측에 방출
        const top10 = players.slice(0, 10);
        this.events.emit('onLeaderboardUpdate', top10);
      }
    });
  }

  /**
   * Phaser Game Loop 단계
   * 매 프레임(약 60fps, 16ms 주기로) 불려옵니다. 물리 보간, 스크롤 매핑 등을 합니다.
   * @param _time 실행시간(ms)
   * @param delta 프레임간 흐른 시간(ms)
   */
  update(_time: number, delta: number) {
    if (!this.room) return;

    const dt = delta / 1000; // 밀리초(ms) → 초(seconds) 단위로 변환해 위치 연산에 활용

    // 배경(그리드)은 이제 월드 공간에 배치되어 있으므로 tilePosition 동기화가 필요 없습니다.

    // --- 내 캐릭터 클라이언트 예측 처리 (Client-side Prediction/Lerping) ---
    if (this.mySprite) {
      if (this.isMobile && this.joystickActive) {
        // 모바일의 경우 조이스틱 방향 벡터로 로컬 즉각 이동 (응답속도 개선 목적)
        const vx = this.joystickVector.x * this.mySpeed * dt;
        const vy = this.joystickVector.y * this.mySpeed * dt;
        this.mySprite.x += vx;
        this.mySprite.y += vy;

        // 맵 경계 밖으로 벗어나는 것 제한 (물리 충돌 벽 대체)
        this.mySprite.x = Math.max(0, Math.min(this.mySprite.x, MAP_WIDTH));
        this.mySprite.y = Math.max(0, Math.min(this.mySprite.y, MAP_HEIGHT));
      } else if (!this.isMobile) {
        // 데스크톱 환경에서는 마우스 포인터의 위치를 목표로 부드럽게 접근합니다.
        const pointer = this.input.activePointer;
        const targetX = pointer.worldX;
        const targetY = pointer.worldY;
        const dx = targetX - this.mySprite.x;
        const dy = targetY - this.mySprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 떨림 현상 방지를 위해 어느정도 거리 갭(10px) 이상 차이날 때만 움직임
        if (dist > 10) {
          const vx = (dx / dist) * this.mySpeed * dt;
          const vy = (dy / dist) * this.mySpeed * dt;
          this.mySprite.x += vx;
          this.mySprite.y += vy;

          this.mySprite.x = Math.max(0, Math.min(this.mySprite.x, MAP_WIDTH));
          this.mySprite.y = Math.max(0, Math.min(this.mySprite.y, MAP_HEIGHT));
        }
      }

      // 클라이언트에서 먼저 마음대로 이동(예측) 하다가, 실제 서버의 진실된 타겟 위치 정보와 갭이 생기면(고무줄 현상) 서서히 보정합니다.
      const serverTarget = this.playerTargets[this.mySessionId];
      if (serverTarget) {
        this.mySprite.x += (serverTarget.x - this.mySprite.x) * 0.05;
        this.mySprite.y += (serverTarget.y - this.mySprite.y) * 0.05;
      }

      // 내 닉네임을 캐릭터 머리 위 30px지점에 고정
      const myNameText = this.playerNameTexts[this.mySessionId];
      if (myNameText) {
        myNameText.setPosition(this.mySprite.x, this.mySprite.y - 30);
      }
    }

    // --- 상대편 적 플레이어 이동 보간 (Interpolation) ---
    for (const sessionId in this.playerSprites) {
      const sprite = this.playerSprites[sessionId];
      const target = this.playerTargets[sessionId];
      if (sprite && target) {
        // 예측 없이 서서히 타겟위치로 20% 접근 보간(Lerp) 방식을 사용합니다.
        sprite.x += (target.x - sprite.x) * 0.2;
        sprite.y += (target.y - sprite.y) * 0.2;

        const nameText = this.playerNameTexts[sessionId];
        if (nameText) {
          nameText.setPosition(sprite.x, sprite.y - 30);
        }
      }
    }

    // --- 발사 중인 총알들 클라이언트 측 예측 보간 이동 (Dead Reckoning 적용) ---
    for (const bulletId in this.bulletSprites) {
      const sprite = this.bulletSprites[bulletId];
      const vel = this.bulletVelocities[bulletId];
      const target = this.bulletTargets[bulletId];
      if (sprite && vel) {
        // 속도 * 초과 시간을 반영해서 로컬 클라이언트 단에서 직선 이동시킨다. (부드러운 시각 효과 확보 목적)
        sprite.x += vel.vx * dt;
        sprite.y += vel.vy * dt;
        // 하지만 물리 동기화를 위해 서버의 현재 값과 50px(제곱 2500)이상 너무 크게 떨어져 있을 땐 순간이동 스냅
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

    // --- 마우스 위치 정보를 50ms (0.05초)마다 서버로 보내는 과부하 방지 타이머 ---
    this.sendTimer += delta;
    if (this.sendTimer >= 50) {
      this.sendTimer = 0;
      if (this.isMobile) {
        // 모바일: 내가 조이스틱을 기울이고 있을 때 꺾인 기준방향의 저 멀리(500지점) 좌표를 서버로 보냄으로서
        // 서버 물리엔진이 계속 걷는것으로 간주하도록 처리.
        if (this.joystickActive && this.mySprite) {
          const farX = this.mySprite.x + this.joystickVector.x * 500;
          const farY = this.mySprite.y + this.joystickVector.y * 500;
          this.room.send("move", { x: farX, y: farY });
        }
      } else {
        // 데스크톱: 실제 모니터 월드의 마우스 클릭 위치를 보내 이동 목적지로 통보.
        const pointer = this.input.activePointer;
        if (pointer.worldX !== 0 || pointer.worldY !== 0) {
          this.room.send("move", { x: pointer.worldX, y: pointer.worldY });
        }
      }
    }
  }

  /**
   * 화면 좌측 상단의 플레이어 레벨, 체력, ATK 등의 요약 정보를 그리는 UI 렌더
   */
  updateUIText() {
    if (this.uiText && this.myPlayerStats) {
      const p = this.myPlayerStats;
      this.uiText.setText(
        `Lv ${p.level}  XP: ${Math.floor(p.xp)}/${p.xpMax}\nATK:${p.damage} SPD:${p.attackSpeed}ms RNG:${p.range}\nHP: ${Math.floor(p.hp)}/${p.maxHp}`
      );
    }
  }

  /**
   * 경험치 바의 길이를 퍼센테이지에 맞추어 그리기
   * @param xp 현재 경험치량
   * @param xpMax 최대 도달 필요 경험치량
   */
  updateXPBar(xp: number, xpMax: number) {
    if (!this.xpBarFill) return;
    this.xpBarFill.clear();                  // 기존 그려진 게이지 지우기
    this.xpBarFill.fillStyle(0x00ff00, 1);   // 연녹색
    const pct = Math.min(xp / xpMax, 1);     // 안전하게 퍼센트는 100% 이내로 고정시킴
    const fontSize = Math.max(12, Math.round(16 * this.uiScale));
    const barY = (10 + fontSize + 12) * this.uiScale;
    // barWidth 기준으로 비례 도면에 그려 넣기
    this.xpBarFill.fillRect(10 * this.uiScale, barY, this.barWidth * pct, 16 * this.uiScale);
  }

  /**
   * 체력 바의 길이를 비율에 맞추어 그리기. 체력 소진 비율에 따라 색상을 위협적인 빨강톤으로 바꿉니다.
   */
  updateHPBar(hp: number, maxHp: number) {
    if (!this.hpBarFill) return;
    this.hpBarFill.clear();
    const pct = Math.min(hp / maxHp, 1);

    // 체력 감소에 따른 게이지 컬러 세팅 (안정: 녹색 -> 절반: 주황 -> 위험: 빨강)
    if (pct > 0.5) {
      this.hpBarFill.fillStyle(0x2ecc71, 1); // 녹색
    } else if (pct > 0.25) {
      this.hpBarFill.fillStyle(0xf39c12, 1); // 주황색
    } else {
      this.hpBarFill.fillStyle(0xe74c3c, 1); // 빨간색
    }
    const fontSize = Math.max(12, Math.round(16 * this.uiScale));
    const barY = (10 + fontSize + 12) * this.uiScale;
    const hpBarY = barY + 20 * this.uiScale; // 경험치바 아래로 내려놓음
    this.hpBarFill.fillRect(10 * this.uiScale, hpBarY, this.barWidth * pct, 12 * this.uiScale);
  }

  /**
   * 사용자가 UI(모달 등)에서 능력을 클릭했을 때 서버의 리셉터로 통지를 진행합니다.
   * @param stat 향상시킬 스탯 종류
   */
  applyStat(stat: string) {
    if (this.room) {
      // Colyseus 룸 메시지 발신 ('upgradeLevel', {stat: 종류}) 전파
      this.room.send("upgradeLevel", { stat });

      // 스탯 업그레이드 횟수 카운팅 및 React에 방출
      if (stat in this.myStatLevels) {
        this.myStatLevels[stat as keyof StatLevels]++;
        this.events.emit('onStatUpdate', { ...this.myStatLevels });
      }
    }
  }

  /**
   * 현재 업그레이드 횟수 정보를 반환합니다. (초기 로드 시 사용)
   */
  getStatLevels(): StatLevels {
    return { ...this.myStatLevels };
  }
}
