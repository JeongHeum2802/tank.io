import React from 'react';
import type { StatLevels } from '../types';

interface StatOverlayProps {
    statLevels: StatLevels;  // 각 스탯별 업그레이드 횟수
    isMobile: boolean;       // 모바일 환경 여부 (위치 조정용)
}

// 스탯 ID에 대응하는 아이콘과 한국어 레이블 매핑
const STAT_DISPLAY: Record<string, { icon: string; name: string }> = {
    damage:       { icon: '⚔️', name: '공격력' },
    attackSpeed:  { icon: '⚡', name: '공격속도' },
    range:        { icon: '🎯', name: '사거리' },
    speed:        { icon: '👟', name: '이동속도' },
    maxHp:        { icon: '❤️', name: '최대체력' },
    magnetRadius: { icon: '🧲', name: '자석' },
    shotgunLevel: { icon: '🔫', name: '샷건' },
    bulletSize:   { icon: '💣', name: '총알크기' },
};

/**
 * StatOverlay 컴포넌트
 * 게임 화면 좌측 하단에 반투명 오버레이로 각 스탯의 업그레이드 횟수를 표시합니다.
 * 업그레이드 횟수가 1 이상인 스탯만 표시됩니다.
 */
export const StatOverlay: React.FC<StatOverlayProps> = ({ statLevels, isMobile }) => {
    // 업그레이드 한 적 있는(횟수 > 0) 스탯만 필터링
    const upgradedStats = Object.entries(statLevels).filter(([, count]) => count > 0);

    // 아무 스탯도 업그레이드 하지 않았다면 렌더링하지 않음
    if (upgradedStats.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            // 모바일에서는 조이스틱과 겹치지 않도록 더 위쪽에 배치
            bottom: isMobile ? '140px' : '16px',
            left: '12px',
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '10px',
            padding: isMobile ? '8px 10px' : '10px 14px',
            color: 'white',
            zIndex: 500,
            pointerEvents: 'none', // 클릭이 게임으로 전달되도록 투과
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: isMobile ? '130px' : '160px',
        }}>
            <div style={{
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: 'bold',
                marginBottom: '6px',
                color: '#f1c40f',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                paddingBottom: '4px'
            }}>
                📊 스탯 업그레이드
            </div>
            {upgradedStats.map(([key, count]) => {
                const display = STAT_DISPLAY[key] || { icon: '❓', name: key };
                return (
                    <div key={key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: isMobile ? '11px' : '13px',
                        padding: '2px 0',
                        gap: '6px'
                    }}>
                        <span>{display.icon} {display.name}</span>
                        <span style={{
                            color: '#f1c40f',
                            fontWeight: 'bold',
                            minWidth: '28px',
                            textAlign: 'right'
                        }}>
                            Lv.{count}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
