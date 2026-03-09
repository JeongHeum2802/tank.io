import React from 'react';

// 외부에서 주입받는 props의 타입을 정의합니다.
interface LoginScreenProps {
    nickname: string;                           // 현재 입력된 닉네임 값
    setNickname: (name: string) => void;        // 닉네임 변경 콜백 함수 (React 상태 업데이트)
    onJoin: () => void;                         // 닉네임을 확정하고 게임에 진입하는 콜백 함수
}

/**
 * LoginScreen 컴포넌트
 * 게임 접속 전에 유저의 닉네임을 입력받는 화면입니다.
 * 모바일(클램프 폰트 사이즈 등)과 데스크톱 모두에서 잘 보이도록 반응형 스타일이 적용되어 있습니다.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ nickname, setNickname, onJoin }) => {
    return (
        <div style={{
            // 화면 중앙에 요소를 수직으로 배치
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', width: '100vw', backgroundColor: '#1a1a2e', color: 'white', fontFamily: 'sans-serif',
            padding: '20px', boxSizing: 'border-box'
        }}>
            {/* 게임 제목 (화면 크기에 따라 36px ~ 64px 사이에서 동적 조절) */}
            <h1 style={{
                fontSize: 'clamp(36px, 10vw, 64px)', marginBottom: '10px', color: '#f1c40f',
                textShadow: '0px 0px 10px rgba(241,196,15,0.8)', textAlign: 'center'
            }}>Tank.io</h1>
            
            {/* 서브 설명 텍스트 */}
            <p style={{
                marginBottom: '30px', color: '#ccc',
                fontSize: 'clamp(14px, 3.5vw, 18px)', textAlign: 'center'
            }}>Enter your nickname to join the battle!</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '320px' }}>
                {/* 닉네임 입력 필드 */}
                <input 
                    type="text" 
                    placeholder="Nickname" 
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} // 사용자가 타이핑할 때마다 부모 상태 업데이트
                    onKeyDown={e => { 
                        // 엔터 키를 누르면 onJoin 콜백을 실행하여 즉시 입장
                        if(e.key === 'Enter' && nickname.trim()) onJoin(); 
                    }}
                    style={{
                        padding: 'clamp(10px, 2.5vw, 15px) 16px',
                        fontSize: 'clamp(16px, 4vw, 20px)', borderRadius: '10px',
                        border: '2px solid #3498db', backgroundColor: 'rgba(0,0,0,0.5)',
                        color: 'white', outline: 'none', width: '100%', textAlign: 'center',
                        boxShadow: '0 0 10px rgba(52,152,219,0.3)', boxSizing: 'border-box'
                    }}
                />
                
                {/* 게임 진입(시작) 버튼 */}
                <button 
                    onClick={() => nickname.trim() && onJoin()} // 닉네임이 비어있지 않은 경우에만 입장 처리
                    disabled={!nickname.trim()}                   // 닉네임 텍스트가 없으면 버튼 비활성화 (클릭 방지)
                    style={{
                        padding: 'clamp(10px, 2.5vw, 15px)',
                        fontSize: 'clamp(16px, 4vw, 20px)',
                        // 닉네임이 있으면 파란색, 없으면 회색 버튼 표시
                        backgroundColor: nickname.trim() ? '#3498db' : '#555',
                        color: 'white', border: 'none', borderRadius: '10px',
                        cursor: nickname.trim() ? 'pointer' : 'not-allowed', fontWeight: 'bold',
                        transition: 'background-color 0.2s', boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                        width: '100%'
                    }}
                >
                    Play
                </button>
            </div>
        </div>
    );
};
