import Phaser from 'phaser';
import { isMobileDevice } from '../../utils/device';

export class InputController {
  private scene: Phaser.Scene;
  private isMobile: boolean = false;
  private uiScale: number = 1;

  // 조이스틱 UI 요소
  private joystickBase?: Phaser.GameObjects.Arc;
  private joystickThumb?: Phaser.GameObjects.Arc;
  private joystickPointerID: number = -1;
  private joystickVector = { x: 0, y: 0 };
  private joystickActive = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isMobile = isMobileDevice(); // 접속 기기 모바일 여부 판별
    this.updateUIScale();

    // 리사이즈 이벤트 시 스케일 갱신 및 조이스틱 재배치
    this.scene.scale.on('resize', () => {
      this.updateUIScale();
      if (this.isMobile) {
        this.repositionJoystick();
      }
    });

    if (this.isMobile) {
      this.createJoystick();
    }
  }

  getIsMobile(): boolean {
    return this.isMobile;
  }

  getJoystickActive(): boolean {
    return this.joystickActive;
  }

  getJoystickVector(): { x: number, y: number } {
    return this.joystickVector;
  }

  /**
   * 데스크톱 PC 전용: 활성화된 마우스 포인터의 월드 좌표를 가져옵니다.
   */
  getPointerWorldPosition(): { x: number, y: number } {
    const pointer = this.scene.input.activePointer;
    return { x: pointer.worldX, y: pointer.worldY };
  }

  private updateUIScale() {
    if (!this.scene.cameras.main) return;
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const minDim = Math.min(w, h);

    // 너무 작아지지 않게 방지 (하한 0.6x, 상한 1.2x)
    this.uiScale = Math.max(0.6, Math.min(1.2, minDim / 800));
  }

  /**
   * 모바일 한정 가상 조이스틱 생성
   */
  private createJoystick() {
    const cam = this.scene.cameras.main;
    const baseRadius = Math.round(55 * this.uiScale);
    const thumbRadius = Math.round(24 * this.uiScale);

    const cx = cam.width / 2;
    const cy = cam.height - baseRadius - 60;

    this.joystickBase = this.scene.add.circle(cx, cy, baseRadius, 0xffffff, 0.15)
      .setScrollFactor(0).setDepth(200).setStrokeStyle(2, 0xffffff, 0.4);

    this.joystickThumb = this.scene.add.circle(cx, cy, thumbRadius, 0xffffff, 0.4)
      .setScrollFactor(0).setDepth(201);

    this.scene.input.addPointer(2);

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerID === -1) {
        this.joystickPointerID = pointer.id;
        this.joystickActive = true;
        if (this.joystickBase && this.joystickThumb) {
          this.joystickBase.setPosition(pointer.x, pointer.y);
          this.joystickThumb.setPosition(pointer.x, pointer.y);
        }
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerID && this.joystickActive && this.joystickBase && this.joystickThumb) {
        const baseRadius = this.joystickBase.radius;
        const dx = pointer.x - this.joystickBase.x;
        const dy = pointer.y - this.joystickBase.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > baseRadius) {
          this.joystickThumb.setPosition(
            this.joystickBase.x + (dx / dist) * baseRadius,
            this.joystickBase.y + (dy / dist) * baseRadius
          );
          this.joystickVector = { x: dx / dist, y: dy / dist };
        } else {
          this.joystickThumb.setPosition(pointer.x, pointer.y);
          this.joystickVector = { x: dx / baseRadius, y: dy / baseRadius };
        }
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerID) {
        this.joystickPointerID = -1;
        this.joystickActive = false;
        this.joystickVector = { x: 0, y: 0 };
        this.repositionJoystick();
        if (this.joystickThumb && this.joystickBase) {
          this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
        }
      }
    });
  }

  /**
   * 윈도우 크기 변동 시 조이스틱 크기 및 배열 재조정
   */
  private repositionJoystick() {
    if (!this.joystickBase || !this.joystickThumb) return;
    const cam = this.scene.cameras.main;
    const baseRadius = Math.round(55 * this.uiScale);
    const cx = cam.width / 2;
    const cy = cam.height - baseRadius - 60;

    this.joystickBase.setRadius(baseRadius);
    this.joystickBase.setPosition(cx, cy);
    this.joystickThumb.setRadius(Math.round(24 * this.uiScale));
    this.joystickThumb.setPosition(cx, cy);
  }
}
