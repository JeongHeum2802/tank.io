import React from 'react';
import type { LevelUpState } from '../types';

interface LevelUpModalProps {
  levelUpData: LevelUpState | null;                                    // 레벨업 팝업에 표시할 데이터 (보유 스탯, 진행 횟수, 선택지)
  isMobile: boolean;                                                   // 모바일 화면 여부
  onUpgrade: (stat: string) => void;                                   // 업그레이드 버튼 클릭 시 포워딩할 콜백 함수
}

// 스탯 ID 에 따른 시각적 아이콘과 한국어 텍스트 및 설명을 매핑해놓은 딕셔너리
const STAT_UI_CONFIG: Record<string, { icon: string; name: string; desc: string; color: string }> = {
  damage: { icon: '⚔️', name: '공격력', desc: '+5', color: '#e74c3c' },
  attackSpeed: { icon: '⚡', name: '공격속도', desc: '-100ms', color: '#db8734' },
  range: { icon: '🎯', name: '사거리', desc: '+500', color: '#34db7a' },
  speed: { icon: '👟', name: '이동속도', desc: '+20', color: '#3498db' },
  maxHp: { icon: '❤️', name: '최대체력', desc: '+20', color: '#e84393' },
  magnetRadius: { icon: '🧲', name: '자석', desc: '범위 +30', color: '#9b59b6' },
  shotgunLevel: { icon: '🔫', name: '다중 발사', desc: '발사체 +2', color: '#f39c12' },
  bulletSize: { icon: '💣', name: '총알 크기', desc: '크기 +30%', color: '#34495e' },
};

/**
 * LevelUpModal 컴포넌트
 * 플레이어가 레벨업을 했을 때 서버로부터 받은 3가지 무작위 선택지를 렌더링하는 모달입니다.
 */
export const LevelUpModal: React.FC<LevelUpModalProps> = ({ levelUpData, isMobile, onUpgrade }) => {
  // 렌더링 조건: 레벨업 데이터가 없거나 보류중인 포인트가 없거나, 선택지가 아직 안도착했으면 뷰를 숨김
  if (!levelUpData || levelUpData.pending <= 0 || !levelUpData.choices || levelUpData.choices.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', // 화면의 정중앙에 배치
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.85)',
      // 모바일일때는 패딩을 줄이고 폭 제약을 완화합니다.
      padding: isMobile ? '20px 16px' : '30px',
      borderRadius: '12px', color: 'white',
      textAlign: 'center', zIndex: 1000,
      border: '2px solid #f1c40f',
      width: isMobile ? 'min(300px, 88vw)' : 'auto',
      minWidth: isMobile ? 'unset' : '380px',
      boxSizing: 'border-box'
    }}>
      {/* 제목 영역 */}
      <h2 style={{
        margin: '0 0 8px', color: '#f1c40f',
        fontSize: isMobile ? '20px' : '24px' // 모바일 폰트 사이즈 조절
      }}>🎉 Level Up!</h2>

      {/* 남은 레벨업 포인트 안내 텍스트 */}
      <p style={{
        margin: '0 0 16px', color: '#ccc',
        fontSize: isMobile ? '13px' : '16px'
      }}>
        남은 레벨업: {levelUpData.pending}
      </p>

      <br />
      {/* 동적으로 맵핑되어 생성되는 3개의 버튼 목록 */}
      <div style={{
        display: 'flex', gap: isMobile ? '8px' : '10px',
        justifyContent: 'center',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        {levelUpData.choices.map((statKey) => {
          const config = STAT_UI_CONFIG[statKey] || { icon: '❓', name: statKey, desc: '알 수 없음', color: '#555' };
          return (
            <button
              key={statKey}
              onClick={() => onUpgrade(statKey)}
              style={{
                padding: isMobile ? '10px 8px' : '16px 16px',
                fontSize: isMobile ? '12px' : '14px', cursor: 'pointer',
                background: config.color, color: 'white', border: 'none',
                borderRadius: '8px', fontWeight: 'bold',
                flex: isMobile ? 1 : '1 1 0px', // 공간 균등 배분
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                transition: 'transform 0.1s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: isMobile ? '20px' : '28px' }}>{config.icon}</span>
              <span>{config.name}</span>
              <span style={{ fontSize: isMobile ? '10px' : '12px', opacity: 0.8, fontWeight: 'normal' }}>
                {config.desc}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  );
};
