import React from 'react';
import type { LevelUpState } from '../types';

interface LevelUpModalProps {
    levelUpData: LevelUpState | null;                                    // 레벨업 팝업에 표시할 데이터 (보유 스탯, 진행 횟수)
    isMobile: boolean;                                                   // 모바일 화면 여부
    onUpgrade: (stat: 'damage' | 'attackSpeed' | 'range') => void;       // 업그레이드 버튼 클릭 시 포워딩할 콜백 함수
}

/**
 * LevelUpModal 컴포넌트
 * 플레이어가 레벨업을 했을 때 렌더링되는 모달 창입니다.
 * 보유중인 레벨업 횟수가 있을 때만 나타나며, 플레이어가 스탯 강화를 선택할 수 있습니다.
 */
export const LevelUpModal: React.FC<LevelUpModalProps> = ({ levelUpData, isMobile, onUpgrade }) => {
    // 렌더링 조건: 레벨업 데이터가 없거나 보류중인 레벨업 포인트가 없으면 모달을 숨깁니다.
    if (!levelUpData || levelUpData.pending <= 0) return null;

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
            minWidth: isMobile ? 'unset' : '320px',
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
            
            <br/>
            {/* 업그레이드 선택 버튼들을 가로로 나열합니다. */}
            <div style={{
                display: 'flex', gap: isMobile ? '8px' : '10px',
                justifyContent: 'center',
                flexWrap: isMobile ? 'wrap' : 'nowrap'
            }}>
                {/* 공격력 강화 버튼 */}
                <button
                    onClick={() => onUpgrade('damage')}
                    style={{
                        padding: isMobile ? '10px 12px' : '12px 20px',
                        fontSize: isMobile ? '12px' : '14px', cursor: 'pointer',
                        background: '#e74c3c', color: 'white', border: 'none',
                        borderRadius: '8px', fontWeight: 'bold',
                        flex: isMobile ? 1 : 'unset' // 모바일에서는 공간을 꽉 차게 배분
                    }}
                >
                    ⚔️ 공격력<br/>+5
                </button>
                {/* 공격속도 강화 버튼 */}
                <button
                    onClick={() => onUpgrade('attackSpeed')}
                    style={{
                        padding: isMobile ? '10px 12px' : '12px 20px',
                        fontSize: isMobile ? '12px' : '14px', cursor: 'pointer',
                        background: '#3498db', color: 'white', border: 'none',
                        borderRadius: '8px', fontWeight: 'bold',
                        flex: isMobile ? 1 : 'unset'
                    }}
                >
                    ⚡ 공속<br/>-100ms
                </button>
                {/* 사거리 강화 버튼 */}
                <button
                    onClick={() => onUpgrade('range')}
                    style={{
                        padding: isMobile ? '10px 12px' : '12px 20px',
                        fontSize: isMobile ? '12px' : '14px', cursor: 'pointer',
                        background: '#2ecc71', color: 'white', border: 'none',
                        borderRadius: '8px', fontWeight: 'bold',
                        flex: isMobile ? 1 : 'unset'
                    }}
                >
                    🎯 사거리<br/>+500
                </button>
            </div>
        </div>
    );
};
