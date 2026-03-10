import { Router, Request, Response } from "express";

const router = Router();
// 프론트의 test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm (테스트 클라이언트 키) 와 짝을 이루는 토스 공식 테스트 시크릿 키입니다.
const TOSS_SECRET_KEY = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6"; 

router.post("/confirm", async (req: Request, res: Response) => {
    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    // 서버 측 가격 검증 로직 (프론트에서 1300원을 보냈는지 확인)
    if (amount !== 1300) {
        return res.status(400).json({ error: "Invalid amount. Expected 1300." });
    }

    // 토스페이먼츠 Confirm API 호출
    const encryptedSecretKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

    try {
        const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
            method: "POST",
            headers: {
                Authorization: `Basic ${encryptedSecretKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                paymentKey,
                orderId,
                amount,
            }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
            // 결제 승인 실패 (예: 한도 초과, 잔액 부족 등)
            return res.status(response.status).json({ error: data?.message || "Payment Failed", code: data?.code || "FAILED" });
        }

        // 결제 승인 성공 - DB에 결제 이력 저장 등의 로직이 여기에 들어갑니다.
        return res.status(200).json({ message: "Payment successfully confirmed!", data });
    } catch (error) {
        console.error("Toss Confirm Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
