import React from 'react';
import type { LeaderboardEntry } from '../types';

interface LeaderboardProps {
    leaderboard: LeaderboardEntry[]; // 상위 플레이어 정보 배열 (Colyseus 서버 state로 부터 파생됨)
    isMobile: boolean;               // 모바일 환경인지 여부에 따라 크기와 개수를 조절
}

/**
 * Leaderboard 컴포넌트
 * 우측 상단에 떠 있는 게임 랭킹 오버레이(순위표)입니다.
 * 데스크톱은 10명, 모바일은 화면 크기를 고려하여 상위 5명만 표시합니다.
 */
export const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard, isMobile }) => {
    // 랭킹 데이터가 존재하지 않으면 화면에 아무것도 그리지 않습니다.
    if (leaderboard.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            // 모바일 환경에선 여백을 좁게하여 영역 차지를 최소화합니다.
            top: isMobile ? '8px' : '20px',
            right: isMobile ? '8px' : '20px',
            background: 'rgba(0, 0, 0, 0.65)',
            padding: isMobile ? '8px 10px' : '15px 20px',
            borderRadius: '10px', color: 'white',
            minWidth: isMobile ? '140px' : '220px',
            maxWidth: isMobile ? '160px' : '280px',
            border: '1px solid rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)',
            zIndex: 100, fontFamily: 'sans-serif',
            fontSize: isMobile ? '11px' : '14px' // 모바일은 폰트 사이즈 감소
        }}>
            <h3 style={{
                margin: '0 0 6px',
                fontSize: isMobile ? '13px' : '18px',
                textAlign: 'center', color: '#f1c40f',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: '6px'
            }}>
                Leaderboard
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {/* 모바일은 5개, 데스크톱은 10개 항목만 slice 하여 렌더링합니다 */}
                {leaderboard.slice(0, isMobile ? 5 : 10).map((entry, index) => (
                    <li key={entry.sessionId} style={{ 
                        display: 'flex', justifyContent: 'space-between', 
                        marginBottom: isMobile ? '4px' : '8px',
                        fontSize: isMobile ? '11px' : '14px',
                        // 1, 2, 3위에 별도의 하이라이트 색상을 적용합니다
                        color: index === 0 ? '#f1c40f' : index === 1 ? '#e67e22' : index === 2 ? '#e74c3c' : 'white',
                        fontWeight: index < 3 ? 'bold' : 'normal'
                    }}>
                        {/* 닉네임 표시: 텍스트가 너무 길어지면 자동 말줄임(...) 처리 */}
                        <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', maxWidth: isMobile ? '80px' : '150px'
                        }}>{index + 1}. {entry.nickname}</span>
                        {/* 현재 레벨 표시 */}
                        <span style={{ color: '#ccc', marginLeft: '8px', flexShrink: 0 }}>Lv {entry.level}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
