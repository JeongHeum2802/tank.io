import Phaser from 'phaser';

export class AssetManager {
  /**
   * 게임에서 사용할 동적 텍스처(Graphics -> Texture)를 생성합니다.
   * @param scene 현재 씬
   */
  static preload(scene: Phaser.Scene) {
    // 플레이어 텍스처 생성 (흰색 원, 렌더링 시 setTint 보정)
    const playerGfx = scene.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillCircle(20, 20, 20);
    playerGfx.generateTexture('playerTexture', 40, 40);
    playerGfx.destroy();

    // 맵에 떨어져 있는 경험치 구슬(Orb) 텍스처 생성 - 소형(초록), 중형(파랑), 대형(금색)
    const orbSmallGfx = scene.make.graphics({ x: 0, y: 0 });
    orbSmallGfx.fillStyle(0x2ecc71, 1);
    orbSmallGfx.fillCircle(6, 6, 6);
    orbSmallGfx.generateTexture('orbSmall', 12, 12);
    orbSmallGfx.destroy();

    const orbMedGfx = scene.make.graphics({ x: 0, y: 0 });
    orbMedGfx.fillStyle(0x3498db, 1);
    orbMedGfx.fillCircle(10, 10, 10);
    orbMedGfx.generateTexture('orbMedium', 20, 20);
    orbMedGfx.destroy();

    const orbLargeGfx = scene.make.graphics({ x: 0, y: 0 });
    orbLargeGfx.fillStyle(0xf1c40f, 1);
    orbLargeGfx.fillCircle(14, 14, 14);
    orbLargeGfx.generateTexture('orbLarge', 28, 28);
    orbLargeGfx.destroy();

    // 발사체(총알) 텍스처 생성 (흰색 점, 렌더링 시 setTint 보정)
    const bulletGfx = scene.make.graphics({ x: 0, y: 0 });
    bulletGfx.fillStyle(0xffffff, 1);
    bulletGfx.fillCircle(5, 5, 5);
    bulletGfx.generateTexture('bulletTexture', 10, 10);
    bulletGfx.destroy();

    // 바닥에 그려질 격자 무늬(Grid) 텍스처 생성
    const gridGfx = scene.make.graphics({ x: 0, y: 0 });
    gridGfx.lineStyle(1, 0x333333, 0.8);
    gridGfx.strokeRect(0, 0, 64, 64);
    gridGfx.generateTexture('gridTile', 64, 64);
    gridGfx.destroy();
  }
}
