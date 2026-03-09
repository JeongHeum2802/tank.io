import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

import type { LevelUpState, LeaderboardEntry } from './types';
import { isMobileDevice } from './utils/device';
import { GameScene } from './game/GameScene';
import { LoginScreen } from './components/LoginScreen';
import { Leaderboard } from './components/Leaderboard';
import { LevelUpModal } from './components/LevelUpModal';

/**
 * App 컴포넌트
 * - 로그인 상태(isJoined)에 따라 LoginScreen 또는 게임 화면(Phaser + UI)을 렌더링.
 * - Phaser 게임 인스턴스를 초기화하고, 게임 내에서 발생하는 이벤트(레벨업, 리더보드 갱신)를 수신하여 React 상태로 관리합니다.
 */
function App() {
  // Phaser 게임이 렌더링될 DOM 요소를 참조합니다.
  const gameContainer = useRef<HTMLDivElement>(null);
  // 생성된 Phaser 게임 인스턴스를 참조합니다. 컴포넌트 언마운트 시 정리(destroy)하기 위해 사용합니다.
  const gameRef = useRef<Phaser.Game | null>(null);

  // 레벨업 팝업창을 띄우기 위한 상태 (보류중인 포인트 갯수와 현재 스탯 정보를 포함)
  const [levelUpData, setLevelUpData] = React.useState<LevelUpState | null>(null);
  // 우측 상단 리더보드에 표시될 상위 플레이어 목록 상태
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  // 접속 시 사용할 닉네임 상태
  const [nickname, setNickname] = React.useState<string>("");
  // 게임 접속(로그인 완료) 여부 상태
  const [isJoined, setIsJoined] = React.useState<boolean>(false);
  // 현재 접속 환경이 모바일인지 여부를 저장 (UI 크기 및 배치 결정에 사용)
  const [isMobile] = React.useState<boolean>(isMobileDevice());

  // isJoined 상태가 true가 되면(로그인 성공 시) Phaser 게임을 초기화합니다.
  useEffect(() => {
    if (!isJoined || !gameContainer.current || gameRef.current) return;

    // Phaser 게임 설정 (리사이즈 모드, 해상도, 배경색 등)
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,                   // WebGL 또는 Canvas 자동 선택
      scale: {
        mode: Phaser.Scale.RESIZE,       // 브라우저 창 크기에 맞춰 자동 리사이즈
        parent: gameContainer.current,   // 렌더링될 DOM 요소 지정
        width: '100%',
        height: '100%'
      },
      backgroundColor: '#1a1a2e',          // 기본 배경색 지정
      scene: [],                           // 처음엔 빈 씬 배열로 시작 (수동으로 추가 예정)
      input: {
        touch: {
          capture: true,               // 모바일 터치 이벤트 캡처 설정
        }
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // GameScene을 추가하고 실행합니다. 이때 사용자가 입력한 닉네임을 데이터로 넘겨줍니다.
    game.scene.add('GameScene', GameScene, true, { nickname: nickname.trim() || 'Unknown' });

    // Phaser 씬(GameScene)에서 발생하는 커스텀 이벤트들을 React 상태와 연결합니다.
    const setupSceneEvents = () => {
      const scene = game.scene.getScene('GameScene') as GameScene;
      if (scene) {
        // 레벨업 이벤트 수신: 레벨업 시 포인트가 있으면 팝업 데이터를 세팅, 없으면 숨김
        scene.events.on('onLevelUp', (data: LevelUpState) => {
          if (data.pending > 0) {
            setLevelUpData(data);
          } else {
            setLevelUpData(null);
          }
        });
        // 리더보드 이벤트 수신: 상위 10명의 정보를 React 상태로 업데이트 (화면에 렌더링 됨)
        scene.events.on('onLeaderboardUpdate', (data: LeaderboardEntry[]) => {
          setLeaderboard(data);
        });
      } else {
        // 씬이 아직 준비되지 않았다면 200ms 후 다시 시도합니다.
        setTimeout(setupSceneEvents, 200);
      }
    };
    // 게임 초기화 후 씬이 생성될 시간을 주기 위해 약간의 지연 후 이벤트 리스너를 등록합니다.
    setTimeout(setupSceneEvents, 500);

    // 컴포넌트가 언마운트될 때(예: 페이지 이탈 등) 메모리 누수를 막기 위해 게임 인스턴스를 파괴합니다.
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [isJoined]); // isJoined 상태가 변경될 때만 이펙트가 실행됩니다.

  /**
   * 레벨업 모달에서 업그레이드 버튼을 클릭했을 때 호출되는 핸들러입니다.
   * Phaser의 GameScene으로 업그레이드 명령을 전달합니다.
   */
  const handleStatUpgrade = (stat: 'damage' | 'attackSpeed' | 'range') => {
    const scene = gameRef.current?.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.applyStat(stat);
    }
  };

  // 아직 접속하지 않은 상태(isJoined === false)라면 로그인 화면을 보여줍니다.
  if (!isJoined) {
    return <LoginScreen nickname={nickname} setNickname={setNickname} onJoin={() => setIsJoined(true)} />;
  }

  // 접속에 성공했다면 메인 뷰(Phaser 캔버스 + React UI 오버레이)를 렌더링합니다.
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Phaser 게임이 실제로 렌더링되는 영역입니다. 전체 화면을 덮습니다. */}
      <div ref={gameContainer} style={{ width: '100%', height: '100%' }} />

      {/* React UI Overlays: 게임 화면 위에 겹쳐서(absolute) 띄워집니다. */}
      {/* 우측 상단 리더보드 */}
      <Leaderboard leaderboard={leaderboard} isMobile={isMobile} />
      {/* 레벨업 발생 시 화면 중앙에 나타나는 스탯 업그레이드 모달 */}
      <LevelUpModal levelUpData={levelUpData} isMobile={isMobile} onUpgrade={handleStatUpgrade} />
    </div>
  );
}

export default App;
