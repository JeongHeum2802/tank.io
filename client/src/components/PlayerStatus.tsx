import React from 'react';
import type { PlayerStats } from '../types';

interface PlayerStatusProps {
  stats: PlayerStats;
  nickname: string;
  isMobile?: boolean;
}

const PlayerStatus: React.FC<PlayerStatusProps> = ({ stats, nickname, isMobile }) => {
  const xpPercentage = Math.min((stats.xp / stats.xpMax) * 100, 100);
  const hpPercentage = Math.min((stats.hp / stats.maxHp) * 100, 100);

  // HP에 따른 바 색상 결정
  const getHpColor = () => {
    if (hpPercentage > 50) return '#2ecc71'; // Green
    if (hpPercentage > 25) return '#f39c12'; // Orange
    return '#e74c3c'; // Red
  };

  return (
    <div style={{
      position: 'absolute',
      top: isMobile ? '10px' : '20px',
      left: isMobile ? '10px' : '20px',
      zIndex: 1000,
      pointerEvents: 'none',
      fontFamily: "'Inter', sans-serif",
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '4px' : '8px',
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
      minWidth: isMobile ? '200px' : '280px',
      transform: isMobile ? 'scale(0.6)' : 'none',
      transformOrigin: 'top left'
    }}>
      {/* 닉네임 및 레벨 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? '6px' : '10px' }}>
        <span style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 'bold' }}>{nickname}</span>
        <span style={{ fontSize: isMobile ? '12px' : '16px', color: '#bdc3c7' }}>Lv. {stats.level}</span>
      </div>

      {/* 경험치 바 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '12px' }}>
          <span>XP</span>
          <span>{Math.floor(stats.xp)} / {stats.xpMax}</span>
        </div>
        <div style={{
          width: '100%',
          height: isMobile ? '10px' : '14px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '7px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            width: `${xpPercentage}%`,
            height: '100%',
            backgroundColor: '#3498db',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px rgba(52,152,219,0.5)'
          }} />
        </div>
      </div>

      {/* 체력 바 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '12px' }}>
          <span>HP</span>
          <span>{Math.floor(stats.hp)} / {stats.maxHp}</span>
        </div>
        <div style={{
          width: '100%',
          height: isMobile ? '12px' : '18px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '9px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            width: `${hpPercentage}%`,
            height: '100%',
            backgroundColor: getHpColor(),
            transition: 'width 0.3s ease-out',
            boxShadow: `0 0 10px ${getHpColor()}88`
          }} />
        </div>
      </div>
    </div>
  );
};

export default PlayerStatus;
