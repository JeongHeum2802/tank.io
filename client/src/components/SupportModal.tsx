import React, { useEffect, useRef } from 'react';
import { loadPaymentWidget } from '@tosspayments/payment-widget-sdk';
import type { PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';

interface SupportModalProps {
    onClose: () => void;
}

// 개발자용 테스트 키 (실 결제 발생 X)
const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
const customerKey = "toss_tankio_test_user_" + Math.random().toString(36).substring(2, 10);
const SUPPORT_AMOUNT = 1300; // 고정 1300원

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
    const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<any>(null);

    useEffect(() => {
        const initWidget = async () => {
            try {
                // 토스페이먼츠 위젯 객체 생성 (비인증/테스트)
                const paymentWidget = await loadPaymentWidget(clientKey, customerKey);
                
                // 결제창(UI) 렌더링
                const paymentMethodsWidget = paymentWidget.renderPaymentMethods(
                    '#payment-widget',
                    { value: SUPPORT_AMOUNT },
                    { variantKey: "DEFAULT" }
                );

                // 이용약관 UI 렌더링
                paymentWidget.renderAgreement(
                    '#agreement', 
                    { variantKey: "AGREEMENT" }
                );

                paymentWidgetRef.current = paymentWidget;
                paymentMethodsWidgetRef.current = paymentMethodsWidget;

            } catch (error) {
                console.error("토스 결제 위젯 로드 실패:", error);
            }
        };

        initWidget();
    }, []);

    const handlePaymentRequest = async () => {
        const paymentWidget = paymentWidgetRef.current;
        if (!paymentWidget) return;

        try {
            // 결제 요청 (팝업 또는 리다이렉트 발생)
            await paymentWidget.requestPayment({
                orderId: "ORDER_" + Math.random().toString(36).substring(2, 15),
                orderName: "개발자 커피 후원 ☕",
                successUrl: window.location.origin + "/success", // 나중에 백엔드 승인 작업 필요
                failUrl: window.location.origin + "/fail",
                customerEmail: "support@tank.io",
                customerName: "익명 후원자",
                // 토스 연동 시창에 띄우기 위한 환경 변수 (리액트 내에서 처리)
            });
        } catch (error) {
            // 결제 실패 / 취소 처리
            console.error("결제 에러:", error);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                color: '#333',
                position: 'relative'
            }}>
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'none', border: 'none', fontSize: '24px',
                        cursor: 'pointer', color: '#999'
                    }}
                >
                    &times;
                </button>

                <h2 style={{ textAlign: 'center', marginBottom: '8px', color: '#1a1a2e' }}>개발자에게 커피 사주기 ☕</h2>
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                    여러분의 소중한 후원({SUPPORT_AMOUNT.toLocaleString()}원)은 서버 유지비에 큰 힘이 됩니다!
                </p>

                {/* 토스 결제 위젯이 마운트될 틀 */}
                <div id="payment-widget" style={{ width: '100%' }}></div>
                <div id="agreement" style={{ width: '100%', marginTop: '10px' }}></div>

                <button 
                    onClick={handlePaymentRequest}
                    style={{
                        width: '100%', padding: '16px', marginTop: '20px',
                        backgroundColor: '#3182f6', color: 'white',
                        border: 'none', borderRadius: '8px', fontSize: '18px',
                        fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(49,130,246,0.3)', transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1b64da'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3182f6'}
                >
                    {SUPPORT_AMOUNT.toLocaleString()}원 결제하기
                </button>
            </div>
        </div>
    );
};
